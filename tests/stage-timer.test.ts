import { describe, expect, it } from "vitest"
import {
  clearedStageTimer,
  defaultStageTimerState,
  isStageCountdownFinished,
  isStageTimerIdle,
  normaliseStageTimer,
  resetStageTimer,
  restartedStageTimer,
  stageCountdownFrom,
  stageTimerElapsed,
  stageTimerReading,
  stageTimerRemaining,
  startedStageTimer,
  stoppedStageTimer,
} from "~/utils/stageTimer"

const NOW = 1_700_000_000_000
const MINUTE = 60_000

describe("stage stopwatch transitions", () => {
  it("starts an untouched timer from zero", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)

    expect(started.running).toBe(true)
    expect(stageTimerReading(started, NOW)).toBe(0)
    expect(stageTimerReading(started, NOW + 5_000)).toBe(5_000)
  })

  it("resumes from the reading a stop banked", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)
    const stopped = stoppedStageTimer(started, NOW + 90_000)

    expect(stopped.running).toBe(false)
    expect(stopped.elapsedMs).toBe(90_000)
    // Time passes while it is paused; the reading must not move.
    expect(stageTimerReading(stopped, NOW + 300_000)).toBe(90_000)

    const resumed = startedStageTimer(stopped, NOW + 300_000)
    expect(stageTimerReading(resumed, NOW + 300_000)).toBe(90_000)
    expect(stageTimerReading(resumed, NOW + 310_000)).toBe(100_000)
  })

  it("leaves a running timer alone when started again", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)

    expect(startedStageTimer(started, NOW + 10_000)).toBe(started)
  })

  it("leaves a stopped timer alone when stopped again", () => {
    const stopped = stoppedStageTimer(
      startedStageTimer(defaultStageTimerState(), NOW),
      NOW + 1_000
    )

    expect(stoppedStageTimer(stopped, NOW + 2_000)).toBe(stopped)
  })

  it("restarts from zero and keeps counting, whatever it was doing", () => {
    const paused = stoppedStageTimer(
      startedStageTimer(defaultStageTimerState(), NOW),
      NOW + 600_000
    )
    const restarted = restartedStageTimer(paused, NOW + 700_000)

    expect(paused.elapsedMs).toBe(600_000)
    expect(restarted.running).toBe(true)
    expect(stageTimerReading(restarted, NOW + 700_000)).toBe(0)
    expect(stageTimerReading(restarted, NOW + 701_000)).toBe(1_000)
  })

  it("resets to zero without changing whether the timer is running", () => {
    const running = startedStageTimer(defaultStageTimerState(), NOW)
    const paused = stoppedStageTimer(running, NOW + 5_000)

    const resetRunning = resetStageTimer(running, NOW + 5_000)
    expect(resetRunning.running).toBe(true)
    expect(stageTimerReading(resetRunning, NOW + 5_000)).toBe(0)

    const resetPaused = resetStageTimer(paused, NOW + 5_000)
    expect(resetPaused.running).toBe(false)
    expect(resetPaused.elapsedMs).toBe(0)
  })

  it("stamps every transition so windows can settle a race", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)

    expect(started.updatedAt).toBe(NOW)
    expect(stoppedStageTimer(started, NOW + 1).updatedAt).toBe(NOW + 1)
    expect(restartedStageTimer(started, NOW + 2).updatedAt).toBe(NOW + 2)
    expect(resetStageTimer(started, NOW + 3).updatedAt).toBe(NOW + 3)
  })
})

