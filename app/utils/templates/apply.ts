import type {
  Slide,
  Template,
  TemplateBox,
  TemplateDesign,
  TemplateLook,
  TemplateMotion,
  TextBox,
} from "~/types"
import { isTemplateMotion } from "~/utils/templates/motion"
import {
  backgroundFillTypes,
  slideLayoutTypes,
  slideTypes,
} from "~/utils/constants"
import {
  htmlToText,
  roundBox,
  supportsTextBoxes,
  textToHtml,
} from "~/utils/textBoxes"

/**
 * Everything here is pure: no stores, no DOM, no network. Applying a template
 * is a copy of its boxes onto a slide, so it costs microseconds and cannot slow
 * a service down.
 */

/** A text slide's main words live in this slot, as on any free layout text slide. */
const MAIN_SLOT = 1
/** A text slide's base size in cqw, which a box's percent scales. */
const BASE_CQW = 3
/** The share of the slide a verse or song fills when it has no boxes. */
const FLOW_TEXT_AREA = 0.72

/**
 * A verse or song already sizes its words to fill the whole slide for their
 * length. In a smaller box the same words need a smaller size, and text area
 * grows with the square of its size, so the scale is the square root of the
 * box's share of that area. Never larger than the slide's own size.
 */
export const lookTextPercent = (box: { w: number; h: number }) =>
  Math.max(40, Math.min(100, Math.round(100 * Math.sqrt((box.w * box.h) / FLOW_TEXT_AREA))))

/** A box as the slide stores it: the role and name are the template's own. */
export const toSlideBox = (box: TemplateBox, id: string, z: number): TextBox => {
  const { role: _role, name: _name, ...rest } = box
  return roundBox({ ...rest, id, z: rest.z ?? z })
}

const newBoxId = (slideId: string, index: number) => `box-${slideId}-${index}`

/**
 * The box that holds the slide's main words: the one marked `body`, or else
 * the one with the biggest text. On the slide it reads the main content slot,
 * so the words show wherever the slide ignores its boxes, such as in a pair.
 */
export const mainBoxIndex = (design: TemplateDesign) => {
  const body = design.boxes.findIndex((b) => b.role === "body")
  if (body >= 0) return body
  const size = (b?: TemplateBox) => {
    const inline = /font-size:\s*([\d.]+)em/.exec(b?.html ?? "")?.[1]
    return (b?.fontSizePercent ?? 100) * (inline ? parseFloat(inline) : 1)
  }
  return design.boxes.reduce(
    (best, box, i) => (size(box) > size(design.boxes[best]) ? i : best),
    0
  )
}

const designStyle = (design: TemplateDesign) => ({
  // Shown as designed, not dimmed and blurred like a photo behind words.
  designedBackground: true,
  // A starter picture is drawn to fill the slide at any screen shape.
  ...(design.backgroundType === "image"
    ? { backgroundFillType: backgroundFillTypes.crop }
    : {}),
  ...(design.textColor ? { textColor: design.textColor } : {}),
  ...(design.transition ? { transition: design.transition } : {}),
  ...(design.motion ? { backgroundMotion: design.motion } : {}),
  ...(design.motion && design.motionBackground
    ? { backgroundMotionBase: design.motionBackground }
    : {}),
})

/**
 * A new text slide from a template. `base` is a fresh slide from the normal
 * text slide path, so ids, schedule, church and default style come from the
 * code that already owns them.
 */
