import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide, SlidePair, Song, SongSetlistData } from "~/types"
import type { OnlineUser, SlideEditLock } from "./useSocketIO"
import type { Socket } from "socket.io-client"
import {
  enqueueCoalescedSlideShadowPut,
  enqueueSlideShadowWrite,
  getPendingSlideDraft,
} from "~/composables/useSlideRepository"
import {
  drivenMemberOf,
  dropFromLivePair,
  normalizePair,
  projectLiveSlide,
} from "~/composables/useSlidePairs"
import { livePairChanged } from "~/utils/slidePairs"
import useSlideUploadProgress from "~/composables/useSlideUploadProgress"
import { applyPendingState } from "~/composables/usePendingSlideState"
import { hasCloudMedia, stayedBehindFromSync } from "~/utils/pendingUpload"
import { baseRevFor, forgetOwnSlideRev } from "~/utils/slideRev"
import { hasSlideConflict } from "~/composables/useSlideResync"

interface RealtimeSlidesOptions {
  onSlideCreated?: (slide: Slide, createdByName: string, createdBy?: string) => void
  onSlideUpdated?: (slide: Slide, updatedByName: string) => void
  onSlidePairCreated?: (pair: SlidePair, createdByName: string, createdBy?: string) => void
  /** Only for changes that alter how the pair shows, not save echoes. */
  onSlidePairUpdated?: (pair: SlidePair, updatedByName: string, updatedBy?: string) => void
  onSetlistSongsAdded?: (
    setlist: Slide,
    songs: Song[],
    addedByName: string,
    addedBy?: string
  ) => void
  onSlideDeleted?: (slide: Slide, deletedByName: string, deletedBy?: string) => void
  onBatchSlidesCreated?: (slides: Slide[], createdByName: string, createdBy?: string) => void
  onBatchSlidesUpdated?: (slides: Slide[], updatedByName: string) => void
  onBatchSlidesDeleted?: (slideIds: string[], deletedByName: string) => void
  onSlidesReordered?: (slideOrder: string[], reorderedByName: string) => void
  onSlideEditing?: (slideId: string, userName: string) => void
  onSlideLocked?: (lock: SlideEditLock) => void
  onSlideUnlocked?: (slideId: string) => void
  onUserJoined?: (user: OnlineUser) => void
  onUserLeft?: (userId: string, userName: string) => void
}

/**
 * Generate a unique tab/session ID for this browser tab
 * This allows the same user to collaborate across multiple tabs/devices
 * Each tab gets its own unique ID that persists for the session
 */
const tabSessionId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

// Export the tab session ID for use in other modules
export { tabSessionId }

