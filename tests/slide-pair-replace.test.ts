import { describe, expect, it } from "vitest"
import type { SlidePair } from "~/types"
import { replacePairMember, revertPairMember } from "~/utils/slidePairs"

const cameras = new Set(["cam", "cam2"])
const isCamera = (id: string) => cameras.has(id)

const pair = (overrides: Partial<SlidePair> = {}): SlidePair => ({
  id: "pair",
  scheduleId: "schedule",
  slideIds: ["cam", "words"],
  activeSlideId: "words",
  layout: "side-by-side",
  audioSlideId: null,
  hiddenSlideId: null,
  background: "#000000",
  backgroundType: "solid",
  ...overrides,
})

describe("replacePairMember", () => {
  it("puts the new slide in the old one's place and keeps the look", () => {
    const next = replacePairMember(pair(), "words", "countdown", isCamera)
    expect(next.slideIds).toEqual(["cam", "countdown"])
    expect(next.activeSlideId).toBe("countdown")
    expect(next.layout).toBe("side-by-side")
    expect(next.background).toBe("#000000")
  })

  it("moves a hidden member over to its replacement", () => {
    const next = replacePairMember(
      pair({ hiddenSlideId: "words" }),
      "words",
      "media",
      isCamera
    )
    expect(next.hiddenSlideId).toBe("media")
  })

  it("drops a microphone that no longer names a camera", () => {
    const start = pair({ slideIds: ["cam", "cam2"], activeSlideId: "cam", audioSlideId: "cam2" })
    expect(replacePairMember(start, "cam2", "words", isCamera).audioSlideId).toBeNull()
  })

  it("keeps a microphone that moves to another camera", () => {
    const start = pair({ audioSlideId: "cam" })
    cameras.add("cam3")
    expect(replacePairMember(start, "cam", "cam3", isCamera).audioSlideId).toBe("cam3")
    cameras.delete("cam3")
  })
})

describe("revertPairMember", () => {
  it("gives back the pair as it was when nothing else changed", () => {
    const before = pair({ hiddenSlideId: "words" })
    const applied = replacePairMember(before, "words", "media", isCamera)
    const reverted = revertPairMember(applied, before, applied, "words", "media")
    expect(reverted).toEqual(before)
  })

  it("brings back a microphone the replace dropped", () => {
    const before = pair({ slideIds: ["cam", "cam2"], activeSlideId: "cam", audioSlideId: "cam2" })
    const applied = replacePairMember(before, "cam2", "words", isCamera)
    const reverted = revertPairMember(applied, before, applied, "cam2", "words")
    expect(reverted.slideIds).toEqual(["cam", "cam2"])
    expect(reverted.audioSlideId).toBe("cam2")
  })

  it("keeps a layout and a reorder made while the save was in flight", () => {
    const before = pair()
    const applied = replacePairMember(before, "words", "media", isCamera)
    const latest: SlidePair = { ...applied, layout: "caption", slideIds: ["media", "cam"] }
    const reverted = revertPairMember(latest, before, applied, "words", "media")
    expect(reverted.layout).toBe("caption")
    expect(reverted.slideIds).toEqual(["words", "cam"])
  })

  it("points a member hidden since at the slide that comes back", () => {
    const before = pair()
    const applied = replacePairMember(before, "words", "media", isCamera)
    const latest = { ...applied, hiddenSlideId: "media" }
    expect(revertPairMember(latest, before, applied, "words", "media").hiddenSlideId).toBe(
      "words"
    )
  })
})
