import type { AppSettings } from "~/types"

/**
 * Performance settings describe the computer in front of the person, not the
 * account, so they are device-local (like NDI): they never go to the backend,
 * and account-backed settings that omit them must not reset them.
 *
 * Every field reads as "off" when missing, so an install that has never opened
 * the panel behaves exactly as before.
 */
export type CameraResolutionSetting = "auto" | "720p"

export interface DevicePerformanceSettings {
  /** No blur filters on slide backgrounds and no frosted-glass panels. */
  reduceEffects: boolean
  /** The operator's Live Output preview shows a still frame of a video. */
  stillPreviewVideo: boolean
  /** "720p" opens cameras at 1280x720 even where 1080p is available. */
  cameraResolution: CameraResolutionSetting
  /** Whether teammates may view this computer's cameras (peer to peer). */
  shareCameraWithTeam: boolean
}

export const DEFAULT_DEVICE_PERFORMANCE: DevicePerformanceSettings = {
  reduceEffects: false,
  stillPreviewVideo: false,
  cameraResolution: "auto",
  shareCameraWithTeam: true,
}

/**
 * What "Lite mode" sets. Only device-local settings, so switching it on at the
 * church's slow laptop never changes anything on another computer. Camera
 * sharing is a team feature rather than a cost the person pays by default, so
 * the preset leaves it alone.
 */
export const LITE_PRESET: Pick<
  DevicePerformanceSettings,
  "reduceEffects" | "stillPreviewVideo" | "cameraResolution"
> = {
  reduceEffects: true,
  stillPreviewVideo: true,
  cameraResolution: "720p",
}

type PerformanceFields = Partial<DevicePerformanceSettings>

const DEVICE_KEYS = Object.keys(
  DEFAULT_DEVICE_PERFORMANCE
) as (keyof DevicePerformanceSettings)[]

/** Keeps the local choices when account-backed settings omit these fields. */
export const preserveDevicePerformanceSettings = (
  current: PerformanceFields,
  incoming: AppSettings
): AppSettings => {
  const merged: Record<string, unknown> = { ...incoming }
  DEVICE_KEYS.forEach((key) => {
    merged[key] =
      incoming[key] ?? current[key] ?? DEFAULT_DEVICE_PERFORMANCE[key]
  })
  return merged as unknown as AppSettings
}

/** Lite mode is on when every setting it controls sits at its Lite value. */
export const isLiteMode = (settings: PerformanceFields | undefined) =>
  !!settings &&
  (Object.keys(LITE_PRESET) as (keyof typeof LITE_PRESET)[]).every(
    (key) => settings[key] === LITE_PRESET[key]
  )

/** The value a setting resolves to once the missing-means-default rule is applied. */
export const resolveDevicePerformance = (
  settings: PerformanceFields | undefined
): DevicePerformanceSettings => ({
  reduceEffects: settings?.reduceEffects ?? DEFAULT_DEVICE_PERFORMANCE.reduceEffects,
  stillPreviewVideo:
    settings?.stillPreviewVideo ?? DEFAULT_DEVICE_PERFORMANCE.stillPreviewVideo,
  cameraResolution:
    settings?.cameraResolution ?? DEFAULT_DEVICE_PERFORMANCE.cameraResolution,
  shareCameraWithTeam:
    settings?.shareCameraWithTeam ?? DEFAULT_DEVICE_PERFORMANCE.shareCameraWithTeam,
})
