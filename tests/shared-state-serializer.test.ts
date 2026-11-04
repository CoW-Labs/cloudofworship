import { describe, expect, it } from "vitest"
import { sharedStateSerializer } from "~/utils/sharedStateSerializer"

const slide = (i: number) => ({
  id: `slide-${i}`,
  type: "song",
  contents: [`Verse line ${i} `.repeat(20)],
  slideStyle: { blur: 0, brightness: 100, fontSize: 100 },
  data: { title: `Song ${i}`, lyrics: "lyric line ".repeat(120) },
})

const makeState = (slideCount: number) => {
  const activeSlides = Array.from({ length: slideCount }, (_, i) => slide(i))
  const currentState = {
    activeSlides,
    liveSlideId: "slide-3",
    settings: { slideStyles: { windowPadding: { top: 1 } }, animations: true },
    schedules: [{ _id: "sch1", name: "Sunday" }],
    activeOverlaySlide: null,
    emitter: null,
  }
  return {
    currentState,
    panelSizes: { left: 20 },
    panelSizesTouched: {},
  }
}

const roundTrip = (state: unknown) =>
  sharedStateSerializer.deserialize(sharedStateSerializer.serialize(state))

describe("sharedStateSerializer", () => {
  it("preserves lightweight shared state and omits the slide corpus", () => {
    const state = makeState(20)
    const out = roundTrip(state)
    expect(out.currentState.activeSlides).toBeUndefined()
    expect(out.currentState.liveSlideId).toBe(state.currentState.liveSlideId)
    expect(out.currentState.settings).toEqual(state.currentState.settings)
    expect(out.currentState.schedules).toEqual(state.currentState.schedules)
    expect(out.panelSizes).toEqual({ left: 20 })
    expect(out.panelSizesTouched).toEqual({})
  })

  it("is a no-op for shared stores that hold no slides", () => {
    const auth = { user: { _id: "u1" }, token: "abc", church: { _id: "c1" } }
    expect(roundTrip(auth)).toEqual(auth)
  })

  it("keeps the payload independent of the corpus", () => {
    const state = makeState(200)
    const before = JSON.stringify(state).length
    const after = sharedStateSerializer.serialize(state).length
    // The corpus is an order of magnitude larger than the data anyone reads.
    expect(before / after).toBeGreaterThan(10)
  })
})