describe("stage countdown", () => {
  const fiveMinutes = () =>
    stageCountdownFrom(defaultStageTimerState(), 5 * MINUTE, "Back in five", NOW)

  it("counts down from its duration and carries its message", () => {
    const countdown = fiveMinutes()

    expect(countdown.mode).toBe("countdown")
    expect(countdown.running).toBe(true)
    expect(countdown.message).toBe("Back in five")
    expect(stageTimerReading(countdown, NOW)).toBe(5 * MINUTE)
    expect(stageTimerReading(countdown, NOW + MINUTE)).toBe(4 * MINUTE)
  })

  it("stops at zero rather than going negative", () => {
    const countdown = fiveMinutes()

    expect(stageTimerRemaining(countdown, NOW + 10 * MINUTE)).toBe(0)
    expect(isStageCountdownFinished(countdown, NOW + 10 * MINUTE)).toBe(true)
    expect(isStageCountdownFinished(countdown, NOW + MINUTE)).toBe(false)
  })

  it("holds its remaining time across a pause", () => {
    const paused = stoppedStageTimer(fiveMinutes(), NOW + 2 * MINUTE)

    expect(stageTimerReading(paused, NOW + 30 * MINUTE)).toBe(3 * MINUTE)

    const resumed = startedStageTimer(paused, NOW + 30 * MINUTE)
    expect(stageTimerReading(resumed, NOW + 30 * MINUTE)).toBe(3 * MINUTE)
    expect(stageTimerReading(resumed, NOW + 31 * MINUTE)).toBe(2 * MINUTE)
  })

  it("restarts from the full duration, keeping the message", () => {
    const restarted = restartedStageTimer(fiveMinutes(), NOW + 4 * MINUTE)

    expect(restarted.mode).toBe("countdown")
    expect(restarted.message).toBe("Back in five")
    expect(stageTimerReading(restarted, NOW + 4 * MINUTE)).toBe(5 * MINUTE)
  })

  it("starts a finished countdown over instead of leaving it at zero", () => {
    const finished = fiveMinutes()
    const stopped = stoppedStageTimer(finished, NOW + 9 * MINUTE)
    expect(stageTimerReading(stopped, NOW + 9 * MINUTE)).toBe(0)

    const restarted = startedStageTimer(stopped, NOW + 10 * MINUTE)
    expect(restarted.running).toBe(true)
    expect(stageTimerReading(restarted, NOW + 10 * MINUTE)).toBe(5 * MINUTE)
  })

  it("is cleared back to the stopwatch", () => {
    const cleared = clearedStageTimer(fiveMinutes(), NOW + MINUTE)

    expect(cleared.mode).toBe("stopwatch")
    expect(cleared.durationMs).toBe(0)
    expect(cleared.message).toBe("")
    expect(cleared.updatedAt).toBe(NOW + MINUTE)
  })

  it("refuses a countdown with no duration", () => {
    expect(
      stageCountdownFrom(defaultStageTimerState(), 0, "Nothing to count", NOW)
        .mode
    ).toBe("stopwatch")
  })

  it("keeps the service stopwatch running underneath a countdown", () => {
    const serviceTimer = startedStageTimer(defaultStageTimerState(), NOW)
    const countdown = stageCountdownFrom(
      serviceTimer,
      5 * MINUTE,
      "Back in five",
      NOW + 35 * MINUTE
    )
    const replaced = stageCountdownFrom(
      countdown,
      3 * MINUTE,
      "Three more minutes",
      NOW + 36 * MINUTE
    )
    const restored = clearedStageTimer(replaced, NOW + 38 * MINUTE)

    expect(stageTimerReading(restored, NOW + 38 * MINUTE)).toBe(38 * MINUTE)
    expect(restored.running).toBe(true)
    expect(restored.serviceTimer).toBeNull()
  })

  it("restores a paused service stopwatch at its original reading", () => {
    const serviceTimer = stoppedStageTimer(
      startedStageTimer(defaultStageTimerState(), NOW),
      NOW + 12 * MINUTE
    )
    const countdown = stageCountdownFrom(
      serviceTimer,
      5 * MINUTE,
      "",
      NOW + 20 * MINUTE
    )
    const restored = clearedStageTimer(countdown, NOW + 25 * MINUTE)

    expect(restored.running).toBe(false)
    expect(stageTimerReading(restored, NOW + 25 * MINUTE)).toBe(12 * MINUTE)
  })

  it("does not reset the service timer when no countdown is active", () => {
    const serviceTimer = startedStageTimer(defaultStageTimerState(), NOW)

    expect(clearedStageTimer(serviceTimer, NOW + 10 * MINUTE)).toBe(serviceTimer)
    expect(stageTimerReading(serviceTimer, NOW + 10 * MINUTE)).toBe(10 * MINUTE)
  })

  it("never reports the stopwatch as a finished countdown", () => {
    const running = startedStageTimer(defaultStageTimerState(), NOW)

    expect(isStageCountdownFinished(running, NOW + MINUTE)).toBe(false)
    expect(stageTimerReading(running, NOW + MINUTE)).toBe(MINUTE)
  })
})

