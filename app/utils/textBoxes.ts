import type { Slide, TextBox } from "~/types"
import { slideLayoutTypes, slideTypes } from "~/utils/constants"

/** Layouts whose text a canvas can place. Interludes keep their own. */
const BOX_LAYOUTS: string[] = [
  slideLayoutTypes.heading_sub,
  slideLayoutTypes.full_text,
  slideLayoutTypes.two_column,
  slideLayoutTypes.bible,
  slideLayoutTypes.countdown,
  slideLayoutTypes.time,
]

export const MIN_BOX_SIZE = 0.05
export const MIN_BOX_FONT_PERCENT = 40
export const MAX_BOX_FONT_PERCENT = 250
const MAX_BOXES = 12

/** Whether a slide's text can be laid out on the canvas at all. */
export const supportsTextBoxes = (slide?: Slide | null) =>
  !!slide?.layout &&
  BOX_LAYOUTS.includes(slide.layout) &&
  slide.type !== slideTypes.presentation &&
  slide.type !== slideTypes.media &&
  slide.type !== slideTypes.camera &&
  slide.slideMode !== "overlay"

/** The slide's saved boxes, or null while it still follows its layout. */
export const textBoxesOf = (slide?: Slide | null): TextBox[] | null => {
  const boxes = slide?.slideStyle?.textBoxes
  return supportsTextBoxes(slide) && boxes?.length ? boxes : null
}

/** The content slot auto-fit measures: lyrics, or the verse of a Bible slide. */
export const lyricsSlot = (slide?: Slide | null) =>
  slide?.layout === slideLayoutTypes.bible
    ? 0
    : slide?.layout === slideLayoutTypes.countdown ||
        slide?.layout === slideLayoutTypes.time
      ? -1 // a countdown or clock has no lyrics to fit
      : 1

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Keeps a box on the slide and a usable size. */
export const clampBox = (box: TextBox): TextBox => {
  const w = clamp(box.w, MIN_BOX_SIZE, 1)
  const h = clamp(box.h, MIN_BOX_SIZE, 1)
  return {
    ...box,
    w,
    h,
    x: clamp(box.x, 0, 1 - w),
    y: clamp(box.y, 0, 1 - h),
  }
}

/** Three decimals is far finer than a pixel and keeps saved slides small. */
export const roundBox = (box: TextBox): TextBox => ({
  ...box,
  x: Math.round(box.x * 1000) / 1000,
  y: Math.round(box.y * 1000) / 1000,
  w: Math.round(box.w * 1000) / 1000,
  h: Math.round(box.h * 1000) / 1000,
})

export const boxId = () =>
  `box-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const canAddBox = (boxes: TextBox[]) => boxes.length < MAX_BOXES

export const newCustomBox = (boxes: TextBox[]): TextBox => {
  const z = boxes.reduce((top, box) => Math.max(top, box.z ?? 0), 0) + 1
  return {
    id: boxId(),
    x: 0.3,
    y: 0.42,
    w: 0.4,
    h: 0.16,
    z,
    source: "custom",
    html: "<p>New text</p>",
    alignment: "center",
  }
}

export const textToHtml = (text: string) =>
  text
    .split("\n")
    .map(
      (line) =>
        `<p>${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`
    )
    .join("")

export const htmlToText = (html = "") =>
  html
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

/**
 * Which content slot a rendered block shows. Bible blocks are told apart by
 * class because their order changes with the label position; the rest follow
 * the layout.
 */
export const slotOfBlock = (
  block: Element,
  index: number,
  layout?: string
): number => {
  if (block.classList.contains("bible-label")) return 1
  if (block.classList.contains("bible-content")) return 0
  if (block.classList.contains("countdown-title")) return 1
  if (block.classList.contains("countdown-time")) return 2
  if (block.classList.contains("time-label")) return 1
  if (block.classList.contains("time-clock")) return 2
  return layout === slideLayoutTypes.full_text ? 1 : index
}

/** Room a box keeps beside its text, as a fraction of the slide's width. */
const TEXT_SLACK = 0.008

/**
 * A block can be wider than the words in it (a Bible reference sits in a block
 * as wide as the verse). Its box hugs the words instead, centred on them, as a
 * wrapped verse already does. A little slack stops the words wrapping.
 */
const hugText = (
  rect: DOMRect,
  text: { left: number; width: number } | undefined,
  frameWidth: number
) => {
  if (!text?.width) return { left: rect.left, width: rect.width }
  const width = Math.min(rect.width, text.width + 2 * TEXT_SLACK * frameWidth)
  const centre = text.left + text.width / 2
  return { left: centre - width / 2, width }
}

/** Turns measured rectangles into boxes, as fractions of the slide. */
export const boxesFromRects = (
  frame: { left: number; top: number; width: number; height: number },
  blocks: {
    slot: number
    rect: DOMRect
    /** Where the block's words sit, when narrower than the block. */
    text?: { left: number; width: number }
  }[]
): TextBox[] =>
  frame.width && frame.height
    ? blocks.map(({ slot, rect, text }, index) => {
        const { left, width } = hugText(rect, text, frame.width)
        return roundBox(
          clampBox({
            id: `slot-${slot}`,
            x: (left - frame.left) / frame.width,
            y: (rect.top - frame.top) / frame.height,
            w: width / frame.width,
            h: rect.height / frame.height,
            z: index + 1,
            source: slot,
          })
        )
      })
    : []

/** Snaps a position to the nearest target within `threshold` (a fraction). */
export const snapTo = (value: number, targets: number[], threshold = 0.012) => {
  let best = value
  let distance = threshold
  for (const target of targets) {
    const gap = Math.abs(target - value)
    if (gap < distance) {
      best = target
      distance = gap
    }
  }
  return best
}

/** Where a box sits on the slide, shared by every renderer so they agree. */
export const boxFrameStyle = (box: TextBox) => ({
  left: `${box.x * 100}%`,
  top: `${box.y * 100}%`,
  width: `${box.w * 100}%`,
  height: `${box.h * 100}%`,
  zIndex: box.z ?? 1,
  ...(box.alignment ? { textAlign: box.alignment } : {}),
  ...(box.color ? { color: box.color } : {}),
  ...(box.fontSizePercent && box.fontSizePercent !== 100
    ? {
        fontSize: `${box.fontSizePercent}%`,
        // Labels such as the Bible reference carry their own fixed size, so
        // inheriting the box's size does nothing for them; they scale by this.
        "--box-scale": `${box.fontSizePercent / 100}`,
      }
    : {}),
  ...(box.font ? { "--box-font": `"${box.font.replace(/["\\]/g, "")}", sans-serif` } : {}),
})

/**
 * The classes that carry a box's own text styles (see `.box-*` in main.css).
 * One helper so the projector, the preview and the editor cannot disagree.
 */
export const boxStyleClasses = (box: TextBox) => [
  box.bold === true && "box-bold",
  box.bold === false && "box-bold-off",
  box.uppercase === true && "box-upper",
  box.uppercase === false && "box-upper-off",
  box.outlined === true && "box-outlined",
  box.outlined === false && "box-outlined-off",
  box.linesBackground === true && "box-lines-bg",
  box.linesBackground === false && "box-lines-bg-off",
  box.font && "box-font",
  !!box.fontSizePercent && box.fontSizePercent !== 100 && "box-scaled",
]
