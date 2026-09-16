import type { Countdown, StageTimerState } from "~/types"
import { useAppStore } from "~/store/app"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"
import useBroadcastMessage from "~/composables/useBroadcastMessage"
import useTimeStringToMilli from "~/composables/useTimeStringToMilli"
import {
  clearedStageTimer,
  isStageTimerIdle,
  normaliseStageTimer,
  resetStageTimer,
  restartedStageTimer,
  stageCountdownFrom,
  startedStageTimer,
  stoppedStageTimer,
} from "~/utils/stageTimer"

/**
 * The stage display's clock, driven from the operator window — the service
 * stopwatch, and the countdowns an operator sends to the stage only.
 *
 * ── Why the state travels twice ─────────────────────────────────────────────
 *
 * `pinia-shared-state` already mirrors `currentState` between browser windows,
 * which is enough on the web and gives a reloaded window its timer back. It is
 * not enough on desktop: each Tauri window is its own webview, and the same
 * caveat that made `useBroadcastPost` mirror slides over Tauri's event bus
 * applies here. So every command is also posted on the live channel, which
 * both transports already cover, and each window applies it to its own store.
 * The two paths converge on identical state, so a doubled delivery is a no-op.
 *
 * Commands are stored, never ticked: start/stop/restart each write once and
 * every window derives its own reading from the wall clock (see
 * `stageTimerElapsed`). Nothing is sent per second.
 */

export type StageTimerBroadcast = {
  kind: "stage-timer"
  timer: StageTimerState
  /** Window that sent it, so a window ignores the echo of its own message. */
  from: string
}

export type StageTimerRequestBroadcast = {
  kind: "stage-timer-request"
  from: string
}

/**
 * Identifies this window for the life of the page. BroadcastChannel delivers a
 * message to every *other* channel object, including the ones this window
 * opened, so without this a window would answer its own state request and
 * overwrite a running timer with an empty one.
 */
const windowId =
  crypto?.randomUUID?.() ||
  `stage-timer-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`

export const isStageTimerBroadcast = (
  payload: unknown
): payload is StageTimerBroadcast =>
  !!payload &&
  typeof payload === "object" &&
  (payload as StageTimerBroadcast).kind === "stage-timer"

export const isStageTimerRequestBroadcast = (
  payload: unknown
): payload is StageTimerRequestBroadcast =>
  !!payload &&
  typeof payload === "object" &&
  (payload as StageTimerRequestBroadcast).kind === "stage-timer-request"

const useStageTimer = () => {
  const appStore = useAppStore()

  const timer = computed(() =>
    normaliseStageTimer(appStore.currentState.stageTimer)
  )
  const isRunning = computed(() => timer.value.running)
  const isCountdown = computed(() => timer.value.mode === "countdown")

  /**
   * Write locally and tell the other windows, in that order. A transition that
   * changed nothing — stopping an already-stopped timer — is not broadcast.
   */
  const publish = (next: StageTimerState) => {
    if (next === timer.value) return timer.value
    appStore.setStageTimer(next)
    postCrossWindowNotification<StageTimerBroadcast>({
      kind: "stage-timer",
      timer: next,
      from: windowId,
    })
    return next
  }

  const start = () => publish(startedStageTimer(timer.value))
  const stop = () => publish(stoppedStageTimer(timer.value))
  const restart = () => publish(restartedStageTimer(timer.value))
  const reset = () => publish(resetStageTimer(timer.value))
  const toggle = () => (timer.value.running ? stop() : start())

  /**
   * Put a countdown on the stage screens and start it. Nothing reaches the
   * congregation's output — this is the confidence monitor only, which is the
   * whole point of sending a countdown here rather than taking a slide live.
   */
  const startCountdown = (countdown: Countdown) =>
    publish(
      stageCountdownFrom(
        useTimeStringToMilli(countdown?.time || "00:00:00"),
        countdown?.content || ""
      )
    )

  /** Take the countdown off the stage screens, handing them back the stopwatch. */
  const clearCountdown = () => publish(clearedStageTimer())

  /**
   * Adopt state another window sent. Out-of-order deliveries lose to the
   * newest write rather than walking the timer backwards.
   */
  const adopt = (incoming: StageTimerState) => {
    const next = normaliseStageTimer(incoming)
    if (next.updatedAt < timer.value.updatedAt) return
    appStore.setStageTimer(next)
  }

  return {
    timer,
    isRunning,
    isCountdown,
    start,
    stop,
    restart,
    reset,
    toggle,
    startCountdown,
    clearCountdown,
    adopt,
    publish,
  }
}

/**
 * Keep this window's copy of the timer in step with the others. Call once from
 * any window that shows or controls the timer — the operator layout and the
 * stage display panel. Cleans itself up with the calling scope.
 */
export const useStageTimerSync = () => {
  const stageTimer = useStageTimer()

  const cleanup = useBroadcastMessage((data) => {
    try {
      const envelope = typeof data === "string" ? JSON.parse(data) : data
      const payload =
        typeof envelope?.payload === "string"
          ? JSON.parse(envelope.payload)
          : envelope?.payload

      if (isStageTimerBroadcast(payload)) {
        if (payload.from === windowId) return
        stageTimer.adopt(payload.timer)
        return
      }

      // A window that just opened asks what the clock is doing. Only a window
      // with something worth reporting answers, so a freshly opened stage
      // screen cannot reset a timer or countdown that is already running.
      if (isStageTimerRequestBroadcast(payload)) {
        if (payload.from === windowId) return
        if (isStageTimerIdle(stageTimer.timer.value)) return
        postCrossWindowNotification<StageTimerBroadcast>({
          kind: "stage-timer",
          timer: stageTimer.timer.value,
          from: windowId,
        })
      }
    } catch (error) {
      console.warn("Stage timer failed to read a broadcast message:", error)
    }
  })

  onMounted(() => {
    postCrossWindowNotification<StageTimerRequestBroadcast>({
      kind: "stage-timer-request",
      from: windowId,
    })
  })

  onScopeDispose(cleanup)

  return stageTimer
}

export default useStageTimer
