import { describe, expect, it } from "vitest"
import {
  defaultStageTimerState,
  isStageTimerIdle,
  normaliseStageTimer,
  resetStageTimer,
  restartedStageTimer,
  stageTimerElapsed,
  startedStageTimer,
  stoppedStageTimer,
} from "~/utils/stageTimer"

const NOW = 1_700_000_000_000

describe("stage timer transitions", () => {
  it("starts an untouched timer from zero", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)

    expect(started.running).toBe(true)
    expect(stageTimerElapsed(started, NOW)).toBe(0)
    expect(stageTimerElapsed(started, NOW + 5_000)).toBe(5_000)
  })

  it("resumes from the reading a stop banked", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)
    const stopped = stoppedStageTimer(started, NOW + 90_000)

    expect(stopped.running).toBe(false)
    expect(stopped.elapsedMs).toBe(90_000)
    // Time passes while it is paused; the reading must not move.
    expect(stageTimerElapsed(stopped, NOW + 300_000)).toBe(90_000)

    const resumed = startedStageTimer(stopped, NOW + 300_000)
    expect(stageTimerElapsed(resumed, NOW + 300_000)).toBe(90_000)
    expect(stageTimerElapsed(resumed, NOW + 310_000)).toBe(100_000)
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
    const restarted = restartedStageTimer(NOW + 700_000)

    expect(paused.elapsedMs).toBe(600_000)
    expect(restarted.running).toBe(true)
    expect(stageTimerElapsed(restarted, NOW + 700_000)).toBe(0)
    expect(stageTimerElapsed(restarted, NOW + 701_000)).toBe(1_000)
  })

  it("resets to zero without changing whether the timer is running", () => {
    const running = startedStageTimer(defaultStageTimerState(), NOW)
    const paused = stoppedStageTimer(running, NOW + 5_000)

    expect(resetStageTimer(running, NOW + 5_000).running).toBe(true)
    expect(stageTimerElapsed(resetStageTimer(running, NOW + 5_000), NOW + 5_000))
      .toBe(0)
    expect(resetStageTimer(paused, NOW + 5_000).running).toBe(false)
    expect(resetStageTimer(paused, NOW + 5_000).elapsedMs).toBe(0)
  })

  it("stamps every transition so windows can settle a race", () => {
    const started = startedStageTimer(defaultStageTimerState(), NOW)

    expect(started.updatedAt).toBe(NOW)
    expect(stoppedStageTimer(started, NOW + 1).updatedAt).toBe(NOW + 1)
    expect(restartedStageTimer(NOW + 2).updatedAt).toBe(NOW + 2)
    expect(resetStageTimer(started, NOW + 3).updatedAt).toBe(NOW + 3)
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
    ).toEqual({ running: false, startedAt: 0, elapsedMs: 0, updatedAt: NOW })
  })

  it("drops a timer left over from a previous service", () => {
    const lastSunday = NOW - 7 * 24 * 60 * 60 * 1000
    const staleRun = startedStageTimer(defaultStageTimerState(), lastSunday)

    expect(normaliseStageTimer(staleRun, NOW)).toEqual(defaultStageTimerState())
    // Today's timer survives the same read.
    expect(normaliseStageTimer(staleRun, lastSunday + 60_000)).toEqual(staleRun)
  })
})

describe("isStageTimerIdle", () => {
  it("is true only when the timer has nothing to report", () => {
    expect(isStageTimerIdle(defaultStageTimerState())).toBe(true)

    const running = startedStageTimer(defaultStageTimerState(), NOW)
    expect(isStageTimerIdle(running)).toBe(false)
    expect(isStageTimerIdle(stoppedStageTimer(running, NOW + 1_000))).toBe(false)
  })
})
