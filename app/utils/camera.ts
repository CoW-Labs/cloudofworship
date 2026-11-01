import type {
  CameraEchoSettings,
  CameraEffect,
  CameraSlideData,
  Slide,
} from "~/types"
import { backgroundTypes } from "~/utils/constants"

export type CameraSettings = Omit<CameraSlideData, "id">

export const defaultCameraData = (): CameraSettings => ({
  deviceId: "",
  deviceLabel: "",
  fit: "cover",
  mirror: false,
  effect: "none",
})

/** The camera effects an operator can pick, in menu order. */
export const cameraEffects: { value: CameraEffect; label: string }[] = [
  { value: "none", label: "No effect" },
  { value: "main-character-echo", label: "Main character echo" },
]

export const cameraEffectLabel = (effect?: CameraEffect) =>
  cameraEffects.find((item) => item.value === effect)?.label ??
  cameraEffects[0]!.label

/** The slide's effect, treating anything unknown (an older build's) as none. */
export const cameraEffectOf = (data?: Pick<CameraSlideData, "effect"> | null) =>
  cameraEffects.some((item) => item.value === data?.effect)
    ? (data!.effect as CameraEffect)
    : "none"

/**
 * Ranges for the echo's number settings. The editor's sliders read them, and
 * stored values are clamped to them, so a slide edited elsewhere can never
 * ask the projector for something outside them.
 */
export const echoRanges = {
  copies: { min: 1, max: 4, step: 1 },
  spacing: { min: 2, max: 16, step: 0.5 },
  strength: { min: 20, max: 100, step: 1 },
  falloff: { min: 30, max: 95, step: 1 },
  fringe: { min: 0, max: 1.2, step: 0.05 },
} as const

export const defaultEchoSettings = (): CameraEchoSettings => ({
  subject: "people",
  direction: "right",
  copies: 3,
  spacing: 7.5,
  strength: 72,
  falloff: 70,
  fringe: 0.35,
})

/** The slide's echo settings, complete and within range. */
export const echoSettingsOf = (
  data?: Pick<CameraSlideData, "echo"> | null
): CameraEchoSettings => {
  const stored = data?.echo ?? {}
  const settings = { ...defaultEchoSettings() }
  if (stored.subject === "people" || stored.subject === "whole") {
    settings.subject = stored.subject
  }
  if (
    stored.direction === "left" ||
    stored.direction === "right" ||
    stored.direction === "both"
  ) {
    settings.direction = stored.direction
  }
  for (const key of Object.keys(echoRanges) as (keyof typeof echoRanges)[]) {
    const value = stored[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      const { min, max } = echoRanges[key]
      settings[key] = Math.min(max, Math.max(min, value))
    }
  }
  return settings
}

export const cameraSlideName = (data?: Pick<CameraSlideData, "deviceLabel">) => {
  const label = data?.deviceLabel?.trim()
  return label ? `Camera: ${label}` : "Camera"
}

/**
 * Returns the slide with its camera settings applied, keeping the derived
 * fields in step. The feed covers the whole frame, so the background is plain
 * black: it shows for the instant before the first frame and wherever the feed
 * is not opened. Blur and brightness are reset because CSS filters over a
 * 1080p video cost far more than they do over a still.
 */
export const withCameraData = (slide: Slide, data: CameraSlideData): Slide => ({
  ...slide,
  data,
  name: cameraSlideName(data),
  contents: ["", ""],
  backgroundType: backgroundTypes.solid,
  background: "#000000",
  backgroundVideoKey: null,
  backgroundImageKey: null,
})
