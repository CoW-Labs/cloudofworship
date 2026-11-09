import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide, SlidePair } from "~/types"
import { livePayloadForSlide } from "~/composables/useSlidePairs"
import useCameraShare from "~/composables/useCameraShare"
import { useOnline } from "@vueuse/core"
import { isSessionMediaUrl } from "~/utils/mediaTransport"

/**
 * The realtime session shared by every operator surface.
 *
 * Both operator routes — the desktop console (`/`) and the mobile route
 * (`/mobile`) — need the exact same thing: one Socket.IO connection scoped to
 * the active schedule, incoming slide events applied to the store, presence
 * kept current, the live slide fed to `/livestream/:code` viewers, and
 * the stage display fed to `/stagestream/:code` viewers.
 *
 * This lived inline in pages/index.vue until the mobile route needed it too.
 * Duplicating it would have been the worst outcome available: two connections
 * with slightly different reconnect and cleanup behaviour, diverging the moment
 * either one is touched. Owning it here means a phone and a laptop in the same
 * service are provably running the same session code.
 *
 * Connects on mount (when a schedule is active), reconnects when the active
 * schedule changes, and disconnects on unmount. Callers do not manage any of it.
 */
/**
 * Names slides for a teammate toast: `"Amazing Grace"`, `"Amazing Grace" and
 * "John 3:16"`, or `"Amazing Grace" and 4 other slides`. Unnamed slides fall
 * back to "a slide" / "N slides".
 */
const describeSlides = (slides: Slide[]): string => {
  const names = slides.map((s) => s.name?.trim()).filter(Boolean) as string[]
  if (names.length !== slides.length || !names.length) {
    return slides.length === 1 ? "a slide" : `${slides.length} slides`
  }
  const [first, second] = names.map((n) => `"${n}"`)
  if (names.length === 1) return first!
  if (names.length === 2) return `${first} and ${second}`
  const others = names.length - 1
  return `${first} and ${others} other slides`
}

const PAIR_TOAST_COOLDOWN_MS = 5000

const isExternalVideo = (slide: Slide) => {
  const type = (slide.data as any)?.type
  return type === "youtube" || type === "vimeo"
}

const bearsMedia = (slide: Slide) =>
  !isExternalVideo(slide) &&
  (slide.type === slideTypes.media ||
    slide.type === slideTypes.presentation ||
    !!slide.backgroundImageKey ||
    !!slide.backgroundVideoKey)

// The cloud URLs a slide's media can be pulled from. Empty while a teammate's
// upload is still running: the slide arrives first and its hosted URL in a
// later update, which is when the download can start.
const remoteMediaSources = (slide: Slide) =>
  [
    slide.background,
    (slide.data as any)?.url,
    ...(slide.presentationObjects || []).map((page) => page.imageUrl),
  ]
    .filter(
      (url): url is string =>
        typeof url === "string" &&
        /^https?:\/\//.test(url) &&
        !isSessionMediaUrl(url)
    )
    .join("|")

