import { useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  LivePayload,
  Slide,
  SlidePair,
  SlidePairBackground,
  SlidePairLayout,
} from "~/types"
import { tabSessionId } from "~/composables/useRealtimeSlides"
import { safeDBOperation } from "~/composables/useIndexedDB"
import { getAPIErrorStatus } from "~/utils/apiErrors"
import { appWideActions } from "~/utils/constants"
import { drivenMemberId, stampPairForLive } from "~/utils/slidePairs"

// ── Per-window state ────────────────────────────────────────────────────────

/**
 * Which member each pair's card and editor show, in this window only. Picking
 * a member to edit is not a change to what is on screen, so it is never saved
 * or sent: a teammate looking at the other member changes nothing here.
 */
const editingMembers = reactive(new Map<string, string>())

/**
 * Members kept off the screen for now because their media is not on this
 * device yet, by pair id. Unlike the pair's own hidden member this is never
 * saved: it lasts until the media lands (see releaseMemberOffScreen), and every
 * re-send in the meantime (a verse change) keeps it off.
 */
const heldOffScreen = reactive(new Map<string, string>())

export const holdMemberOffScreen = (pairId: string, slideId: string) => {
  heldOffScreen.set(pairId, slideId)
}

export const releaseMemberOffScreen = (pairId: string) =>
  heldOffScreen.delete(pairId)

/** The slide being dragged, so every camera card can show it would take it. */
export const draggingSlideId = ref<string | null>(null)

/** The member a pair is driven by (see drivenMemberId), from this device's slides. */
export const drivenMemberOf = (pair: SlidePair): string => {
  const slidesById = useAppStore().activeSlidesById
  return drivenMemberId(pair.slideIds, (id) => slidesById.get(id)) || pair.slideIds[0]!
}

/** The member this window's card and editor show for a pair. */
export const editingMemberOf = (pair: SlidePair): string => {
  const chosen = editingMembers.get(pair.id)
  return chosen && pair.slideIds.includes(chosen) ? chosen : drivenMemberOf(pair)
}

export const setEditingMember = (pairId: string, slideId: string) => {
  editingMembers.set(pairId, slideId)
}

/** A pair from the API or a socket event, with the ids the client keys on. */
export const normalizePair = (pair: SlidePair | undefined): SlidePair | null => {
  if (!pair || !Array.isArray(pair.slideIds)) return null
  const id = pair.id || (pair as any)._id
  return id
    ? { ...pair, id: String(id), scheduleId: String(pair.scheduleId) }
    : null
}

/** What goes over the wire: never the client-only `pending` flag. */
const toPairBody = ({ pending: _pending, ...pair }: SlidePair) => pair

// ── Going live ──────────────────────────────────────────────────────────────

type ProjectOptions = {
  /**
   * An edit to what is on screen keeps it the shape it is: a slide that went
   * live alone and was paired since stays alone until it is taken live again.
   */
  keepShape?: boolean
  /** Take this member off the screen for this projection only. */
  hiddenSlideId?: string | null
}

/**
 * The live payload for a slide: its pair's members when it belongs to one,
 * otherwise the slide itself. `slide` wins over the stored copy of itself, so
 * an edit that has not reached the store yet is what goes on screen.
 */
export const livePayloadForSlide = (
  slide: Slide,
  options: ProjectOptions = {}
): LivePayload => {
  const appStore = useAppStore()
  const pair = appStore.pairForSlide(slide.id)
  if (!pair) return slide
  if (options.keepShape && appStore.currentState.livePairId !== pair.id) {
    return slide
  }
  const slidesById = new Map(appStore.activeSlidesById)
  slidesById.set(slide.id, slide)
  const hiddenSlideId =
    options.hiddenSlideId !== undefined
      ? options.hiddenSlideId
      : heldOffScreen.get(pair.id)
  return stampPairForLive(pair, slidesById, { hiddenSlideId }) ?? slide
}

/**
 * Puts a slide on this device's screen: as a single slide, or with the rest of
 * its pair when it belongs to one. The one place that decides which, so every
 * go-live path (the grid, the schedule list, remote control, edits to what is
 * already live) agrees on what is projected.
 *
 * While a pair is live `liveSlideId` is its driven member, which keeps Up/Down,
 * remote control and the stage feed on the slide with verses or playback.
 */
