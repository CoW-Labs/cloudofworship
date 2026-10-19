import type { CameraSlideData, Slide } from "~/types"
import { backgroundTypes } from "~/utils/constants"

export type CameraSettings = Omit<CameraSlideData, "id">

export const defaultCameraData = (): CameraSettings => ({
  deviceId: "",
  deviceLabel: "",
  fit: "cover",
  mirror: false,
})

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
