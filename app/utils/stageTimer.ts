import type { StageTimerState } from "~/types"

/**
 * Pure helpers for the stage display's count-up timer. Kept out of the
 * composable so the Pinia store can build and repair the state without
 * importing the window-to-window transport that drives it.
 */

export const defaultStageTimerState = (): StageTimerState => ({
  running: false,
  startedAt: 0,
  elapsedMs: 0,
  updatedAt: 0,
})

/**
 * A timer untouched for this long belongs to a service that finished. The
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

  const normalised: StageTimerState = {
    running: timer.running === true,
    startedAt: number(timer.startedAt),
    elapsedMs: number(timer.elapsedMs),
    updatedAt: number(timer.updatedAt),
  }

  const lastTouched = Math.max(normalised.updatedAt, normalised.startedAt)
  if (lastTouched && now - lastTouched > STALE_AFTER_MS) {
    return defaultStageTimerState()
  }

  return normalised
}

/**
 * The reading, in milliseconds. A running timer is measured against the wall
 * clock rather than accumulated per tick, so a timer left running for a whole
 * service does not drift with a throttled background tab.
 */
export const stageTimerElapsed = (
  timer: StageTimerState,
  now: number = Date.now()
) =>
  timer.running
    ? Math.max(0, now - timer.startedAt)
    : Math.max(0, timer.elapsedMs)

export const isStageTimerIdle = (timer: StageTimerState) =>
  !timer.running && timer.elapsedMs === 0

/**
 * The three commands, as pure transitions. They live here rather than in the
 * composable so the semantics — resume from a pause, bank the reading when
 * stopping, always count from zero on a restart — can be tested without a
 * store or a window.
 */

/** Start from zero, or pick back up from where a pause left it. */
export const startedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState =>
  timer.running
    ? timer
    : {
        running: true,
        startedAt: now - timer.elapsedMs,
        elapsedMs: timer.elapsedMs,
        updatedAt: now,
      }

/** Pause, banking the reading so a later start resumes from it. */
export const stoppedStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState =>
  timer.running
    ? {
        running: false,
        startedAt: 0,
        elapsedMs: stageTimerElapsed(timer, now),
        updatedAt: now,
      }
    : timer

/** Back to 00:00:00 and counting, whatever the timer was doing before. */
export const restartedStageTimer = (
  now: number = Date.now()
): StageTimerState => ({
  running: true,
  startedAt: now,
  elapsedMs: 0,
  updatedAt: now,
})

/** Back to 00:00:00, leaving a running timer running and a paused one paused. */
export const resetStageTimer = (
  timer: StageTimerState,
  now: number = Date.now()
): StageTimerState => ({
  running: timer.running,
  startedAt: now,
  elapsedMs: 0,
  updatedAt: now,
})