export const useOperatorSession = () => {
  const appStore = useAppStore()
  const toast = useToast()
  const teammateToast = useTeammateToast()
  const pairToastAt = new Map<string, number>()
  // A pair's members by name: "Camera" and "John 3:16".
  const describePair = (pair: SlidePair) =>
    describeSlides(
      pair.slideIds
        .map((id) => appStore.activeSlidesById.get(id))
        .filter(Boolean) as Slide[]
    )
  const emitter = useNuxtApp().$emitter as Emitter<any>
  const socketInstance = ref<ReturnType<typeof useSocketIO> | null>(null)
  const liveOutputControl = useLiveOutputControl()
  const cameraShare = useCameraShare()
  const stageStreamFeed = useStageStreamFeed({
    getSocket: () => socketInstance.value,
    hasRemoteTarget: liveOutputControl.hasRemoteTarget,
  })

  // A slide a teammate adds while this schedule is open used to wait until it
  // went live before its media came down, and Go Live then sat on the whole
  // download. Pull it now, in the background, as opening the schedule does.
  // Not on /mobile (mobile data, and the phone projects nothing) and not while
  // this device drives another computer's screen, which projects from its own
  // copy.
  const route = useRoute()
  const online = useOnline()
  const { rehydrateSlideMediaWithStatus } = useSlideMediaCache()
  const prefetchedSources = new Map<string, string>()
  const prefetchTeammateMedia = async (incoming: Slide[]) => {
    if (route.path.startsWith("/mobile")) return
    if (liveOutputControl.hasRemoteTarget.value || !online.value) return
    const slides = incoming
      .map((slide) => appStore.activeSlidesById.get(slide.id))
      .filter((slide): slide is Slide => {
        if (!slide || !bearsMedia(slide)) return false
        const sources = remoteMediaSources(slide)
        if (!sources || prefetchedSources.get(slide.id) === sources) return false
        prefetchedSources.set(slide.id, sources)
        return true
      })
    if (!slides.length) return

    let pending = 0
    // Two at a time, like the schedule prefetch, so a batch of videos does not
    // split a weak connection a dozen ways.
    for (let index = 0; index < slides.length; index += 2) {
      const results = await Promise.all(
        slides.slice(index, index + 2).map((slide) =>
          rehydrateSlideMediaWithStatus(slide, { allowDownload: true }).catch(
            () => ({ pendingKeys: ["error"] })
          )
        )
      )
      pending += results.filter((result) => result.pendingKeys.length).length
    }
    usePosthogCapture("TEAMMATE_MEDIA_PREFETCHED", {
      count: slides.length,
      pending,
    })
    if (pending) {
      usePosthogCapture("TEAMMATE_MEDIA_PREFETCH_FAILED", { count: pending })
    }
  }
  const prefetchInBackground = (slides: Slide[]) => {
    prefetchTeammateMedia(slides).catch((error) =>
      console.warn("Teammate media prefetch failed:", error)
    )
  }

  const {
    handleWebSocketMessage,
    updateOnlineUsers,
    cleanup: cleanupRealtimeSlides,
  } = useRealtimeSlides({
    onSlideUpdated: (slide) => {
      // Silent update - no toast for every update to avoid noise. A teammate's
      // upload finishing arrives this way, carrying the hosted URL.
      prefetchInBackground([slide])
    },
    onBatchSlidesUpdated: (slides) => prefetchInBackground(slides),
    onSlideCreated: (slide, createdByName, createdBy) => {
      prefetchInBackground([slide])
      teammateToast(createdBy, {
        title: `${createdByName} added ${describeSlides([slide])}`,
        icon: "i-tabler-plus",
        color: "blue",
        timeout: 3000,
      })
    },
    onSlideDeleted: (slide, deletedByName, deletedBy) => {
      teammateToast(deletedBy, {
        title: `${deletedByName} deleted ${describeSlides([slide])}`,
        icon: "i-tabler-trash",
        color: "amber",
        timeout: 3000,
      })
    },
    onSlidePairCreated: (pair, createdByName, createdBy) => {
      teammateToast(createdBy, {
        title: `${createdByName || "A teammate"} paired ${describePair(pair)}`,
        icon: "i-tabler-layout-columns",
        color: "blue",
        timeout: 3000,
      })
    },
    onSlidePairUpdated: (pair, updatedByName, updatedBy) => {
      // Flipping layouts or the mic sends a change per click. One toast per pair
      // in a short window is enough.
      const now = Date.now()
      if (now - (pairToastAt.get(pair.id) ?? 0) < PAIR_TOAST_COOLDOWN_MS) return
      pairToastAt.set(pair.id, now)
      teammateToast(updatedBy, {
        title: `${updatedByName || "A teammate"} changed the pair ${describePair(pair)}`,
        icon: "i-tabler-layout-columns",
        color: "blue",
        timeout: 3000,
      })
    },
    onSetlistSongsAdded: (setlist, songs, addedByName, addedBy) => {
      const [first] = songs
      const what =
        songs.length === 1
          ? first?.title?.trim()
            ? `"${first.title.trim()}"`
            : "a song"
          : `${songs.length} songs`
      // "Song Setlist 1 (4 songs)" reads better here without its count.
      const target =
        setlist.name?.replace(/\s*\(\d+ songs?\)$/, "").trim() || "the setlist"
      teammateToast(addedBy, {
        title: `${addedByName || "A teammate"} added ${what} to ${target}`,
        icon: "i-lucide-list-music",
        color: "blue",
        timeout: 3000,
      })
    },
    onBatchSlidesCreated: (slides, createdByName, createdBy) => {
      prefetchInBackground(slides)
      teammateToast(createdBy, {
        title: `${createdByName} added ${describeSlides(slides)}`,
        icon: "i-tabler-plus",
        color: "blue",
        timeout: 3000,
      })
    },
  })

  const connectSocket = async () => {
    const scheduleId = appStore.currentState.activeSchedule?._id
    if (!scheduleId) return

    // Sockets now retry forever, so one replaced here without being closed
    // would keep a second connection (and a second presence) alive for good.
    socketInstance.value?.disconnect()

    socketInstance.value = useSocketIO({
      scheduleId,
      onMessage: (event, data) => {
        if (stageStreamFeed.handleMessage(event, data?.data)) return
        if (cameraShare.handleMessage(event, data?.data)) return
        handleWebSocketMessage(data)
      },
      onConnected: () => {
        // Delivery state belongs to one admitted socket connection. The server
        // may have restarted, even when it reports the same viewer count.
        stageStreamFeed.reset()
        // Re-advertise this device's live output (if it has one) as soon as
        // there is a socket to say it on, rather than leaving a phone to wait
        // out a heartbeat before the screen it wants shows up in its list.
        liveOutputControl.announce()
        // Say which cameras this computer has, and hear teammates' cameras.
        cameraShare.onConnected()
        // A slide taken live while the socket was down never reached the
        // livestream. Send what is on screen now that it can.
        if (liveSlideUnsent) sendCurrentLiveSlide()

        const wasReconnected =
          socketInstance.value?.isReconnecting?.value === false &&
          socketInstance.value?.isConnectedRef?.value === true

        if (wasReconnected) {
          toast.add({
            title: "Connection restored",
            icon: "i-tabler-wifi",
            color: "green",
            timeout: 3000,
          })
        }
      },
      onDisconnected: () => {
        stageStreamFeed.reset()
      },
      onOnlineUsersChanged: (users) => {
        updateOnlineUsers(users)
        appStore.setOnlineUsers(users)
      },
      onUserJoined: (user) => {
        appStore.triggerUserJoinedAnimation(user)
        // Your own second device (say /mobile) joining is not news to you.
        if (user.userId !== useAuthStore().user?._id) {
          teammateToast(user.userId, {
            title: `${user.userName || "A teammate"} joined`,
            icon: "i-tabler-user-plus",
            color: "blue",
            timeout: 3000,
          })
        }
        // Whoever just arrived may be the phone looking for a screen to drive.
        liveOutputControl.announce()
      },
    })

    socketInstance.value.connect()

    watch(
      () => socketInstance.value?.isConnectedRef?.value,
      (isConnected, wasConnected) => {
        if (isConnected && wasConnected === false) {
          toast.add({
            title: "Connection restored",
            icon: "i-tabler-wifi",
            color: "green",
            timeout: 3000,
          })
        } else if (!isConnected && wasConnected === true) {
          toast.add({
            title: "Connection lost. Reconnecting...",
            icon: "i-tabler-wifi-off",
            color: "yellow",
            timeout: 3000,
          })
        }
      }
    )
  }

  const disconnectSocket = () => {
    socketInstance.value?.disconnect()
    stageStreamFeed.reset()
    cameraShare.reset()
    cleanupRealtimeSlides()
    appStore.setOnlineUsers([])
  }

  // Feed the slide that is currently on screen to livestream viewers. Nothing
  // else broadcasts it, so /livestream/:code stays blank without this.
  //
  // A live slide pair goes out as its members' array. Its layout, hidden
  // member, microphone, order and backdrop are part of what is on screen, so
  // changing any re-sends it; member content edits travel as `update-slide`,
  // as for a single slide. Which member the operator is editing is not.
  const livePairSignature = computed(() => {
    const pair = appStore.livePair
    return pair
      ? [
          pair.id,
          pair.layout,
          pair.audioSlideId ?? "",
          pair.hiddenSlideId ?? "",
          pair.slideIds.join(","),
          pair.backgroundType ?? "",
          pair.background ?? "",
        ].join("|")
      : ""
  })
  // Set when what is on screen changed while the socket was down, and cleared
  // once it is sent. Only this device's own changes set it, so a console that
  // was offline does not replay a stale slide over a teammate's newer one.
  let liveSlideUnsent = false

  const sendCurrentLiveSlide = () => {
    // While this device is driving another device's output, that device is
    // the one with a slide on screen — and it broadcasts this same feed. A
    // controller staying quiet is what keeps livestream viewers on a single
    // source of truth instead of two devices overwriting each other. This is
    // a derived condition, not a flag some other code has to remember to
    // clear: it is true for exactly as long as a host is selected.
    if (liveOutputControl.hasRemoteTarget.value) {
      liveSlideUnsent = false
      return
    }

    if (!socketInstance.value?.isConnected()) {
      liveSlideUnsent = true
      return
    }
    liveSlideUnsent = false

    // Blank clears liveSlideId (see goBlank in LiveOutput). Send
    // an explicit null so viewers blank out instead of holding the last slide.
    const liveSlideId = appStore.currentState.liveSlideId
    if (!liveSlideId) {
      socketInstance.value.sendLiveSlide(null)
      return
    }

    const liveSlide = appStore.activeSlidesById.get(liveSlideId)
    if (liveSlide) {
      socketInstance.value.sendLiveSlide(
        livePayloadForSlide(liveSlide, { keepShape: true })
      )
    }
  }

  watch(
    () => [appStore.currentState.liveSlideId, livePairSignature.value] as const,
    sendCurrentLiveSlide
  )

  // Watch for schedule changes to reconnect Socket
  watch(
    () => appStore.currentState.activeSchedule?._id,
    (newScheduleId, oldScheduleId) => {
      if (newScheduleId === oldScheduleId) return

      liveOutputControl.resetForScheduleChange()
      disconnectSocket()
      if (newScheduleId) {
        setTimeout(() => {
          connectSocket()
        }, 500)
      }
    }
  )

  emitter.on("refresh-slides", () => {
    if (!socketInstance.value?.isConnected()) {
      connectSocket()
    }
  })

  let stopPresence: (() => void) | null = null

  onMounted(() => {
    if (appStore.currentState.activeSchedule) {
      connectSocket()
    }
    // Advertises this device's output (when it has one) and listens for the
    // devices offering theirs. Started here so both operator routes get it on
    // the same terms as the socket itself.
    liveOutputControl.start()
    // Shares this computer's cameras with teammates, and theirs with it.
    cameraShare.start()
    // Lets a stage display on this computer tell a closed console from a
    // quiet one.
    stopPresence = announceOperatorPresence()
  })

  onBeforeUnmount(() => {
    stopPresence?.()
    stopPresence = null
    liveOutputControl.stop()
    cameraShare.stop()
    disconnectSocket()
  })

  return { socketInstance, connectSocket, disconnectSocket }
}
