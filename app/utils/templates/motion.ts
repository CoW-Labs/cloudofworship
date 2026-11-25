import type { TemplateMotion } from "~/types"

/**
 * Template motion is drawn from a few pre-painted shapes that only move, spin,
 * scale or fade, so every frame stays on the graphics card: no video to
 * decode, no blur, no canvas loop. It runs on the projector window only; cards,
 * thumbnails and previews show the still background.
 */
export const templateMotionKinds: TemplateMotion[] = [
  "aurora",
  "orbit",
  "rays",
  "breathe",
  "candle",
  "rise",
  "pulse",
  "settle",
  "daybreak",
  "confetti",
  "ping",
  "reveal",
]

export const isTemplateMotion = (value: unknown): value is TemplateMotion =>
  typeof value === "string" &&
  (templateMotionKinds as string[]).includes(value)

/** The same pieces every time, so two windows or two slides line up. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export interface MotionPiece {
  left: number
  size: number
  duration: number
  delay: number
  drift: number
  spin: number
  hue: number
}

/**
 * Small pieces for the kinds that scatter them. Negative delays start each one
 * mid-flight, so the slide is full the moment it appears.
 */
export const motionPieces = (
  count: number,
  seed: number,
  size: [number, number],
  duration: [number, number]
): MotionPiece[] => {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, i) => {
    const length = duration[0] + random() * (duration[1] - duration[0])
    return {
      left: Math.round(random() * 1000) / 10,
      size: Math.round((size[0] + random() * (size[1] - size[0])) * 100) / 100,
      duration: Math.round(length * 10) / 10,
      delay: -Math.round(random() * length * 10) / 10,
      drift: Math.round((random() - 0.5) * 140) / 10,
      spin: Math.round((random() - 0.5) * 900),
      hue: i,
    }
  })
}

/**
 * How hard the speed-up on a slide change pushes a loop. Slow loops need more
 * to be seen, so the aim is to advance about 5 percent of one turn.
 */
export const surgePeak = (loopMs: number) =>
  Math.max(3, Math.min(14, 1 + (loopMs / 1000) * 0.05 / 0.55))