export const projectLiveSlide = (slide: Slide, options: ProjectOptions = {}) => {
  const appStore = useAppStore()
  const payload = livePayloadForSlide(slide, options)
  if (Array.isArray(payload)) {
    const pair = appStore.pairForSlide(slide.id)!
    appStore.setLivePair(pair.id)
    const drivenId = payload[0]!.livePair!.activeSlideId
    if (appStore.currentState.liveSlideId !== drivenId) {
      appStore.setLiveSlide(drivenId)
    }
    useBroadcastPost(payload)
    return payload
  }
  appStore.setLivePair(null)
  if (appStore.currentState.liveSlideId !== slide.id) {
    appStore.setLiveSlide(slide.id)
  }
  useBroadcastPost(slide)
  return payload
}

/**
 * A member of the live pair is being deleted. The pair dissolves, as the API
 * dissolves it, and the other member stays on screen on its own, so deleting
 * the words never takes the camera off the screen. Returns false when the
 * slide is not in the live pair, which leaves the caller's own handling.
 */
export const dropFromLivePair = (slideId: string) => {
  const appStore = useAppStore()
  const livePair = appStore.livePair
  if (!livePair?.slideIds.includes(slideId)) return false
  const remainingId = livePair.slideIds.find((id) => id !== slideId)
  const remaining = remainingId
    ? appStore.activeSlidesById.get(remainingId)
    : undefined
  appStore.detachSlidesFromPairs([slideId])
  if (remaining) projectLiveSlide(remaining)
  else {
    appStore.setLiveSlide("")
    useBroadcastPost(null)
  }
  return true
}

/**
 * Asks for microphone permission from the operator window, so turning a
 * camera's microphone on never leaves a browser prompt on the projector in
 * the middle of a service. The stream is closed straight away.
 */
export const primeMicrophonePermission = async (deviceId?: string | null) => {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { ideal: deviceId } } : true,
    })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

// ── Pair cache ──────────────────────────────────────────────────────────────
// The store holds the active schedule's pairs only. Every schedule's last
// known pairs are kept here, so switching schedule offline still shows them.

const pairCacheKey = (scheduleId: string) => `slide-pairs:${scheduleId}`

const readCachedPairs = async (scheduleId: string): Promise<SlidePair[]> => {
  const record = (await safeDBOperation((db) =>
    db.cached.get(pairCacheKey(scheduleId))
  )) as { content?: SlidePair[] } | undefined
  return Array.isArray(record?.content) ? record!.content : []
}

const writeCachedPairs = (scheduleId: string, pairs: SlidePair[]) => {
  const now = new Date().toISOString()
  // Not awaited: a failed write only costs an offline schedule switch.
  safeDBOperation((db) =>
    db.cached.put({
      id: pairCacheKey(scheduleId),
      content: JSON.parse(JSON.stringify(pairs.filter((pair) => !pair.pending))),
      createdAt: now,
      updatedAt: now,
    } as any)
  )
}

// Updates in flight, per pair. Only the newest may roll a pair back, so a
// failed older change never undoes a later one that worked.
const latestUpdate = new Map<string, number>()
let updateSequence = 0
let flushingPendingPairs: Promise<void> | null = null

/**
 * Slide pairs: REST through useAPIFetch, optimistic store writes, and the
 * socket events that keep teammates in step. Pairs are schedule structure, so
 * they ride the operator room only; livestream viewers see a pair when its
 * members go live as an array.
 */
