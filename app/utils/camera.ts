import type {
  CameraEchoSettings,
  CameraEffect,
  CameraSlideData,
  LightLeakSettings,
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
  { value: "light-leak", label: "Light leak" },
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
 * Ranges for the echo's adjustable number settings. The editor's sliders read
 * them, and stored values are clamped to them, so a slide edited elsewhere can
 * never ask the projector for something outside them. The echo's other
 * numbers (spacing, rise, size, fade, fringe) always take the defaults.
 */
export const echoRanges = {
  copies: { min: 1, max: 4, step: 1 },
  gap: { min: 0, max: 50, step: 1 },
  strength: { min: 20, max: 100, step: 1 },
} as const

export const defaultEchoSettings = (): CameraEchoSettings => ({
  subject: "people",
  focus: "main",
  direction: "right",
  copies: 2,
  gap: 30,
  spacing: 15,
  rise: 0,
  scale: 100,
  strength: 60,
  falloff: 50,
  fringe: 0.6,
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
  if (stored.focus === "main" || stored.focus === "everyone") {
    settings.focus = stored.focus
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

export interface CameraEffectRange {
  min: number
  max: number
  step: number
}

/** A number setting's slider in an effect's Adjust panel. */
export interface CameraEffectSlider {
  key: string
  label: string
  format: (value: number) => string
}

/** An either/or setting in an effect's Adjust panel, shown as a dropdown. */
export interface CameraEffectChoice {
  label: string
  options: {
    label: string
    icon: string
    active: boolean
    patch: Record<string, unknown>
  }[]
}

const percent = (value: number) => `${value}%`

export const echoSliders: CameraEffectSlider[] = [
  {
    key: "copies",
    label: "Number of copies",
    format: (value) => (value === 1 ? "1 copy" : `${value} copies`),
  },
  {
    key: "gap",
    label: "Distance from the person",
    format: (value) => (value < 15 ? "Close" : value < 35 ? "Medium" : "Far"),
  },
  { key: "strength", label: "How visible the copies are", format: percent },
]

export const lightLeakSliders: CameraEffectSlider[] = [
  { key: "strength", label: "Strength", format: percent },
  { key: "speed", label: "Speed", format: percent },
  {
    key: "rest",
    label: "Rest between bursts",
    format: (value) => (value ? `${value} s` : "None"),
  },
]

/** Ranges for the light leak's settings, read and clamped as echoRanges are. */
export const lightLeakRanges = {
  strength: { min: 20, max: 100, step: 1 },
  speed: { min: 50, max: 200, step: 5 },
  rest: { min: 0, max: 10, step: 0.5 },
} as const

export const defaultLightLeakSettings = (): LightLeakSettings => ({
  strength: 85,
  speed: 100,
  rest: 2,
})

/** The slide's light leak settings, complete and within range. */
export const lightLeakSettingsOf = (
  data?: Pick<CameraSlideData, "lightLeak"> | null
): LightLeakSettings => {
  const stored = data?.lightLeak ?? {}
  const settings = defaultLightLeakSettings()
  for (const key of Object.keys(lightLeakRanges) as (keyof LightLeakSettings)[]) {
    const value = stored[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      const { min, max } = lightLeakRanges[key]
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
