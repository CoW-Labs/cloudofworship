import { afterEach, describe, expect, it, vi } from "vitest"
import { readSavedStreamSettings } from "~/composables/useStreamOutput"

describe("stream settings migration", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("migrates old settings without losing the selected device or stream key", () => {
    const values = new Map([["cow-youtube-stream-settings", JSON.stringify({
      streamKey: "example-key", streamOnGoLive: true, audioDevice: "device-1", quality: "1080p30",
    })]])
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    expect(readSavedStreamSettings()).toMatchObject({ streamKey: "example-key", streamOnGoLive: true, audioDevice: "device-1" })
    expect(values.get("cow-stream-settings")).toBe(values.get("cow-youtube-stream-settings"))
    values.set("cow-stream-settings", JSON.stringify({ streamKey: "new-key" }))
    expect(readSavedStreamSettings()).toEqual({ streamKey: "new-key" })
  })

  it("still reads old settings when storage cannot save the migration", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "cow-youtube-stream-settings" ? '{"streamKey":"old-key"}' : null,
      setItem: () => { throw new Error("storage full") },
    })
    expect(readSavedStreamSettings()).toEqual({ streamKey: "old-key" })
  })
})