export default function useSlidePairs() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const online = useOnline()

  const churchId = () => authStore.church?._id || authStore.user?.churchId
  const basePath = (scheduleId: string) =>
    `/church/${churchId()}/schedules/${scheduleId}/slide-pairs`

  const emitSocket = (event: string, data: Record<string, unknown>) => {
    if (!online.value) return
    const socket = useNuxtApp().$socketio as any
    if (!socket?.connected) return
    socket.emit(event, { ...data, tabId: tabSessionId })
  }

  const sendSlidePairCreated = (pair: SlidePair) =>
    emitSocket("create-slide-pair", { pair: toPairBody(pair) })
  const sendSlidePairUpdated = (pair: SlidePair) =>
    emitSocket("update-slide-pair", { pair: toPairBody(pair) })
  const sendSlidePairDeleted = (pair: Pick<SlidePair, "id" | "slideIds">) =>
    emitSocket("delete-slide-pair", { pairId: pair.id, slideIds: pair.slideIds })

  const errorMessage = (error: unknown) =>
    (error as any)?.data?.msg || (error as any)?.data?.message

  const isActiveSchedule = (scheduleId: string) =>
    appStore.currentState.activeSchedule?._id === scheduleId

  /** Pairs made offline for a schedule, which the server does not have yet. */
  const pendingPairs = (scheduleId?: string) =>
    appStore.allSlidePairs.filter(
      (pair) => pair.pending && (!scheduleId || pair.scheduleId === scheduleId)
    )

  /** The schedule's last known pairs, from this device. Shown before a fetch. */
  const loadCachedPairs = async (scheduleId: string) => {
    const cached = await readCachedPairs(scheduleId)
    if (!isActiveSchedule(scheduleId)) return
    appStore.setSlidePairs(scheduleId, [...cached, ...pendingPairs(scheduleId)])
  }

  const fetchSchedulePairs = async (scheduleId?: string) => {
    const targetScheduleId = scheduleId || appStore.currentState.activeSchedule?._id
    if (!targetScheduleId) return []
    await loadCachedPairs(targetScheduleId)
    if (!online.value || !churchId()) return []
    // Pairs made offline go up first, so the list below already holds them.
    await flushPendingPairs()
    const { data, error } = await useAPIFetch(basePath(targetScheduleId), {
      method: "GET",
      key: `get-schedule-pairs-${targetScheduleId}`,
    })
    if (error.value || !Array.isArray(data.value)) return []
    const pairs = (data.value as SlidePair[])
      .map((pair) => normalizePair(pair))
      .filter((pair): pair is SlidePair => !!pair)
    writeCachedPairs(targetScheduleId, pairs)
    // A schedule switch may have landed while this was in flight: the cache
    // keeps these, and the store only ever holds the active schedule's.
    if (isActiveSchedule(targetScheduleId)) {
      const saved = new Set(pairs.map((pair) => pair.id))
      appStore.setSlidePairs(targetScheduleId, [
        ...pairs,
        ...pendingPairs(targetScheduleId).filter((pair) => !saved.has(pair.id)),
      ])
    }
    return pairs
  }

  /** Re-projects the live pair after its layout, sound or members change. */
  const republishLivePair = (pairId: string) => {
    if (appStore.currentState.livePairId !== pairId) return
    const pair = appStore.slidePairsById.get(pairId)
    const driven = pair ? appStore.activeSlidesById.get(drivenMemberOf(pair)) : undefined
    if (driven) projectLiveSlide(driven)
  }

  /**
   * The API only pairs slides it already holds. A slide made seconds ago may
   * still be in the offline upload queue, so give that a few chances to land.
   */
  const postPair = async (pair: SlidePair) => {
    const notUploaded = () =>
      pair.slideIds.some((id) => !appStore.activeSlidesById.get(id)?._id)
    const post = () =>
      useAPIFetch(basePath(pair.scheduleId), {
        method: "POST",
        body: toPairBody(pair),
      })
    for (let attempt = 0; attempt < 4; attempt++) {
      if (notUploaded()) {
        useGlobalEmit("upload-offline-slides")
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
        if (notUploaded()) continue
      }
      const result = await post()
      if (!result.error.value) return result
      // 404 is "a slide is not on the server yet"; anything else is final.
      if (getAPIErrorStatus(result.error.value) !== 404) return result
    }
    return await post()
  }

  /**
   * Saves the pairs made offline, now the connection is back. Each one waits
   * for its slides to upload first (see postPair). One run at a time.
   */
  const flushPendingPairs = async () => {
    if (flushingPendingPairs) return flushingPendingPairs
    flushingPendingPairs = (async () => {
      for (const pair of pendingPairs()) {
        if (!online.value) break
        const { data, error } = await postPair(pair)
        const current = appStore.slidePairsById.get(pair.id)
        if (!current) continue
        if (!error.value) {
          // Anything changed while it was offline went up with the POST.
          const saved = {
            ...current,
            ...normalizePair(data.value as SlidePair),
            pending: false,
          }
          appStore.upsertSlidePair(saved)
          sendSlidePairCreated(saved)
          continue
        }
        const status = getAPIErrorStatus(error.value)
        if (status === 404 || status === 409 || status === 400) {
          appStore.removeSlidePair(pair.id)
          republishLivePair(pair.id)
          toast.add({
            icon: "i-bx-error",
            title: "A pair made offline couldn't be saved",
            description: errorMessage(error.value),
            color: "red",
          })
        }
        // Anything else (a network blip): it stays pending for next time.
      }
    })().finally(() => {
      flushingPendingPairs = null
    })
    return flushingPendingPairs
  }

  /**
   * Pairs `slides` in order: the first is the main slide (left, or full
   * screen in picture-in-picture). One of them must be a camera; callers check
   * with pairRejection, and the API refuses a pair without one.
   */
  const createPair = async (
    slides: Slide[],
    options: { layout?: SlidePairLayout } = {}
  ): Promise<SlidePair | null> => {
    const scheduleId = appStore.currentState.activeSchedule?._id
    if (!scheduleId || slides.length < 2) return null

    const pair: SlidePair = {
      id: useObjectID(),
      scheduleId,
      slideIds: slides.map((slide) => slide.id),
      activeSlideId: "",
      layout: options.layout || "side-by-side",
      audioSlideId: null,
    }
    pair.activeSlideId =
      drivenMemberId(pair.slideIds, (id) =>
        slides.find((slide) => slide.id === id)
      ) || pair.slideIds[0]!

    usePosthogCapture("SLIDE_PAIR_CREATED", {
      slideTypes: slides.map((slide) => slide.type).join("+"),
    })

    // Offline: the pair stands here and goes up once the connection and its
    // slides are back (flushPendingPairs). Teammates hear of it then.
    if (!online.value) {
      const pending = { ...pair, pending: true }
      appStore.upsertSlidePair(pending)
      return pending
    }

    appStore.upsertSlidePair(pair)
    const { data, error } = await postPair(pair)
    if (error.value) {
      appStore.removeSlidePair(pair.id)
      const status = getAPIErrorStatus(error.value)
      toast.add({
        icon: "i-bx-error",
        title:
          status === 409
            ? "One of these slides is already in a pair"
            : "Couldn't pair these slides",
        description: errorMessage(error.value),
        color: "red",
      })
      return null
    }

    const saved = {
      ...(appStore.slidePairsById.get(pair.id) || pair),
      ...normalizePair(data.value as SlidePair),
      id: pair.id,
      scheduleId,
    }
    appStore.upsertSlidePair(saved)
    sendSlidePairCreated(saved)
    return saved
  }

  type PairChanges = Partial<
    Pick<SlidePair, "layout" | "audioSlideId" | "slideIds" | "hiddenSlideId">
  > &
    SlidePairBackground

  /**
   * Changes how a pair shows. Applied here and on screen at once, so layout
   * and hide stay instant during a service; teammates hear of it once the
   * server has it. A refusal puts the pair back as it was.
   */
  const updatePair = async (pairId: string, changes: PairChanges) => {
    const current = appStore.slidePairsById.get(pairId)
    if (!current) return null
    // Order only: a swap may reorder the pair's slides, never change them.
    if (
      changes.slideIds &&
      (changes.slideIds.length !== current.slideIds.length ||
        !changes.slideIds.every((id) => current.slideIds.includes(id)))
    ) {
      return null
    }
    const next = { ...current, ...changes }
    appStore.upsertSlidePair(next)
    republishLivePair(pairId)

    // Not on the server yet: the change goes up with the pair itself.
    if (current.pending) return next

    const seq = ++updateSequence
    latestUpdate.set(pairId, seq)
    const { data, error } = await useAPIFetch(`${basePath(next.scheduleId)}/${pairId}`, {
      method: "PUT",
      body: changes,
    })
    const isLatest = latestUpdate.get(pairId) === seq
    if (isLatest) latestUpdate.delete(pairId)

    if (!error.value) {
      const saved = appStore.slidePairsById.get(pairId)
      if (saved) {
        const updatedAt = (data.value as SlidePair | null)?.updatedAt
        if (updatedAt) appStore.upsertSlidePair({ ...saved, updatedAt })
        sendSlidePairUpdated(appStore.slidePairsById.get(pairId) || saved)
      }
      return next
    }

    // Offline: useAPIFetch queued the PUT and replays it once back online.
    if (!online.value) return next

    const status = getAPIErrorStatus(error.value)
    if (status === 404) {
      // Unpaired somewhere else while this was in flight.
      const wasLive = appStore.currentState.livePairId === pairId
      const driven = appStore.activeSlidesById.get(drivenMemberOf(next))
      appStore.removeSlidePair(pairId)
      if (wasLive && driven) projectLiveSlide(driven)
      toast.add({
        icon: "i-bx-info-circle",
        title: "This pair was unpaired on another device",
      })
      return null
    }
    if (isLatest) {
      appStore.upsertSlidePair(current)
      republishLivePair(pairId)
      toast.add({
        icon: "i-bx-error",
        title: "Couldn't change the pair",
        description: errorMessage(error.value),
        color: "red",
      })
    }
    return null
  }

  const deletePair = async (pairId: string) => {
    const pair = appStore.slidePairsById.get(pairId)
    if (!pair) return
    const wasLive = appStore.currentState.livePairId === pairId
    const driven = appStore.activeSlidesById.get(drivenMemberOf(pair))

    appStore.removeSlidePair(pairId)
    editingMembers.delete(pairId)
    heldOffScreen.delete(pairId)
    // The live screen keeps the slide it was driven by.
    if (wasLive && driven) projectLiveSlide(driven)
    usePosthogCapture("SLIDE_PAIR_DELETED")
    if (pair.pending) return

    const { error } = await useAPIFetch(`${basePath(pair.scheduleId)}/${pairId}`, {
      method: "DELETE",
    })
    if (!error.value || getAPIErrorStatus(error.value) === 404) {
      sendSlidePairDeleted(pair)
      return
    }
    // Offline: queued, and replayed once back online.
    if (!online.value) {
      sendSlidePairDeleted(pair)
      return
    }
    // Refused: the pair is still on the server, so it comes back here too.
    appStore.upsertSlidePair(pair)
    toast.add({
      icon: "i-bx-error",
      title: "Couldn't unpair these slides",
      description: errorMessage(error.value),
      color: "red",
    })
  }

  /**
   * Reverses the pair's order. Roles follow slide type first, so this is what
   * decides which slide is the picture when both slides, or neither, are one.
   */
  const swapPair = (pairId: string) => {
    const pair = appStore.slidePairsById.get(pairId)
    if (!pair) return null
    return updatePair(pairId, { slideIds: [...pair.slideIds].reverse() })
  }

  /**
   * Takes a member off the screen, or puts it back. Only one member can be
   * off at a time, so hiding one shows the other.
   */
  const toggleHidden = (pairId: string, slideId: string) => {
    const pair = appStore.slidePairsById.get(pairId)
    if (!pair || !pair.slideIds.includes(slideId)) return null
    const hiddenSlideId = pair.hiddenSlideId === slideId ? null : slideId
    usePosthogCapture("SLIDE_PAIR_MEMBER_HIDDEN", { hidden: !!hiddenSlideId })
    return updatePair(pairId, { hiddenSlideId })
  }

  /** Turns a camera's microphone on for the pair, or every microphone off. */
  const setMicrophone = async (pairId: string, cameraId: string | null) => {
    const pair = appStore.slidePairsById.get(pairId)
    if (!pair || (cameraId && !pair.slideIds.includes(cameraId))) return null
    if (cameraId) {
      const allowed = await primeMicrophonePermission(
        appStore.currentState.defaultMicrophoneId
      )
      if (!allowed) {
        toast.add({
          icon: "i-bx-error",
          title: "Microphone not available",
          description: "Allow microphone access for Cloud of Worship, then try again.",
          color: "red",
        })
        return null
      }
    }
    usePosthogCapture("SLIDE_PAIR_MICROPHONE", { on: !!cameraId })
    return updatePair(pairId, { audioSlideId: cameraId })
  }

  /**
   * Puts `incomingId` in the place of `outgoingId`, in the same pair: layout,
   * background, hidden member and microphone carry over, and a live pair stays
   * live showing the new member. Membership is the server's to change (it
   * claims and releases the slides), so this waits for it.
   */
  const replaceMember = async (
    pairId: string,
    outgoingId: string,
    incomingId: string
  ) => {
    const current = appStore.slidePairsById.get(pairId)
    if (
      !current ||
      !current.slideIds.includes(outgoingId) ||
      current.slideIds.includes(incomingId)
    ) {
      return null
    }
    if (!online.value || current.pending) {
      toast.add({
        icon: "i-tabler-cloud-off",
        title: "Reconnect to change a pair's slides",
        color: "amber",
      })
      return null
    }

    const { data, error } = await useAPIFetch(
      `${basePath(current.scheduleId)}/${pairId}/replace`,
      { method: "POST", body: { outgoingId, incomingId } }
    )
    const saved = normalizePair(data.value as SlidePair)
    if (error.value || !saved) {
      toast.add({
        icon: "i-bx-error",
        title: "Couldn't change the paired slide",
        description: errorMessage(error.value),
        color: "red",
      })
      return null
    }

    const next = { ...current, ...saved, id: pairId }
    appStore.upsertSlidePair(next)
    if (editingMembers.get(pairId) === outgoingId) {
      editingMembers.set(pairId, incomingId)
    }
    republishLivePair(pairId)
    sendSlidePairUpdated(next)
    return next
  }

  /**
   * Moves a pair's other slide to sit straight after `anchorId` in the
   * schedule, once, when the pair is made. From then on its members are always
   * next to each other, so a reorder of the pair's row never has to move
   * slides the operator did not touch. Same path as a drag reorder: indexes
   * saved through batch-update-slides, teammates told through reorder-slides.
   */
  const keepPairTogether = (pair: SlidePair, anchorId: string) => {
    const scheduleSlides = appStore.activeScheduleSlides
    const anchorIndex = scheduleSlides.findIndex((slide) => slide.id === anchorId)
    if (anchorIndex === -1) return
    const others = pair.slideIds.filter((id) => id !== anchorId)
    const adjacent = others.every(
      (id, offset) => scheduleSlides[anchorIndex + 1 + offset]?.id === id
    )
    if (adjacent) return
    const moving = others
      .map((id) => appStore.activeSlidesById.get(id))
      .filter((slide): slide is Slide => !!slide)
    const rest = scheduleSlides.filter((slide) => !others.includes(slide.id))
    const at = rest.findIndex((slide) => slide.id === anchorId) + 1
    const ordered = [...rest.slice(0, at), ...moving, ...rest.slice(at)].map(
      (slide, index) => ({ ...slide, index })
    )
    appStore.replaceScheduleActiveSlides(ordered)
    useGlobalEmit(appWideActions.batchUpdateSlides, ordered)
    emitSocket("reorder-slides", {
      slideOrder: ordered.map((slide) => slide.id),
      reorderedByName: authStore.user?.fullname || "Anonymous",
    })
  }

  return {
    keepPairTogether,
    replaceMember,
    fetchSchedulePairs,
    loadCachedPairs,
    flushPendingPairs,
    createPair,
    updatePair,
    deletePair,
    swapPair,
    toggleHidden,
    setMicrophone,
    republishLivePair,
    sendSlidePairCreated,
    sendSlidePairUpdated,
    sendSlidePairDeleted,
  }
}

/**
 * Saves pairs made offline as soon as the connection is back. Called once,
 * from the operator's schedule view, which lives as long as the console.
 */
export const useSlidePairSync = () => {
  const online = useOnline()
  const { flushPendingPairs } = useSlidePairs()
  watch(online, (isOnline) => {
    if (isOnline) void flushPendingPairs()
  })
  onMounted(() => {
    if (online.value) void flushPendingPairs()
  })
}