export const useRealtimeSlides = (options: RealtimeSlidesOptions = {}) => {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const { applyOverlaySettings } = useOverlaySettings()
  const { handleControlMessage } = useLiveOutputControl()

  // Track online users
  const onlineUsers = ref<OnlineUser[]>([])
  const onlineCount = computed(() => onlineUsers.value.length)

  // Track which slides are being edited by others (using Record for localStorage compatibility)
  const slidesBeingEdited = ref<
    Record<string, { userId: string; userName: string; avatar?: string; theme?: string }>
  >({})

  // Track slide locks
  const slideLocks = ref<Record<string, SlideEditLock>>({})

  const slideMatchesId = (slide: Slide | undefined, ...ids: Array<string | null | undefined>) => {
    if (!slide) return false
    return ids.some((id) => Boolean(id) && (slide.id === id || slide._id === id))
  }

  const { setUploadProgress, clearUploadProgress } = useSlideUploadProgress()

  /** Fields that ride along on a socket message but are not part of a slide. */
  const stripSocketMeta = (slide: any) => {
    delete slide.createdBy
    delete slide.createdByName
    delete slide.updatedBy
    delete slide.updatedByName
    delete slide.timestamp
    delete slide.tabId
    delete slide.uploadSettled
    return slide as Slide
  }

  /**
   * A slide that is no longer pending carries `pendingUpload: null`, which only
   * exists to overwrite the old value in a merge. Leave no key behind.
   */
  const dropClearedPending = (slide: Slide) => {
    if (slide.pendingUpload == null) {
      delete slide.pendingUpload
      clearUploadProgress(slide.id)
    }
    return slide
  }

  /**
   * A slide this device already holds as a placeholder arrives again as a plain
   * create (the owner's slide was saved after reconnecting). Repeats of a normal
   * slide are ignored as ever; a pending one takes the new copy, which carries
   * the server `_id` and the media URLs.
   */
  const mergeIntoPendingSlides = (incoming: Slide[]) => {
    const byId = appStore.activeSlidesById
    const merges = new Map<string, Slide>()
    incoming.forEach((slide) => {
      const existing = byId.get(slide.id)
      if (!existing?.pendingUpload) return
      merges.set(
        slide.id,
        dropClearedPending({
          ...existing,
          ...slide,
          pendingUpload: slide.pendingUpload ?? null,
        })
      )
    })
    if (!merges.size) return 0
    // Replace the slides outright (a merge would let the cleared key survive),
    // in one pass: each replacement re-renders the whole grid.
    appStore.setActiveSlides(
      appStore.activeSlides.map((s) => merges.get(s.id) ?? s)
    )
    merges.forEach((merged) =>
      enqueueCoalescedSlideShadowPut(merged, { syncState: "synced" })
    )
    return merges.size
  }

  /** A placeholder just arrived: start its clock and count it. */
  const notePendingArrival = (slide: Slide) => {
    if (slide.pendingUpload?.state !== 'uploading') return
    // Saved as synced, not as an unsaved local slide of this user: nothing here
    // has to send it anywhere, and the next refresh clears it if it never lands.
    enqueueCoalescedSlideShadowPut(slide, { syncState: 'synced' })
    setUploadProgress(slide.id, 0)
    usePosthogCapture('PENDING_SLIDE_RECEIVED', { slideType: slide.type })
  }

  const clearLiveSlideIfDeleted = (slide: Slide) => {
    // A member of the live pair: the other member stays on screen alone.
    if (dropFromLivePair(slide.id)) return
    if (slideMatchesId(slide, appStore.currentState.liveSlideId)) {
      appStore.setLiveSlide("")
      useBroadcastPost(null)
    }
  }

  const clearOverlaySlideIfDeleted = (slide: Slide) => {
    if (slideMatchesId(slide, appStore.currentState.activeOverlaySlide?.id)) {
      appStore.setActiveOverlaySlide(null)
      useBroadcastOverlayPost(appWideActions.removeSlideOverlay)
    }
  }

  // Lock refresh interval (every 15 seconds)
  let lockRefreshInterval: NodeJS.Timeout | null = null
  const currentLockedSlideId = ref<string | null>(null)

  /**
   * Check if a slide is being edited by someone else
   */
  const isSlideBeingEdited = (slideId: string): boolean => {
    const editInfo = slidesBeingEdited.value[slideId]
    return editInfo !== undefined && editInfo.userId !== authStore.user?._id
  }

  /**
   * Get the name of the user editing a slide
   */
  const getSlideEditor = (slideId: string): string | null => {
    const editInfo = slidesBeingEdited.value[slideId]
    if (editInfo && editInfo.userId !== authStore.user?._id) {
      return editInfo.userName
    }
    return null
  }

  /**
   * Check if a slide is locked by someone else
   */
  const isSlideLockedByOther = (slideId: string): boolean => {
    const lock = slideLocks.value[slideId]
    return lock !== undefined && lock.lockedBy !== authStore.user?._id
  }

  /**
   * Get lock info for a slide
   */
  const getSlideLock = (slideId: string): SlideEditLock | undefined => {
    return slideLocks.value[slideId]
  }

  /**
   * Songs in the updated setlist that the previous version did not have,
   * matched by setlist item id. Skipped when the old setlist's songs were never
   * loaded here, so a first hydration does not read as a teammate adding songs.
   */
  const songsAddedToSetlist = (before: Slide | undefined, after: Slide): Song[] => {
    if (before?.type !== slideTypes.songSetlist || after.type !== slideTypes.songSetlist) {
      return []
    }
    const beforeSongs = (before.data as SongSetlistData | undefined)?.songs
    const afterSongs = (after.data as SongSetlistData | undefined)?.songs
    if (!Array.isArray(beforeSongs) || !Array.isArray(afterSongs)) return []
    const known = new Set(beforeSongs.map((item) => item?.id))
    return afterSongs
      .filter((item) => item?.id && !known.has(item.id) && item.song)
      .map((item) => item.song)
  }

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = async (message: any) => {
    const { action, data } = message

    switch (action) {
      case 'slide-created':
      case 'create-slide':
        // Don't process updates from the same tab (tabId check)
        // This allows same user on different tabs/devices to receive updates
        if (data.tabId === tabSessionId) return

        // Add slide to store
        if (data && data.id) {
          const newSlide = { ...data } as Slide
          delete (newSlide as any).createdBy
          delete (newSlide as any).createdByName
          delete (newSlide as any).timestamp
          delete (newSlide as any).tabId
          // A slide that arrives with no media and no word on why is one whose
          // files stayed on its owner's device, not an empty slide.
          const stayedBehind = stayedBehindFromSync(newSlide)
          if (stayedBehind) newSlide.pendingUpload = stayedBehind

          // A slide already on the schedule (this delivery is a repeat —
          // a reconnect replaying it, two of the sender's own sockets in
          // the room) is not new, so it gets no second "X added…" toast.
          const wasNew = appStore.appendActiveSlide(newSlide)
          if (wasNew) {
            notePendingArrival(newSlide)
            options.onSlideCreated?.(newSlide, data.createdByName, data.createdBy)
          } else {
            mergeIntoPendingSlides([newSlide])
          }
        }
        break

      case 'slide-updated':
      case 'update-slide':
        // Don't process updates from the same tab
        // This allows same user on different tabs/devices to receive updates
        if (data.tabId === tabSessionId) return

        // Update slide in store
        if (data && (data.id || data._id || data.slideId)) {
          const slideId = data.slideId || data.id || data._id
          const candidate = appStore.activeSlides.find(
            (slide) => slideMatchesId(slide, slideId, data._id)
          )
          if (candidate && (
            hasSlideConflict(candidate._id) ||
            await getPendingSlideDraft(candidate.scheduleId, candidate.id)
          )) return
          const slideIndex = appStore.activeSlides.findIndex(
            (slide) => slideMatchesId(slide, slideId, data._id)
          )

          if (slideIndex !== -1) {
            const updatedSlide = { ...data } as Slide
            delete (updatedSlide as any).updatedBy
            delete (updatedSlide as any).updatedByName
            delete (updatedSlide as any).timestamp
            delete (updatedSlide as any).tabId
            delete (updatedSlide as any).uploadSettled
            delete (updatedSlide as any).revisionConfirmed

            // Merge with existing slide to preserve local-only properties
            const existingSlide = appStore.activeSlides[slideIndex]!
            if (hasSlideConflict(existingSlide._id)) return
            const existingRev = baseRevFor(existingSlide)
            if (updatedSlide.rev !== undefined && existingRev !== null &&
              updatedSlide.rev < existingRev) return
            // Typing events are speculative. Only the REST acknowledgement
            // can attach a new server revision to the content in the event.
            if (!data.revisionConfirmed) {
              updatedSlide.rev = updatedSlide.rev === existingRev ? updatedSlide.rev : undefined
            }
            forgetOwnSlideRev(existingSlide._id)
            const mergedSlide = dropClearedPending({
              ...existingSlide,
              ...updatedSlide,
              index: existingSlide.index,
              // A slide that stayed behind and now arrives with its media in
              // the cloud is whole, even if the sender said nothing about it.
              ...(existingSlide?.pendingUpload?.state === 'device-only' &&
              updatedSlide.pendingUpload === undefined &&
              hasCloudMedia(updatedSlide)
                ? { pendingUpload: null }
                : {}),
            })

            // Reassign the array reference (not an in-place splice) so shallow
            // watchers re-fire. PreviewContent keeps a filtered copy of the
            // slides synced via `watch(() => activeSlides)`, which only triggers
            // on reference change — an in-place splice would update LiveOutput
            // (a computed) but leave the preview grid and editor stale.
            const nextSlides = [...appStore.activeSlides]
            nextSlides.splice(slideIndex, 1, mergedSlide)
            appStore.setActiveSlides(nextSlides)
            enqueueCoalescedSlideShadowPut(mergedSlide, {
              syncState: "synced",
              preservePending: true,
            })
            // An upload that started over (the owner tapped Retry) gets a fresh
            // clock here, so it is not mistaken for one that went quiet.
            if (mergedSlide.pendingUpload?.state === 'uploading') {
              setUploadProgress(mergedSlide.id, 0)
            }
            options.onSlideUpdated?.(mergedSlide, data.updatedByName)
            const addedSongs = songsAddedToSetlist(existingSlide, mergedSlide)
            if (addedSongs.length) {
              options.onSetlistSongsAdded?.(
                mergedSlide,
                addedSongs,
                data.updatedByName,
                data.updatedBy
              )
            }

            // If slide is live, update the live output. A member of the live
            // pair re-sends the whole pair with that member changed.
            if (appStore.isSlideLive(mergedSlide.id)) {
              projectLiveSlide(mergedSlide, { keepShape: true })
            }
            if (appStore.currentState.activeOverlaySlide?.id === mergedSlide.id) {
              const overlaySlide = applyOverlaySettings(mergedSlide)
              appStore.setActiveOverlaySlide(overlaySlide)
              useBroadcastOverlayPost(appWideActions.showSlideOverlay, overlaySlide)
            }
          } else if (data.uploadSettled && data.type) {
            // The owner finished uploading a slide this device never received
            // as a placeholder (it joined late, or missed the message). The
            // finished slide is complete, so add it. Only this flagged update
            // may add a slide: any other update for an unknown id stays ignored.
            const addedSlide = dropClearedPending(
              stripSocketMeta({ ...data, id: data.id || slideId }) as Slide
            )
            delete (addedSlide as any).slideId
            if (appStore.appendActiveSlide(addedSlide)) {
              options.onSlideCreated?.(addedSlide, data.updatedByName, data.updatedBy)
            }
          }
        }
        break

      case 'slide-upload-progress':
        if (data?.slideId && typeof data.progress === 'number') {
          setUploadProgress(String(data.slideId), data.progress)
        }
        break

      case 'slide-deleted':
      case 'delete-slide':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slideId || data.id || data._id) {
          const slideId = data.slideId || data.id || data._id
          const slideToRemove = appStore.activeSlides.find(
            (s) => slideMatchesId(s, slideId, data._id)
          )
          if (slideToRemove) {
            clearLiveSlideIfDeleted(slideToRemove)
            clearOverlaySlideIfDeleted(slideToRemove)
            appStore.removeActiveSlide(slideToRemove)
            options.onSlideDeleted?.(slideToRemove, data.deletedByName, data.deletedBy)
          }
        }
        break

      case 'slides-batch-created':
      case 'batch-create-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slides && Array.isArray(data.slides)) {
          const newSlides = data.slides.map((s: any) => {
            const slide = { ...s }
            delete slide.createdBy
            delete slide.createdByName
            delete slide.timestamp
            delete slide.tabId
            const stayedBehind = stayedBehindFromSync(slide)
            if (stayedBehind) slide.pendingUpload = stayedBehind
            return slide
          })
          // Same guard as the single-slide case, scoped to just the slides
          // this delivery actually added — a repeat delivery whose slides are
          // all already on the schedule gets no toast at all.
          const knownIds = appStore.activeSlidesById
          const alreadyKnown = newSlides.filter((slide: Slide) =>
            knownIds.has(slide.id)
          )
          const actuallyAdded = appStore.appendActiveSlides(newSlides)
          mergeIntoPendingSlides(alreadyKnown)
          if (actuallyAdded.length) {
            actuallyAdded.forEach(notePendingArrival)
            options.onBatchSlidesCreated?.(
              actuallyAdded,
              data.createdByName,
              data.createdBy
            )
          }
        }
        break

      case 'slides-batch-updated':
      case 'batch-update-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slides && Array.isArray(data.slides)) {
          // Build a new array reference so shallow watchers (PreviewContent
          // keeps a filtered copy synced via `watch(() => activeSlides)`)
          // re-fire. In-place splices update LiveOutput (a computed) but leave
          // the preview grid and editor stale.
          const incoming: Slide[] = data.slides
          const blocked = await Promise.all(incoming.map(async (slide) => {
            const current = appStore.activeSlidesById.get(slide.id)
            return current && (hasSlideConflict(current._id) ||
              await getPendingSlideDraft(current.scheduleId, current.id))
          }))
          const nextSlides = [...appStore.activeSlides]
          const mergedSlides: Slide[] = []
          incoming.forEach((updatedSlide, index) => {
            if (blocked[index]) return
            const slideIndex = nextSlides.findIndex(
              (s) => s.id === updatedSlide.id || s._id === updatedSlide._id
            )
            if (slideIndex !== -1) {
              const existingSlide = nextSlides[slideIndex]
              if (!existingSlide || hasSlideConflict(existingSlide._id)) return
              forgetOwnSlideRev(existingSlide._id)
              const mergedSlide = { ...existingSlide, ...updatedSlide, rev: existingSlide.rev }
              nextSlides.splice(slideIndex, 1, mergedSlide)
              if (
                appStore.currentState.activeOverlaySlide?.id === mergedSlide.id
              ) {
                const overlaySlide = applyOverlaySettings(mergedSlide)
                appStore.setActiveOverlaySlide(overlaySlide)
                useBroadcastOverlayPost(
                  appWideActions.showSlideOverlay,
                  overlaySlide
                )
              }
              mergedSlides.push(mergedSlide)
            }
          })
          if (mergedSlides.length) {
            appStore.setActiveSlides(nextSlides)
            enqueueSlideShadowWrite(
              "realtime batch slide update",
              (repository) =>
                repository.putSlides(mergedSlides, { syncState: "synced", preservePending: true })
            )
            options.onBatchSlidesUpdated?.(mergedSlides, data.updatedByName)
          }
        }
        break

      case 'slides-batch-deleted':
      case 'batch-delete-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slideIds && Array.isArray(data.slideIds)) {
          data.slideIds.forEach((slideId: string) => {
            const slideToRemove = appStore.activeSlides.find(
              (s) => slideMatchesId(s, slideId)
            )
            if (slideToRemove) {
              clearLiveSlideIfDeleted(slideToRemove)
              clearOverlaySlideIfDeleted(slideToRemove)
              appStore.removeActiveSlide(slideToRemove)
            }
          })
          options.onBatchSlidesDeleted?.(data.slideIds, data.deletedByName)
        }
        break

      case 'slide-pair-created':
      case 'slide-pair-updated': {
        if (data?.tabId === tabSessionId) return
        const pair = normalizePair(data?.pair)
        if (!pair) return
        const previous = appStore.slidePairsById.get(pair.id)
        const wasLive = appStore.currentState.livePairId === pair.id
        appStore.upsertSlidePair(pair)
        if (action === 'slide-pair-created' && !previous) {
          options.onSlidePairCreated?.(pair, data.createdByName, data.createdBy)
        } else if (previous && livePairChanged(previous, pair)) {
          options.onSlidePairUpdated?.(pair, data.updatedByName, data.updatedBy)
        }
        // A teammate changed how the live pair shows (layout, hidden member,
        // microphone, order, members or backdrop): show it here too. Which
        // member a teammate is editing is theirs alone and never sent.
        if (wasLive && previous && livePairChanged(previous, pair)) {
          const driven = appStore.activeSlidesById.get(drivenMemberOf(pair))
          if (driven) projectLiveSlide(driven)
        }
        break
      }

      case 'slide-pair-deleted': {
        if (data?.tabId === tabSessionId) return
        const pairId = data?.pairId
        if (!pairId) return
        const pair = appStore.slidePairsById.get(pairId)
        const wasLive = appStore.currentState.livePairId === pairId
        const driven = pair
          ? appStore.activeSlidesById.get(drivenMemberOf(pair))
          : undefined
        appStore.removeSlidePair(pairId)
        if (wasLive && driven) projectLiveSlide(driven)
        break
      }

      case 'show-slide-overlay': {
        if (data?.tabId === tabSessionId) return
        if (!data?.id) return
        const overlaySlide = { ...data } as Slide
        delete (overlaySlide as any).tabId
        appStore.setActiveOverlaySlide(overlaySlide)
        useBroadcastOverlayPost(appWideActions.showSlideOverlay, overlaySlide)
        break
      }

      case 'remove-slide-overlay':
        if (data?.tabId === tabSessionId) return
        appStore.setActiveOverlaySlide(null)
        useBroadcastOverlayPost(appWideActions.removeSlideOverlay)
        break

      case 'reorder-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        // Handle slide reorder from other tabs/devices
        if (data.slideOrder && Array.isArray(data.slideOrder)) {
          const reorderedSlides = data.slideOrder
            .map((slideId: string) =>
              appStore.activeSlides.find((s) => s.id === slideId)
            )
            .filter((s: Slide | undefined): s is Slide => s !== undefined)
            .map((slide: Slide, index: number) => ({ ...slide, index }))

          if (reorderedSlides.length > 0) {
            appStore.replaceScheduleActiveSlides(reorderedSlides)
            options.onSlidesReordered?.(data.slideOrder, data.reorderedByName)
          }
        }
        break

      case 'slide-editing':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        slidesBeingEdited.value[data.slideId] = {
          userId: data.userId,
          userName: data.userName,
          avatar: data.avatar,
          theme: data.theme,
        }

        // Also update store for component reactivity (carries avatar/theme so
        // the slide card can render the user's avatar, not just an initial).
        appStore.setSlideBeingEdited(data.slideId, {
          userId: data.userId,
          userName: data.userName,
          avatar: data.avatar,
          theme: data.theme,
        })

        options.onSlideEditing?.(data.slideId, data.userName)

        // Auto-clear after 35 seconds (lock timeout + buffer)
        setTimeout(() => {
          const editInfo = slidesBeingEdited.value[data.slideId]
          if (editInfo?.userId === data.userId) {
            delete slidesBeingEdited.value[data.slideId]
            appStore.clearSlideBeingEdited(data.slideId)
          }
        }, 35000)
        break

      case 'slide-locked':
        slideLocks.value[data.slideId] = {
          slideId: data.slideId,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
        }
        options.onSlideLocked?.({
          slideId: data.slideId,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
        })
        break

      case 'slide-unlocked':
        delete slideLocks.value[data.slideId]
        delete slidesBeingEdited.value[data.slideId]
        appStore.clearSlideBeingEdited(data.slideId)
        options.onSlideUnlocked?.(data.slideId)
        break

      case 'lock-denied':
        toast.add({
          title: `Slide is being edited by ${data.lockedByName}`,
          icon: 'i-tabler-lock',
          color: 'amber',
        })
        break

      case 'lock-granted':
        currentLockedSlideId.value = data.slideId
        startLockRefresh()
        break

      case 'user-joined':
        // User joined events should be processed for all users
        options.onUserJoined?.({
          userId: data.userId,
          userName: data.userName,
          avatar: data.avatar,
          scheduleId: data.scheduleId,
          joinedAt: new Date().toISOString(),
          theme: data.theme,
        })
        if (data.onlineUsers) {
          onlineUsers.value = data.onlineUsers
        }
        break

      case 'user-left':
        // User left events should be processed for all users
        options.onUserLeft?.(data.userId, data.userName)
        if (data.onlineUsers) {
          onlineUsers.value = data.onlineUsers
        }
        // Someone who left mid-upload will not finish it from here. Their
        // media is only on their device now, so stop showing a progress bar.
        if (
          data.userId &&
          !(data.onlineUsers || []).some((u: OnlineUser) => u.userId === data.userId)
        ) {
          appStore.activeSlides
            .filter(
              (slide) =>
                slide.pendingUpload?.state === 'uploading' &&
                slide.pendingUpload.ownerId === data.userId
            )
            .forEach((slide) => {
              clearUploadProgress(slide.id)
              applyPendingState(slide.id, {
                ...slide.pendingUpload!,
                state: 'device-only',
              })
            })
        }
        break

      // Live output control. Deliberately thin: the decision about whether this
      // device is the one being addressed — and whether it owns an output at
      // all — belongs to useLiveOutputControl, not to a switch case that every
      // client runs.
      case 'live-control-host':
      case 'live-control-request':
        handleControlMessage(action, data)
        break

    }
  }

  /**
   * Update online users list
   */
  const updateOnlineUsers = (users: OnlineUser[]) => {
    onlineUsers.value = users
  }

  /**
   * Start the lock refresh interval
   */
  const startLockRefresh = () => {
    stopLockRefresh()
    lockRefreshInterval = setInterval(() => {
      if (currentLockedSlideId.value) {
        const nuxtApp = useNuxtApp()
        const socket = nuxtApp.$socketio as Socket
        if (socket?.connected) {
          socket.emit('refresh-lock', { slideId: currentLockedSlideId.value })
        }
      }
    }, 15000) // Refresh every 15 seconds
  }

  /**
   * Stop the lock refresh interval
   */
  const stopLockRefresh = () => {
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval)
      lockRefreshInterval = null
    }
  }

  /**
   * Release current lock
   */
  const releaseCurrentLock = () => {
    if (currentLockedSlideId.value) {
      const nuxtApp = useNuxtApp()
      const socket = nuxtApp.$socketio as Socket
      if (socket?.connected) {
        socket.emit('unlock-slide', { slideId: currentLockedSlideId.value })
      }
      currentLockedSlideId.value = null
      stopLockRefresh()
    }
  }

  /**
   * Cleanup on unmount
   */
  const cleanup = () => {
    releaseCurrentLock()
    stopLockRefresh()
    slidesBeingEdited.value = {}
    slideLocks.value = {}
    onlineUsers.value = []
    appStore.clearAllSlidesBeingEdited()
    appStore.setOnlineUsers([])
  }

  return {
    // State
    onlineUsers: readonly(onlineUsers),
    onlineCount,
    slidesBeingEdited: readonly(slidesBeingEdited),
    slideLocks: readonly(slideLocks),
    currentLockedSlideId: readonly(currentLockedSlideId),

    // Methods
    handleWebSocketMessage,
    updateOnlineUsers,
    isSlideBeingEdited,
    getSlideEditor,
    isSlideLockedByOther,
    getSlideLock,
    releaseCurrentLock,
    cleanup,
  }
}
