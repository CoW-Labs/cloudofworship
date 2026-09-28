import { describe, expect, it } from "vitest"
import type { Slide } from "~/types"
import { slideTypes } from "~/utils/constants"
import { defaultStageTimerState } from "~/utils/stageTimer"
import {
  buildStageStreamState,
  isSameStageStream,
  isStageStreamState,
  stageStreamClockOffset,
  stageStreamCountdown,
  stageStreamCountdownLeft,
} from "~/utils/stageStream"
import { stageNextView, stageNowView } from "~/utils/stageView"

const NOW = 1_700_000_000_000

const slide = (over: Partial<Slide> = {}) =>
  ({
    id: "slide-1",
    name: "Amazing Grace",
    type: slideTypes.text,
    contents: ["<p>Amazing grace</p>"],
    ...over,
  } as unknown as Slide)

const countdownSlide = (over: Record<string, any> = {}, playing = true) =>
  slide({
    type: slideTypes.countdown,
    name: "Service starts",
    data: { id: "c", time: "00:05:00", timeLeft: "00:04:00", content: "Doors", ...over } as any,
    slideStyle: { isMediaPlaying: playing } as any,
  })

const build = (over: Partial<Parameters<typeof buildStageStreamState>[0]> = {}) =>
  buildStageStreamState({
    slide: slide(),
    next: null,
    position: 1,
    count: 3,
    timer: defaultStageTimerState(),
    sentAt: NOW,
    ...over,
  })

describe("stage views", () => {
  it("describes nothing live", () => {
    expect(stageNowView(null)).toMatchObject({ text: "", placeholder: "Nothing is live yet" })
    expect(stageNextView(null, null)).toMatchObject({ label: "", placeholder: "Waiting for the operator" })
  })

  it("names the next slide when the live one is finished", () => {
    const view = stageNextView(slide(), {
      text: "Verse two",
      label: "",
      slideName: "How Great",
      source: "slide",
    })
    expect(view).toMatchObject({ label: "Up next • How Great", text: "Verse two", icon: "i-bx-slideshow" })
  })

  it("says the schedule has ended when nothing follows", () => {
    expect(stageNextView(slide(), null)).toMatchObject({
      placeholder: "End of schedule",
      icon: "i-bx-check-circle",
    })
  })
})

describe("stage stream state", () => {
  it("carries text, never the slide itself", () => {
    const state = build()
    expect(state).toMatchObject({ version: 1, isLive: true, slideName: "Amazing Grace", position: 1, count: 3 })
    expect(state.now.text).toContain("Amazing grace")
    expect(JSON.stringify(state)).not.toContain("contents")
  })

  it("takes the wait before sending off a running countdown", () => {
    const countdown = stageStreamCountdown(countdownSlide({ remainingMs: 240_000 }), NOW + 300, NOW)
    expect(countdown).toEqual({ content: "Doors", remainingMs: 239_700, running: true })
  })

  it("reads a paused countdown from what it shows", () => {
    const countdown = stageStreamCountdown(countdownSlide({ remainingMs: undefined }, false), NOW)
    expect(countdown).toEqual({ content: "Doors", remainingMs: 240_000, running: false })
  })

  it("has no countdown for other slides", () => {
    expect(stageStreamCountdown(slide(), NOW)).toBeNull()
  })

  it("treats a later state with nothing new as the same", () => {
    expect(isSameStageStream(build(), build({ sentAt: NOW + 5000 }))).toBe(true)
    expect(isSameStageStream(null, build())).toBe(false)
    expect(isSameStageStream(build(), build({ position: 2 }))).toBe(false)
  })

  it("does not resend a running countdown every second", () => {
    const first = build({ slide: countdownSlide({ remainingMs: 240_000 }), sentAt: NOW })
    const secondLater = build({ slide: countdownSlide({ remainingMs: 239_000 }), sentAt: NOW + 1000 })
    expect(isSameStageStream(first, secondLater)).toBe(true)

    const restarted = build({ slide: countdownSlide({ remainingMs: 300_000 }), sentAt: NOW + 1000 })
    expect(isSameStageStream(first, restarted)).toBe(false)
  })

  it("resends when a countdown pauses", () => {
    const running = build({ slide: countdownSlide({ remainingMs: 240_000 }) })
    const paused = build({ slide: countdownSlide({ remainingMs: undefined }, false), sentAt: NOW + 1000 })
    expect(isSameStageStream(running, paused)).toBe(false)
  })

  it("rejects anything that is not a stage state", () => {
    expect(isStageStreamState(build())).toBe(true)
    expect(isStageStreamState({ version: 2, sentAt: NOW })).toBe(false)
    expect(isStageStreamState({ id: "slide-1" })).toBe(false)
    expect(isStageStreamState(null)).toBe(false)
  })
})

describe("stage stream clock", () => {
  it("reads the console's clock, including time the server held a replay", () => {
    // The console's clock is 5s ahead; the replay sat on the server for 2s.
    const state = { ...build({ sentAt: NOW + 5000 }), ageMs: 2000 }
    expect(stageStreamClockOffset(state, NOW + 2000)).toBe(5000)
  })

  it("counts a streamed countdown down on the viewer", () => {
    const countdown = { content: "", remainingMs: 60_000, running: true }
    expect(stageStreamCountdownLeft(countdown, NOW, NOW + 15_000)).toBe(45_000)
    expect(stageStreamCountdownLeft(countdown, NOW, NOW + 90_000)).toBe(0)
    expect(stageStreamCountdownLeft({ ...countdown, running: false }, NOW, NOW + 15_000)).toBe(60_000)
  })
})
