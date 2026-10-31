import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"
import { livePayloadForSlide } from "~/composables/useSlidePairs"

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

export const useOperatorSession = () => {
  const appStore = useAppStore()
  const toast = useToast()
  const emitter = useNuxtApp().$emitter as Emitter<any>
  const socketInstance = ref<ReturnType<typeof useSocketIO> | null>(null)
  const liveOutputControl = useLiveOutputControl()
  const stageStreamFeed = useStageStreamFeed({
    getSocket: () => socketInstance.value,
    hasRemoteTarget: liveOutputControl.hasRemoteTarget,
  })

  const {
    handleWebSocketMessage,
    updateOnlineUsers,
    cleanup: cleanupRealtimeSlides,
  } = useRealtimeSlides({
    onSlideUpdated: () => {
      // Silent update - no toast for every update to avoid noise
    },
    onSlideCreated: (slide, createdByName) => {
      toast.add({
        title: `${createdByName} added ${describeSlides([slide])}`,
        icon: "i-tabler-plus",
        color: "blue",
        timeout: 3000,
      })
    },
    onSlideDeleted: (slide, deletedByName) => {
      toast.add({
        title: `${deletedByName} deleted ${describeSlides([slide])}`,
        icon: "i-tabler-trash",
        color: "amber",
        timeout: 3000,
      })
    },
    onBatchSlidesCreated: (slides, createdByName) => {
      toast.add({
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

    socketInstance.value = useSocketIO({
      scheduleId,
      onMessage: (event, data) => {
        if (stageStreamFeed.handleMessage(event, data?.data)) return
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
  watch(
    () => [appStore.currentState.liveSlideId, livePairSignature.value] as const,
    ([liveSlideId]) => {
      if (!socketInstance.value?.isConnected()) return

      // While this device is driving another device's output, that device is
      // the one with a slide on screen — and it broadcasts this same feed. A
      // controller staying quiet is what keeps livestream viewers on a single
      // source of truth instead of two devices overwriting each other. This is
      // a derived condition, not a flag some other code has to remember to
      // clear: it is true for exactly as long as a host is selected.
      if (liveOutputControl.hasRemoteTarget.value) return

      // Blank clears liveSlideId (see goBlank in LiveOutput). Send
      // an explicit null so viewers blank out instead of holding the last slide.
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
    // Lets a stage display on this computer tell a closed console from a
    // quiet one.
    stopPresence = announceOperatorPresence()
  })

  onBeforeUnmount(() => {
    stopPresence?.()
    stopPresence = null
    liveOutputControl.stop()
    disconnectSocket()
  })

  return { socketInstance, connectSocket, disconnectSocket }
}