export const slideFromTemplate = (
  base: Slide,
  template: Template,
  options: { text?: string } = {}
): Slide => {
  const { design } = template
  const main = mainBoxIndex(design)
  // Words brought in (a sermon line) take the emphasis box. They keep the
  // design's size when they are about as short as the sample and shrink to
  // fit the box when longer. The other boxes stay as designed, each holding a
  // prompt in place of the sample's text.
  const words = options.text?.trim()
  const mainBox = design.boxes[main]
  const designInline = parseFloat(
    /font-size:\s*([\d.]+)em/.exec(mainBox?.html ?? "")?.[1] ?? "1"
  )
  const designedCqw = ((mainBox?.fontSizePercent ?? 100) / 100) * designInline * BASE_CQW
  // A line of text takes about 0.7 cqw of area per character per cqw squared
  // of size; the box's area is in cqw too (the slide is 100 wide, 56.25 tall).
  const boxArea = (mainBox?.w ?? 1) * 100 * (mainBox?.h ?? 1) * 56.25
  const fitCqw = words ? Math.sqrt((boxArea * 0.6) / (words.length * 0.7)) : designedCqw
  const useCqw = Math.min(designedCqw, fitCqw)
  const wantPct = (useCqw / BASE_CQW) * 100
  const mainPct = Math.max(40, Math.min(250, Math.round(wantPct)))
  const mainInline = wantPct / mainPct
  const boxes = design.boxes.map((box, i) => {
    const slideBox = toSlideBox(box, newBoxId(base.id, i), i + 1)
    if (i !== main) {
      return words ? { ...slideBox, html: "<p>[Write here]</p>" } : slideBox
    }
    const { html: _html, ...rest } = slideBox
    return {
      ...rest,
      source: MAIN_SLOT,
      ...(words ? { fontSizePercent: mainPct } : {}),
    }
  })
  const mainContent = !words
    ? mainBox?.html ?? ""
    : mainInline > 1.02
      ? `<p><span style="font-size:${mainInline.toFixed(2)}em">${escapeHtml(words)}</span></p>`
      : `<p>${escapeHtml(words)}</p>`
  return {
    ...base,
    name: template.name,
    type: slideTypes.text,
    layout: slideLayoutTypes.full_text,
    contents: ["", mainContent],
    backgroundType: design.backgroundType,
    background: design.background,
    backgroundVideoKey: null,
    backgroundImageKey: null,
    slideStyle: {
      ...base.slideStyle,
      ...designStyle(design),
      ...(design.font ? { font: design.font } : {}),
      textBoxes: boxes,
    },
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const plain = (html?: string) =>
  (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()

/**
 * The sample verse of a template made for scripture: one with a body and a
 * reference box that takes the scripture look. Such a template is created as a
 * Bible slide, so the verse can be searched, replaced and stepped like any
 * other. Null for every other template.
 */
export const bibleSampleOf = (
  template: Template
): { label: string; content: string } | null => {
  if (!template.looks.includes("scripture")) return null
  const body = template.design.boxes.find((b) => b.role === "body")
  const ref = template.design.boxes.find((b) => b.role === "ref")
  const content = plain(body?.html)
  const label = plain(ref?.html)
  return content && label ? { label, content } : null
}

/**
 * Where a slide keeps the words a look must show. `body` is the main words and
 * `ref` an optional second line: a verse's reference, a heading's subtitle, a
 * countdown's title. Null for slides that have no text a template can restyle.
 */
const lookSlots = (slide: Slide): { body: number; ref: number } | null => {
  switch (slide.layout) {
    case slideLayoutTypes.bible:
      return { body: 0, ref: 1 }
    case slideLayoutTypes.full_text:
      return { body: 1, ref: -1 }
    case slideLayoutTypes.heading_sub:
    case slideLayoutTypes.two_column:
      return { body: 0, ref: 1 }
    case slideLayoutTypes.countdown:
    case slideLayoutTypes.time:
      // The time is the main words; the title or label above it is the second.
      return { body: 2, ref: 1 }
    default:
      return null
  }
}

/** Which look a slide can take, or null for slides a template cannot restyle. */
export const lookOf = (slide?: Slide | null): TemplateLook | null => {
  if (!slide || !supportsTextBoxes(slide) || !lookSlots(slide)) return null
  if (slide.type === slideTypes.bible) return "scripture"
  if (
    slide.type === slideTypes.song ||
    slide.type === slideTypes.songSetlist ||
    slide.type === slideTypes.hymn
  )
    return "song"
  return "text"
}

/** Slides whose words the app already sizes to fill the screen for their length. */
const sizesItsOwnWords = (slide: Slide) =>
  slide.layout === slideLayoutTypes.bible ||
  slide.layout === slideLayoutTypes.full_text

/** The size a template box is designed at: its own percent and any inline em. */
const designedPercent = (box: TemplateBox) => {
  const inline = /font-size:\s*([\d.]+)em/.exec(box.html ?? "")?.[1]
  const percent = (box.fontSizePercent ?? 100) * (inline ? parseFloat(inline) : 1)
  return Math.max(40, Math.min(250, Math.round(percent)))
}

/**
 * Restyles any slide that has text with a template and keeps its words. The
 * main words go in the box marked `body` and the second line in the box marked
 * `ref`. The slide's other text boxes (a label, a date, a second heading) go
 * into the template's remaining boxes, top to bottom, as many as the template
 * has room for; the rest are left out. A template box with nothing to hold, and
 * the reference box of a slide with no second line, are dropped, because they
 * would be blank.
 */
export const applyLook = (slide: Slide, template: Template): Slide | null => {
  const look = lookOf(slide)
  const slots = lookSlots(slide)
  if (!look || !slots || !template.looks.includes(look)) return null
  const hasRef =
    slots.ref >= 0 &&
    (slide.layout === slideLayoutTypes.bible ||
      !!slide.contents?.[slots.ref]?.replace(/<[^>]*>/g, "").trim())
  const kept = template.design.boxes.filter(
    (b) => b.role === "body" || (b.role === "ref" && hasRef)
  )
  if (!kept.some((b) => b.role === "body")) return null
  // Verses and songs keep the size the slide gives them for their length,
  // scaled to the box they now sit in. Other text has no such size, so it takes
  // the size the template was designed at. The second line keeps its own size.
  const flow = sizesItsOwnWords(slide)
  const mainBoxes = kept.map((box, i) => {
    const { html: _html, ...rest } = toSlideBox(box, newBoxId(slide.id, i), i + 1)
    const isRef = box.role === "ref"
    return {
      ...rest,
      source: isRef ? slots.ref : slots.body,
      fontSizePercent: isRef ? 100 : flow ? lookTextPercent(box) : designedPercent(box),
    }
  })
  // The slide's other boxes, read top to bottom then left to right.
  const hasWords = (html?: string) => !!plain(html)
  const keepsRef = kept.some((b) => b.role === "ref")
  // A second line (a subtitle) the template has no box for is carried like any
  // other box rather than lost.
  const strayRef =
    !keepsRef && slots.ref >= 0 && hasWords(slide.contents?.[slots.ref])
      ? [{ source: slots.ref, x: 0, y: 0 } as TextBox]
      : []
  const extras = [...strayRef, ...(slide.slideStyle?.textBoxes ?? [])
    .filter((b) =>
      b.source === "custom"
        ? hasWords(b.html)
        : b.source !== slots.body &&
          b.source !== slots.ref &&
          hasWords(slide.contents?.[b.source])
    )
    .sort((a, b) => a.y - b.y || a.x - b.x)]
  const spare = template.design.boxes.filter((b) => !b.role)
  const carried = spare.slice(0, extras.length).map((box, i) => {
    const from = extras[i]!
    const slideBox = toSlideBox(
      box,
      newBoxId(slide.id, mainBoxes.length + i),
      mainBoxes.length + i + 1
    )
    const { html: _html, ...rest } = slideBox
    return from.source === "custom"
      ? {
          ...rest,
          source: "custom" as const,
          html: textToHtml(htmlToText(from.html)),
          fontSizePercent: designedPercent(box),
        }
      : { ...rest, source: from.source, fontSizePercent: designedPercent(box) }
  })
  const boxes = [...mainBoxes, ...carried]
  return {
    ...slide,
    backgroundType: template.design.backgroundType,
    background: template.design.background,
    backgroundVideoKey: null,
    backgroundImageKey: null,
    slideStyle: {
      ...slide.slideStyle,
      ...designStyle(template.design),
      textBoxes: boxes,
    },
  }
}

/**
 * Whether a slide's background is a template's design and should be shown as
 * it is. A photo the church puts on the slide later is dimmed like any other.
 */
export const showsDesignedBackground = (slide?: Slide | null) =>
  !!slide?.slideStyle?.designedBackground &&
  (slide.backgroundType === "gradient" ||
    slide.backgroundType === "solid" ||
    (slide.backgroundType === "image" &&
      !!slide.background?.startsWith("/templates/")))

/**
 * The motion a slide's background carries, or null. It belongs to the
 * template's own background, so a photo the church puts on the slide later
 * ends it, the same way it ends the undimmed look.
 */
export const motionOf = (slide?: Slide | null): TemplateMotion | null => {
  const kind = slide?.slideStyle?.backgroundMotion
  return kind && isTemplateMotion(kind) && showsDesignedBackground(slide)
    ? kind
    : null
}

/**
 * The picture the projector shows while a slide's motion runs: the same art
 * without the shapes the motion draws, or null to keep the slide's own.
 */
export const motionBackgroundOf = (slide?: Slide | null): string | null => {
  const base = slide?.slideStyle?.backgroundMotionBase
  return motionOf(slide) && base?.startsWith("/templates/") ? base : null
}

/** Whether a slide's own uploaded picture would be left out of a template. */
export const losesPicture = (slide: Slide) =>
  slide.backgroundType === "image" && !slide.background?.startsWith("/templates/")

/** The boxes' roles decide whether a template can be a look. */
export const looksOfDesign = (design: TemplateDesign): TemplateLook[] =>
  design.boxes.some((b) => b.role === "body") ? ["scripture", "song", "text"] : []

/** A template is only usable with at least one box; old API records have none. */
export const isUsableTemplate = (
  template?: Partial<Template> | null
): template is Template => !!template?._id && !!template.design?.boxes?.length

/**
 * A template from a slide the church has made. Text is swapped for a prompt by
 * default so one week's announcement does not come back next month. Boxes that
 * read the slide's own words become custom text, and on a verse or song they
 * get a role so the template can be a look.
 */
export const designFromSlide = (
  slide: Slide,
  options: { keepText?: boolean } = {}
): TemplateDesign | null => {
  const boxes = slide.slideStyle?.textBoxes
  if (!boxes?.length) return null
  const type = slide.backgroundType
  // A picture the church uploaded can be deleted later, which would leave the
  // template blank, so only the app's own pictures are kept for now.
  const known =
    type === "solid" ||
    type === "gradient" ||
    (type === "image" && !!slide.background?.startsWith("/templates/"))
  const body = lookSlots(slide)?.body ?? -1
  const isText = slide.type === slideTypes.text
  const prompt = (i: number) => `<p>Text ${i + 1}</p>`
  return {
    backgroundType: known ? (type as TemplateDesign["backgroundType"]) : "solid",
    background: known ? slide.background ?? "#000000" : "#000000",
    ...(slide.slideStyle?.textColor ? { textColor: slide.slideStyle.textColor } : {}),
    ...(slide.slideStyle?.font ? { font: slide.slideStyle.font } : {}),
    ...(slide.slideStyle?.transition ? { transition: slide.slideStyle.transition } : {}),
    ...(known && motionOf(slide) ? { motion: motionOf(slide)! } : {}),
    ...(known && motionBackgroundOf(slide)
      ? { motionBackground: motionBackgroundOf(slide)! }
      : {}),
    boxes: boxes.map((box, i): TemplateBox => {
      if (box.source === "custom") {
        return options.keepText ? box : { ...box, html: prompt(i) }
      }
      if (!isText && box.source === body)
        return { ...box, source: "custom", role: "body", html: "<p>Your words here</p>" }
      if (!isText && box.source === 1 && slide.layout === slideLayoutTypes.bible)
        return { ...box, source: "custom", role: "ref", html: "<p>Reference</p>" }
      // A text slide's own words live in its content slots, not in the box.
      const own = slide.contents?.[box.source]
      return {
        ...box,
        source: "custom",
        html: options.keepText && own ? own : prompt(i),
      }
    }),
  }
}
