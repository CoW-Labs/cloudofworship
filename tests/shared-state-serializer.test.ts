import { describe, expect, it } from "vitest"
import { sharedStateSerializer } from "~/utils/sharedStateSerializer"

const slide = (i: number) => ({
  id: `slide-${i}`,
  type: "song",
  contents: [`Verse line ${i} `.repeat(20)],
  slideStyle: { blur: 0, brightness: 100, fontSize: 100 },
  data: { title: `Song ${i}`, lyrics: "lyric line ".repeat(120) },
})

const makeState = (slideCount: number, undoDepth: number) => {
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
    // Each undo entry is a shallow clone that holds its own activeSlides array,
    // so it expands to a full copy of the corpus when serialized.
    pastStates: Array.from({ length: undoDepth }, () => ({
      ...currentState,
      activeSlides: [...activeSlides],
    })),
    futureStates: [],
    panelSizes: { left: 20 },
    panelSizesTouched: {},
  }
}

const roundTrip = (state: unknown) =>
  sharedStateSerializer.deserialize(sharedStateSerializer.serialize(state))

describe("sharedStateSerializer", () => {
  it("drops the undo stacks from the broadcast payload", () => {
    const out = roundTrip(makeState(20, 10))
    expect(out.pastStates).toBeUndefined()
    expect(out.futureStates).toBeUndefined()
  })

  it("preserves every field a receiving window applies", () => {
    const state = makeState(20, 10)
    const out = roundTrip(state)
    expect(out.currentState).toEqual(state.currentState)
    expect(out.currentState.activeSlides).toHaveLength(20)
    expect(out.panelSizes).toEqual({ left: 20 })
    expect(out.panelSizesTouched).toEqual({})
  })

  it("is a no-op for shared stores that have no undo stack", () => {
    const auth = { user: { _id: "u1" }, token: "abc", church: { _id: "c1" } }
    expect(roundTrip(auth)).toEqual(auth)
  })

  it("keeps the payload proportional to the corpus, not to undo depth", () => {
    const state = makeState(200, 50)
    const before = JSON.stringify(state).length
    const after = sharedStateSerializer.serialize(state).length
    // 50 undo entries each carrying the full corpus means the naive payload is
    // an order of magnitude larger than the data anyone actually reads.
    expect(before / after).toBeGreaterThan(20)
  })
})
