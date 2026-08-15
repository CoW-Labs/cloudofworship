import type { Slide } from "~/types"
import { slideTypes } from "~/utils/constants"

const BLOCK_END = /<\/(p|div|h[1-6]|li|tr|blockquote)>/gi
// Line breaks arrive in more than one shape: hymns and scripture emit a bare
// `<br>`, songs emit `<br class="mt-3">`, and TipTap can add its own
// attributes — so match the tag, not one exact spelling of it. Getting this
// wrong silently flattens a verse into a single run-on line.
const LINE_BREAK = /<br\b[^>]*>/gi

/**
 * A live countdown rebroadcasts its slide once a second, and every broadcast
 * replaces the slide object — so without a memo both extractors below re-parse
 * identical markup on every tick. Only a string join stands between a repeat
 * call and the cached answer.
 */
const memoize = (compute: (slide: Slide) => string) => {
  let lastKey: string | null = null
  let lastValue = ""

  return (slide?: Slide | null): string => {
    if (!slide) return ""
    // title/name are part of the key because the label extractor falls back to
    // them when the markup carries no label of its own.
    const key = `${slide.type}|${slide.title}|${slide.name}|${(
      slide.contents || []
    ).join(" ")}`
    if (key === lastKey) return lastValue

    lastKey = key
    lastValue = compute(slide)
    return lastValue
  }
}

/**
 * Slide contents are HTML fragments (TipTap output for text slides, generated
 * markup for songs/hymns/scripture). The stage display renders plain text in
 * its own typography, so it needs the words without the markup — with the line
 * structure intact, since verse line breaks carry meaning for whoever is
 * reading off the stage screen.
 */
export const htmlToPlainText = (html?: string): string => {
  if (!html) return ""

  const withBreaks = html
    .replace(LINE_BREAK, "\n")
    .replace(BLOCK_END, "$&\n")

  let text: string
  if (typeof document === "undefined") {
    text = withBreaks.replace(/<[^>]*>/g, "")
  } else {
    const container = document.createElement("div")
    container.innerHTML = withBreaks
    text = container.textContent || ""
  }

  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * The words a slide is currently putting on the projector.
 *
 * Songs, hymns and scripture tag their body copy (`.song-content`,
 * `.scripture-content`) separately from their label ("Genesis 1:1 • KJV"),
 * and which array slot holds which flips with the
 * `songAndHymnLabelsVisibility` setting — so select on the class rather than
 * the index. Everything else (text slides, countdown messages) falls back to
 * the joined contents.
 */
export const slideToPlainText = memoize((slide: Slide): string => {
  if (
    slide.type === slideTypes.media ||
    slide.type === slideTypes.presentation
  ) {
    return ""
  }

  const contents = (slide.contents || []).filter(Boolean)
  if (!contents.length) return ""

  if (typeof document !== "undefined") {
    const container = document.createElement("div")
    container.innerHTML = contents
      .join("")
      .replace(LINE_BREAK, "\n")
      .replace(BLOCK_END, "$&\n")

    const body = container.querySelectorAll(
      ".song-content, .scripture-content, .countdown-label"
    )
    if (body.length) {
      return Array.from(body)
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
    }
  }

  return contents
    .map((content) => htmlToPlainText(content))
    .filter(Boolean)
    .join("\n\n")
})

/**
 * The secondary line under the main text — reference, song title, hymn number.
 */
export const slideToPlainLabel = memoize((slide: Slide): string => {
  if (typeof document !== "undefined") {
    const container = document.createElement("div")
    container.innerHTML = (slide.contents || []).filter(Boolean).join("")
    const label = container.querySelector(".scripture-label, .song-label")
    const text = (label?.textContent || "").trim()
    if (text) return text
  }

  return slide.title || slide.name || ""
})
