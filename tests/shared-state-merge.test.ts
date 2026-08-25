import { describe, expect, it } from "vitest"
import { mergeSharedStateValue } from "~/utils/sharedStateMerge"

describe("mergeSharedStateValue", () => {
  it("preserves activeSlides when the incoming currentState omits it", () => {
    const activeSlides = [{ id: "operator-slide" }]
    const current = {
      activeSlides,
      liveSlideId: null,
      settings: { animations: true, slideStyles: { fontSize: 80 } },
    }
    const incoming = {
      liveSlideId: "operator-slide",
      settings: { animations: false },
    }

    const merged = mergeSharedStateValue(current, incoming)

    expect(merged.activeSlides).toBe(activeSlides)
    expect(merged.liveSlideId).toBe("operator-slide")
    expect(merged.settings).toEqual({
      animations: false,
      slideStyles: { fontSize: 80 },
    })
  })

  it("replaces arrays that are present in the incoming snapshot", () => {
    expect(
      mergeSharedStateValue(
        { schedules: [{ _id: "old" }] },
        { schedules: [{ _id: "new" }] }
      )
    ).toEqual({ schedules: [{ _id: "new" }] })
  })

  it("applies explicit null values instead of preserving stale state", () => {
    expect(
      mergeSharedStateValue(
        { activeSchedule: { _id: "sunday" } },
        { activeSchedule: null }
      )
    ).toEqual({ activeSchedule: null })
  })
})

