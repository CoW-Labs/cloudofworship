import type { Ref } from "vue"
import { useAppStore } from "~/store/app"
import type { Countdown, Slide } from "~/types"
import useStageNextContent from "~/composables/useStageNextContent"
import {
  buildStageStreamState,
  isSameStageStream,
  type StageStreamState,
} from "~/utils/stageStream"

/** The two things this feed needs from the operator's socket. */
interface StageStreamSocket {
  isConnected: () => boolean
  sendStageState: (state: StageStreamState) => boolean
}

/**
 * Feeds `/stagestream/:schedule_id` from the operator console.
 *
 * The stage display needs more than the live slide — the next verse, the next
 * slide, the position in the schedule, the stage timer — and a viewer on a
 * band member's phone has none of what it takes to work those out: no Bible
 * translations, no schedule. So the console that is running the service works
 * the stage view out exactly as the local `/stage` window does, and sends the
 * finished text.
 *
 * Idle until the server reports a stage viewer: resolving NEXT reads scripture
 * and hymns, and no console should pay for that while nobody is watching.
 * A console driving another device's output stays quiet, as it does for the
 * livestream, and the server only accepts the feed from whichever console last
 * took something live — so teammates' consoles cannot fight over the screen.
 */
export const useStageStreamFeed = (options: {
  getSocket: () => StageStreamSocket | null | undefined
  hasRemoteTarget: Ref<boolean>
}) => {
  const appStore = useAppStore()
  const viewerCount = ref(0)

  const active = computed(
    () => viewerCount.value > 0 && !options.hasRemoteTarget.value
  )

  // Null while idle, which is what keeps the NEXT lookup from running at all.
  const liveSlide = computed<Slide | null>(() => {
    if (!active.value) return null
    const liveSlideId = appStore.currentState.liveSlideId
    if (!liveSlideId) return null
    return (
      appStore.activeSlides.find((slide) => slide.id === liveSlideId) ?? null
    )
  })

  const scheduleSlides = computed<Slide[]>(() =>
    active.value ? appStore.activeScheduleSlides || [] : []
  )

  const { nextContent, pending } = useStageNextContent(liveSlide, scheduleSlides)

  // "Slide 4 of 12" counts today's service. A live slide from another schedule
  // finds no index and reports 0, which the timer panel reads as "no position".
  const position = computed(() => {
    const id = liveSlide.value?.id
    if (!id) return 0
    return scheduleSlides.value.findIndex((slide) => slide.id === id) + 1
  })

  // When the running countdown last wrote its remaining time, so the time spent
  // waiting to send can be taken off it. See `stageStreamCountdown`.
  let countdownObservedAt = Date.now()
  watch(
    () => (liveSlide.value?.data as Countdown | undefined)?.remainingMs,
    () => {
      countdownObservedAt = Date.now()
    }
  )

  let lastSent: StageStreamState | null = null
  let sendTimer: ReturnType<typeof setTimeout> | null = null

  const send = () => {
    sendTimer = null
    const socket = options.getSocket()
    // `pending` means NEXT is still resolving for a change that has already
    // landed; sending now would pair the new NOW with the old NEXT. Its settling
    // re-triggers the watcher below.
    if (!active.value || pending.value || !socket?.isConnected()) return

    const state = buildStageStreamState({
      slide: liveSlide.value,
      next: nextContent.value,
      position: position.value,
      count: scheduleSlides.value.length,
      timer: appStore.currentState.stageTimer,
      sentAt: Date.now(),
      countdownObservedAt,
    })
    if (isSameStageStream(lastSent, state)) return
    if (socket.sendStageState(state)) lastSent = state
  }

  // Coalesce a burst — a verse change moves NOW, then NEXT, then the position —
  // into one message built from wherever it all settled.
  const scheduleSend = () => {
    if (sendTimer) return
    sendTimer = setTimeout(send, 120)
  }

  watch(
    [
      active,
      liveSlide,
      nextContent,
      pending,
      position,
      () => scheduleSlides.value.length,
      () => appStore.currentState.stageTimer,
    ],
    scheduleSend
  )

  /**
   * Take the stage-viewer count from the socket. Returns true when the event
   * was this feed's, so the caller can skip its own handling.
   */
  const handleMessage = (event: string, data: any) => {
    if (event !== "stage-viewers") return false

    const count = Math.max(0, Number(data?.count) || 0)
    // A viewer just arrived. The server replays the last state it holds, but
    // nothing was sent while nobody watched, so that copy can be stale — send
    // the current one even if it matches what this console sent last.
    if (count > viewerCount.value) lastSent = null
    viewerCount.value = count
    scheduleSend()
    return true
  }

  /** Forget everything tied to the old connection (schedule switch, unmount). */
  const reset = () => {
    viewerCount.value = 0
    lastSent = null
    if (sendTimer) clearTimeout(sendTimer)
    sendTimer = null
  }

  onScopeDispose(reset)

  return { handleMessage, reset, viewerCount }
}
