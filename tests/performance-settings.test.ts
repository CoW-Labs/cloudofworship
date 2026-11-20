import { describe, expect, it } from "vitest"
import type { AppSettings } from "../app/types"
import {
  DEFAULT_DEVICE_PERFORMANCE,
  LITE_PRESET,
  isLiteMode,
  preserveDevicePerformanceSettings,
  resolveDevicePerformance,
} from "../app/utils/performanceSettings"

const incoming = (extra: Partial<AppSettings> = {}) =>
  ({ defaultFont: "Inter", ...extra } as AppSettings)

describe("performance settings", () => {
  it("treats missing values as the defaults, so an untouched install is unchanged", () => {
    expect(resolveDevicePerformance(undefined)).toEqual(DEFAULT_DEVICE_PERFORMANCE)
    expect(resolveDevicePerformance({})).toEqual(DEFAULT_DEVICE_PERFORMANCE)
    expect(isLiteMode({})).toBe(false)
  })

  it("keeps the local choices when account settings omit them", () => {
    const merged = preserveDevicePerformanceSettings(
      { reduceEffects: true, cameraResolution: "720p", shareCameraWithTeam: false },
      incoming()
    )
    expect(merged.reduceEffects).toBe(true)
    expect(merged.cameraResolution).toBe("720p")
    expect(merged.shareCameraWithTeam).toBe(false)
    expect(merged.stillPreviewVideo).toBe(false)
  })

  it("lets an explicit incoming value win", () => {
    const merged = preserveDevicePerformanceSettings(
      { reduceEffects: true },
      incoming({ reduceEffects: false })
    )
    expect(merged.reduceEffects).toBe(false)
  })

  it("is Lite only when every Lite setting is at its Lite value", () => {
    expect(isLiteMode({ ...LITE_PRESET })).toBe(true)
    expect(isLiteMode({ ...LITE_PRESET, stillPreviewVideo: false })).toBe(false)
    expect(isLiteMode({ ...LITE_PRESET, cameraResolution: "auto" })).toBe(false)
  })

  it("leaves camera sharing out of the Lite preset", () => {
    expect(Object.keys(LITE_PRESET)).not.toContain("shareCameraWithTeam")
  })
})
