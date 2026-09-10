import { createPinia, defineStore } from "pinia"
import { nextTick } from "vue"
import { describe, expect, it, vi } from "vitest"
import { synchronizeStore, type SharedStateMessage } from "~/utils/sharedStateSync"
import { persistAppState } from "~/utils/appStatePersistence"

function fixture() {
  const readSlide = vi.fn(() => "lyrics")
  const slide = { id: "slide", get content() { return readSlide() } }
  const store = defineStore("app", {
    state: () => ({
      currentState: { activeSlides: [slide], liveSlideId: "", settings: { font: 32 } },
      pastStates: [{ activeSlides: [slide] }], futureStates: [],
      panelSizes: { left: 200 }, panelSizesTouched: {},
    }),
  })(createPinia())
  const channel = {
    onmessage: null as ((message?: SharedStateMessage) => void) | null,
    postMessage: vi.fn(),
  }
  return { store, channel, readSlide }
}

describe("selective state subscriptions", () => {
  it("shares settings without reading slides or undo entries", async () => {
    const { store, channel, readSlide } = fixture()
    const stop = synchronizeStore(store, channel, { initialize: false })
    store.currentState.settings.font = 40
    await nextTick()
    expect(channel.postMessage).toHaveBeenCalledTimes(1)
    expect(channel.postMessage.mock.calls[0][0].state.currentState).toEqual({
      liveSlideId: "", settings: { font: 40 },
    })
    expect(readSlide).not.toHaveBeenCalled()
    store.currentState.activeSlides[0].id = "edited"
    store.pastStates.push({ activeSlides: [] })
    await nextTick()
    expect(channel.postMessage).toHaveBeenCalledTimes(1)
    stop()
  })

  it("does not echo remote snapshots but preserves a local edit in the same tick", async () => {
    const { store, channel } = fixture()
    const stop = synchronizeStore(store, channel, { initialize: false })
    const remote = { timestamp: Date.now() * 1000 + 500, state: { currentState: { liveSlideId: "remote" } } }
    channel.onmessage?.(remote)
    await nextTick()
    expect(channel.postMessage).not.toHaveBeenCalled()
    expect(store.currentState.activeSlides).toHaveLength(1)
    // A no-op patch must not cause the next real local edit to be skipped.
    channel.onmessage?.({ ...remote, timestamp: remote.timestamp + 1 })
    store.currentState.settings.font = 55
    await nextTick()
    expect(channel.postMessage).toHaveBeenCalledTimes(1)
    expect(channel.postMessage.mock.calls[0][0].timestamp).toBeGreaterThan(remote.timestamp + 1)
    stop()
  })

  it("honors omit on outbound and inbound state", async () => {
    const { store, channel } = fixture()
    const stop = synchronizeStore(store, channel, { initialize: false, omit: ["panelSizes"] })
    store.panelSizes.left = 300
    await nextTick()
    expect(channel.postMessage).not.toHaveBeenCalled()
    channel.onmessage?.({ timestamp: Date.now() * 1000, state: { panelSizes: { left: 999 } } })
    expect(store.panelSizes.left).toBe(300)
    stop()
  })

  it("persists settings without traversing slides and restores legacy slides for migration", async () => {
    const { store, readSlide } = fixture()
    const storage = { getItem: vi.fn(() => null as string | null), setItem: vi.fn() }
    const persistence = persistAppState(store, storage)
    store.currentState.settings.font = 42
    await nextTick()
    expect(readSlide).not.toHaveBeenCalled()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.setItem.mock.calls[0][1]).currentState.activeSlides).toBeUndefined()
    store.currentState.activeSlides[0].id = "changed"
    await nextTick()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    persistence.stop()
    storage.getItem.mockReturnValue(JSON.stringify({ currentState: { activeSlides: [{ id: "legacy" }] } }))
    const restored = persistAppState(store, storage)
    expect(store.currentState.activeSlides[0].id).toBe("legacy")
    expect(store.currentState.settings.font).toBe(42)
    restored.stop()
  })
})
