import { describe, expect, it } from "vitest"
import { appStateSerializer } from "~/utils/appStateSerializer"

describe("appStateSerializer", () => {
  it("omits slides from new localStorage snapshots", () => {
    const serialized = appStateSerializer.serialize({
      currentState: {
        activeSlides: [{ id: "large-slide" }],
        liveSlideId: "large-slide",
        settings: { animations: true },
      },
      panelSizes: { previewHeight: 300 },
    })
    const restored = appStateSerializer.deserialize(serialized)

    expect(restored.currentState.activeSlides).toBeUndefined()
    expect(restored.currentState.liveSlideId).toBe("large-slide")
    expect(restored.currentState.settings).toEqual({ animations: true })
    expect(restored.panelSizes).toEqual({ previewHeight: 300 })
  })

  it("still reads legacy snapshots so startup migration can import them", () => {
    const legacy = JSON.stringify({
      currentState: { activeSlides: [{ id: "legacy-slide" }] },
    })

    expect(
      appStateSerializer.deserialize(legacy).currentState.activeSlides
    ).toEqual([{ id: "legacy-slide" }])
  })
})

