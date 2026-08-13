import { describe, expect, it, vi } from "vitest"
import {
  createNdiCommandClient,
  type NdiStatus,
} from "~/composables/useNdiBroadcast"
import {
  DEFAULT_NDI_ENABLED,
  preserveDeviceNdiSetting,
} from "~/utils/ndiSettings"
import type { AppSettings } from "~/types"

const status = (phase: NdiStatus["phase"]): NdiStatus => ({
  phase,
  sourceName: "Cow Live Center",
  runtimeAvailable: phase === "broadcasting",
  runtimeVersion: phase === "broadcasting" ? "NDI 6" : null,
  runtimePath: null,
  capturePermission: "notRequired",
  width: phase === "broadcasting" ? 1920 : null,
  height: phase === "broadcasting" ? 1080 : null,
  fps: 30,
  framesSent: 0,
  connectionCount: 0,
  lastFrameAgeMs: null,
  stalled: false,
  error: null,
})

describe("NDI desktop command lifecycle", () => {
  it("subscribes before reading status and presents emitted full status payloads", async () => {
    const calls: string[] = []
    let emitStatus: ((value: NdiStatus) => void) | undefined
    const received: NdiStatus[] = []
    const client = createNdiCommandClient(
      {
        isDesktop: true,
        async listen(event, handler) {
          calls.push(event)
          emitStatus = handler
        },
        async invoke<T>(command: string) {
          calls.push(command)
          return status("idle") as T
        },
      },
      (value) => received.push(value)
    )

    await client.initialize()
    emitStatus?.({ ...status("broadcasting"), connectionCount: 2 })

    expect(calls).toEqual(["ndi://status", "ndi_status"])
    expect(received.at(-1)).toMatchObject({
      phase: "broadcasting",
      sourceName: "Cow Live Center",
      width: 1920,
      height: 1080,
      connectionCount: 2,
    })
  })

  it("starts, stops, and performs a clean stop before retry", async () => {
    const calls: string[] = []
    const client = createNdiCommandClient(
      {
        isDesktop: true,
        async listen() {},
        async invoke<T>(command: string) {
          calls.push(command)
          return status(command === "ndi_start" ? "broadcasting" : "idle") as T
        },
      },
      vi.fn()
    )

    await client.start()
    await client.stop()
    await client.retry()
    expect(calls).toEqual([
      "ndi_start",
      "ndi_stop",
      "ndi_stop",
      "ndi_start",
    ])
  })

  it("does not listen or invoke commands in web mode", async () => {
    const invoke = vi.fn()
    const listen = vi.fn()
    const client = createNdiCommandClient(
      { isDesktop: false, invoke, listen },
      vi.fn()
    )

    await client.initialize()
    await client.start()
    await client.stop()
    await client.retry()
    await client.openCaptureSettings()
    expect(invoke).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })
})

describe("device-only NDI persistence", () => {
  const settings = {
    appVersion: "test",
    defaultBibleVersion: "KJV",
    defaultFont: "Inter",
    defaultBackground: {
      hymn: { backgroundType: "image", background: "", backgroundVideoKey: null },
      bible: { backgroundType: "image", background: "", backgroundVideoKey: null },
      text: { backgroundType: "image", background: "", backgroundVideoKey: null },
    },
    slideStyles: {} as AppSettings["slideStyles"],
    bibleVersions: [],
    songAndHymnLabelsVisibility: false,
  } satisfies AppSettings

  it("defaults off and survives an incoming account settings payload", () => {
    expect(DEFAULT_NDI_ENABLED).toBe(false)
    expect(
      preserveDeviceNdiSetting(
        { ndiEnabled: true },
        { ...settings, ndiEnabled: undefined }
      ).ndiEnabled
    ).toBe(true)
  })
})
