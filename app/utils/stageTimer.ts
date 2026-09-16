import type { StageStopwatchState, StageTimerState } from "~/types"

/**
 * Pure helpers for the stage display's clock — the service stopwatch, and the
 * countdowns an operator sends to the stage only. Kept out of the composable
 * so the Pinia store can build and repair the state, and so the transitions
 * can be tested without a store or a window.
 */

export const defaultStageTimerState = (): StageTimerState => ({
  mode: "stopwatch",
  running: false,
  startedAt: 0,
  elapsedMs: 0,
  durationMs: 0,
  message: "",
  serviceTimer: null,
  updatedAt: 0,
})

/**
 * A clock untouched for this long belongs to a service that finished. The
 * state is persisted with the rest of `currentState`, so without this the
 * stage screen would open on Sunday still counting from last Sunday.
 */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000

/**
 * A snapshot restored from localStorage — or one sent by a window running an
 * older build — can be missing fields or carry rubbish in them. Every reader
 * goes through here so a bad value shows 00:00:00 rather than NaN.
 */
export const normaliseStageTimer = (
  value: unknown,
  now: number = Date.now()
): StageTimerState => {
  const timer = (value || {}) as Partial<StageTimerState>
  const number = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) && input >= 0
      ? input
      : 0
  const serviceTimer = timer.serviceTimer as Partial<StageStopwatchState> | null
  const mode =
    timer.mode === "countdown" && number(timer.durationMs) > 0
      ? "countdown"
      : "stopwatch"

  const normalised: StageTimerState = {
    // A countdown with no duration has nothing to count, so it reads as the
    // stopwatch rather than sitting at 00:00:00 for ever.
    mode,
    running: timer.running === true,
    startedAt: number(timer.startedAt),
    elapsedMs: number(timer.elapsedMs),
    durationMs: number(timer.durationMs),
    message: typeof timer.message === "string" ? timer.message : "",
    serviceTimer:
      mode === "countdown" && serviceTimer && typeof serviceTimer === "object"
        ? {
            running: serviceTimer.running === true,
            startedAt: number(serviceTimer.startedAt),
            elapsedMs: number(serviceTimer.elapsedMs),
          }
        : null,
    updatedAt: number(timer.updatedAt),
  }

  const lastTouched = Math.max(normalised.updatedAt, normalised.startedAt)
  if (lastTouched && now - lastTouched > STALE_AFTER_MS) {
    return defaultStageTimerState()
  }

  return normalised
}

/**
 * How long the clock has been running, in milliseconds. Measured against the
 * wall clock rather than accumulated per tick, so a clock left running for a
 * whole service does not drift with a throttled background tab.
 */
export const stageTimerElapsed = (
  timer: StageTimerState,
  now: number = Date.now()
) =>
  timer.running
    ? Math.max(0, now - timer.startedAt)
    : Math.max(0, timer.elapsedMs)

/** What is left of a countdown, in milliseconds. Never negative. */
export const stageTimerRemaining = (
  timer: StageTimerState,
  now: number = Date.now()
) => Math.max(0, timer.durationMs - stageTimerElapsed(timer, now))

/** The number the stage screen shows: time left on a countdown, else time run. */
export const stageTimerReading = (
  timer: StageTimerState,
  now: number = Date.now()
) =>
  timer.mode === "countdown"
    ? stageTimerRemaining(timer, now)
    : stageTimerElapsed(timer, now)

/** A countdown that has reached zero. Always false for the stopwatch. */
export const isStageCountdownFinished = (
  timer: StageTimerState,
  now: number = Date.now()
) => timer.mode === "countdown" && stageTimerRemaining(timer, now) === 0

export const isStageTimerIdle = (timer: StageTimerState) =>
  timer.mode === "stopwatch" && !timer.running && timer.elapsedMs === 0

/**
 * The commands, as pure transitions. Each returns the state the clock should
 * be in, or the very state it was given when the command changes nothing.
 */

/**
 * Back to the beginning and counting — zero for the stopwatch, the full
 * duration for a countdown — whatever the clock was doing before.
 */
export const restartedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState => ({
  ...timer,
  running: true,
  startedAt: now,
  elapsedMs: 0,
  updatedAt: now,
})

/**
 * Start from zero, or pick back up from where a pause left it. A countdown
 * that already reached zero starts over from its full duration, since that is
 * the only thing "start" can usefully mean once there is nothing left to run.
 */
export const startedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState => {
  if (timer.running) return timer
  if (isStageCountdownFinished(timer, now)) {
    return restartedStageTimer(timer, now)
  }

  return {
    ...timer,
    running: true,
    startedAt: now - timer.elapsedMs,
    updatedAt: now,
  }
}

/** Pause, banking the reading so a later start resumes from it. */
export const stoppedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState =>
  timer.running
    ? {
        ...timer,
        running: false,
        startedAt: 0,
        elapsedMs: stageTimerElapsed(timer, now),
        updatedAt: now,
      }
    : timer

/** Back to the beginning, leaving a running clock running and a paused one paused. */
export const resetStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState => ({
  ...timer,
  startedAt: now,
  elapsedMs: 0,
  updatedAt: now,
})

/**
 * Load a countdown onto the stage screen and start it. A duration of zero has
 * nothing to count, so it clears the countdown instead of showing 00:00:00.
 */
export const stageCountdownFrom = (
  timer: StageTimerState,
  durationMs: number,
  message: string = "",
  now: number = Date.now()
): StageTimerState =>
  durationMs > 0
    ? {
        mode: "countdown",
        running: true,
        startedAt: now,
        elapsedMs: 0,
        durationMs,
        message,
        serviceTimer:
          timer.mode === "countdown"
            ? timer.serviceTimer
            : {
                running: timer.running,
                startedAt: timer.startedAt,
                elapsedMs: timer.elapsedMs,
              },
        updatedAt: now,
      }
    : clearedStageTimer(timer, now)

/** Take the countdown off the stage screen, handing the panel back to the stopwatch. */
export const clearedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState => {
  if (timer.mode !== "countdown") return timer
  return {
    ...defaultStageTimerState(),
    ...(timer.serviceTimer || {}),
    updatedAt: now,
  }
}