describe("normaliseStageTimer", () => {
  it("repairs a snapshot with missing or nonsense fields", () => {
    expect(normaliseStageTimer(undefined, NOW)).toEqual(
      defaultStageTimerState()
    )
    expect(
      normaliseStageTimer(
        { running: "yes", startedAt: NaN, elapsedMs: -5, updatedAt: NOW },
        NOW
      )
    ).toEqual({ ...defaultStageTimerState(), updatedAt: NOW })
  })

  it("reads a countdown with no duration as the stopwatch", () => {
    const broken = normaliseStageTimer(
      { mode: "countdown", running: true, startedAt: NOW, updatedAt: NOW },
      NOW
    )

    expect(broken.mode).toBe("stopwatch")
    expect(isStageCountdownFinished(broken, NOW)).toBe(false)
  })

  it("keeps a snapshot written by a build that had no countdown mode", () => {
    const legacy = normaliseStageTimer(
      { running: true, startedAt: NOW - MINUTE, elapsedMs: 0, updatedAt: NOW },
      NOW
    )

    expect(legacy.mode).toBe("stopwatch")
    expect(stageTimerElapsed(legacy, NOW)).toBe(MINUTE)
  })

  it("restores a persisted service timer after a countdown", () => {
    const serviceTimer = startedStageTimer(defaultStageTimerState(), NOW)
    const countdown = stageCountdownFrom(
      serviceTimer,
      5 * MINUTE,
      "",
      NOW + MINUTE
    )
    const restored = clearedStageTimer(
      normaliseStageTimer(JSON.parse(JSON.stringify(countdown)), NOW + 2 * MINUTE),
      NOW + 2 * MINUTE
    )

    expect(stageTimerReading(restored, NOW + 2 * MINUTE)).toBe(2 * MINUTE)
  })

  it("drops a clock left over from a previous service", () => {
    const lastSunday = NOW - 7 * 24 * 60 * 60 * 1000
    const staleRun = startedStageTimer(defaultStageTimerState(), lastSunday)

    expect(normaliseStageTimer(staleRun, NOW)).toEqual(defaultStageTimerState())
    // Today's timer survives the same read.
    expect(normaliseStageTimer(staleRun, lastSunday + 60_000)).toEqual(staleRun)
  })
})

describe("isStageTimerIdle", () => {
  it("is true only when the clock has nothing to report", () => {
    expect(isStageTimerIdle(defaultStageTimerState())).toBe(true)

    const running = startedStageTimer(defaultStageTimerState(), NOW)
    expect(isStageTimerIdle(running)).toBe(false)
    expect(isStageTimerIdle(stoppedStageTimer(running, NOW + 1_000))).toBe(false)
  })

  it("is false while a countdown is loaded, even a paused one", () => {
    const countdown = stageCountdownFrom(defaultStageTimerState(), 5 * MINUTE, "", NOW)

    expect(isStageTimerIdle(countdown)).toBe(false)
    expect(isStageTimerIdle(stoppedStageTimer(countdown, NOW + MINUTE))).toBe(
      false
    )
  })
})
