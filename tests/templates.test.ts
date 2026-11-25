import { describe, expect, it } from "vitest"
import type { Slide } from "~/types"
import {
  MAX_BOX_FONT_PERCENT,
  MIN_BOX_FONT_PERCENT,
  MIN_BOX_SIZE,
} from "~/utils/textBoxes"
import {
  bibleSampleOf,
  applyLook,
  designFromSlide,
  isUsableTemplate,
  lookTextPercent,
  mainBoxIndex,
  motionBackgroundOf,
  motionOf,
  showsDesignedBackground,
  slideFromTemplate,
} from "~/utils/templates/apply"
import { starterTemplates } from "~/utils/templates/starters"
import {
  isTemplateMotion,
  motionPieces,
  surgePeak,
  templateMotionKinds,
} from "~/utils/templates/motion"

const base = (over: Partial<Slide> = {}): Slide => ({
  id: "slide-1",
  index: 0,
  name: "Untitled",
  type: "text",
  layout: "full-text",
  userId: "u",
  churchId: "c",
  scheduleId: "s",
  contents: [],
  slideStyle: { isMediaMuted: true },
  ...over,
})

const starter = (key: string) =>
  starterTemplates.find((t) => t._id === `starter:${key}`)!

describe("starter templates", () => {
  it("have unique ids and no removed templates", () => {
    const ids = starterTemplates.map((t) => t._id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => /thank/i.test(id))).toBe(false)
  })

  it.each(starterTemplates.map((t) => [t.name, t] as const))(
    "%s stays inside what free layout allows",
    (_name, template) => {
      for (const design of [template.design]) {
        expect(design!.boxes.length).toBeGreaterThan(0)
        expect(design!.boxes.length).toBeLessThanOrEqual(12)
        for (const box of design!.boxes) {
          expect(box.fontSizePercent).toBeGreaterThanOrEqual(MIN_BOX_FONT_PERCENT)
          expect(box.fontSizePercent).toBeLessThanOrEqual(MAX_BOX_FONT_PERCENT)
          expect(box.w).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
          expect(box.h).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.y).toBeGreaterThanOrEqual(0)
          expect(box.x + box.w).toBeLessThanOrEqual(1.001)
          expect(box.y + box.h).toBeLessThanOrEqual(1.001)
        }
        const ids = design!.boxes.map((b) => b.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  )

  it("keeps text inside the 5 percent safe area", () => {
    for (const template of starterTemplates) {
      for (const box of template.design.boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0.02)
        expect(box.x + box.w).toBeLessThanOrEqual(0.98)
      }
    }
  })

  it("never gives a look template a role the app cannot fill", () => {
    for (const template of starterTemplates) {
      const roles = template.design.boxes.map((b) => b.role).filter(Boolean)
      if (template.looks.length) expect(roles).toContain("body")
    }
  })
})

describe("slideFromTemplate", () => {
  it("copies boxes with fresh ids and drops template-only fields", () => {
    const slide = slideFromTemplate(base(), starter("verse"))
    const boxes = slide.slideStyle!.textBoxes!
    expect(boxes).toHaveLength(2)
    expect(boxes.every((b) => b.id.startsWith("box-slide-1-"))).toBe(true)
    expect(boxes.every((b) => !("role" in b) && !("name" in b))).toBe(true)
    expect(slide.backgroundType).toBe("image")
    expect(slide.slideStyle!.backgroundFillType).toBe("Crop")
    expect(slide.slideStyle!.transition).toBe("fade")
    expect(slide.type).toBe("text")
  })

  // A pair ignores a slide's boxes and shows its main content slot, so the
  // main words must live there or the slide is blank in every pair.
  it("puts the main words in the content slot a pair shows", () => {
    for (const template of starterTemplates) {
      const slide = slideFromTemplate(base(), template)
      const main = slide.slideStyle!.textBoxes!.filter((b) => b.source === 1)
      expect(main, template.name).toHaveLength(1)
      expect(main[0].html).toBeUndefined()
      expect(slide.contents[1], template.name).toBe(
        template.design.boxes[mainBoxIndex(template.design)].html
      )
      expect(slide.contents[1]).toMatch(/\w/)
    }
  })

  it("picks the headline, not a small label, as the main box", () => {
    const names = (key: string) => {
      const t = starter(key)
      return t.design.boxes[mainBoxIndex(t.design)].name
    }
    expect(names("welcome")).toBe("Headline")
    expect(names("name-bar")).toBe("Name")
    expect(names("scripture-caption")).toBe("Verse")
    expect(names("point")).toBe("Point")
    expect(names("announce")).toBe("Headline")
  })

  it("does not change the template", () => {
    const template = starter("verse")
    const before = JSON.stringify(template)
    slideFromTemplate(base(), template)
    expect(JSON.stringify(template)).toBe(before)
  })
})

describe("isUsableTemplate", () => {
  it("skips the old slide-pointer records the API still returns", () => {
    expect(isUsableTemplate({ _id: "x", slideId: "y" } as never)).toBe(false)
    expect(isUsableTemplate(null)).toBe(false)
    expect(isUsableTemplate(starter("verse"))).toBe(true)
  })
})

describe("applyLook", () => {
  const verse = (over: Partial<Slide> = {}) =>
    base({
      type: "bible",
      layout: "bible",
      contents: ["For God so loved the world", "John 3:16"],
      ...over,
    })

  it("keeps the verse's words and points boxes at them", () => {
    const slide = applyLook(verse(), starter("verse"))!
    const boxes = slide.slideStyle!.textBoxes!
    expect(slide.contents).toEqual(["For God so loved the world", "John 3:16"])
    expect(boxes.map((b) => b.source)).toEqual([0, 1])
    expect(boxes.every((b) => b.html === undefined)).toBe(true)
  })

  it("never makes the words bigger than the slide sizes them for their length", () => {
    for (const template of starterTemplates.filter((t) => t.looks.includes("scripture"))) {
      const slide = applyLook(verse(), template)!
      for (const box of slide.slideStyle!.textBoxes!) {
        expect(box.fontSizePercent).toBeLessThanOrEqual(100)
        expect(box.fontSizePercent).toBeGreaterThanOrEqual(40)
      }
    }
    expect(lookTextPercent({ w: 0.9, h: 0.8 })).toBe(100)
    expect(lookTextPercent({ w: 0.875, h: 0.22 })).toBeLessThan(60)
  })

  it("drops every box that has no role", () => {
    const slide = applyLook(verse(), starter("poster-verse"))!
    expect(slide.slideStyle!.textBoxes).toHaveLength(2)
  })

  it("reads a song's lyrics from slot 1 and drops the reference when labels are off", () => {
    const song = base({
      type: "song",
      layout: "full-text",
      contents: ["", "Amazing grace"],
    })
    const slide = applyLook(song, starter("verse"))!
    expect(slide.slideStyle!.textBoxes!.map((b) => b.source)).toEqual([1])
  })

  it("carries the slide's other boxes, as many as the template has room for", () => {
    const custom = (n: number) => ({
      id: `c${n}`,
      x: 0.1,
      y: n / 10,
      w: 0.3,
      h: 0.05,
      source: "custom" as const,
      html: `<p>Note ${n}</p>`,
    })
    const make = (count: number) =>
      base({
        contents: ["", "Welcome home"],
        slideStyle: {
          textBoxes: [
            { id: "main", x: 0, y: 0, w: 1, h: 0.5, source: 1 as const },
            // Out of order on purpose: they are carried top to bottom.
            ...Array.from({ length: count }, (_, i) => custom(count - i)),
          ],
        },
      })
    const three = applyLook(make(3), starter("welcome"))!.slideStyle!.textBoxes!
    expect(three.map((b) => b.source)).toEqual([1, "custom", "custom", "custom"])
    expect(three.slice(1).map((b) => b.html)).toEqual([
      "<p>Note 1</p>",
      "<p>Note 2</p>",
      "<p>Note 3</p>",
    ])
    // The template has four spare boxes; a sixth note has nowhere to go.
    const six = applyLook(make(6), starter("welcome"))!.slideStyle!.textBoxes!
    expect(six).toHaveLength(5)
  })

  it("keeps a subtitle the template has no second box for", () => {
    const heading = base({
      layout: "heading-and-subtitle",
      contents: ["Easter", "Sunday 9am"],
    })
    const boxes = applyLook(heading, starter("welcome"))!.slideStyle!.textBoxes!
    expect(boxes.map((b) => b.source)).toEqual([0, 1])
  })

  it("restyles any slide with text and keeps its words", () => {
    // A plain text slide: its words live in slot 1 of a full-text layout.
    const text = applyLook(base({ contents: ["", "Welcome home"] }), starter("verse"))!
    expect(text.contents).toEqual(["", "Welcome home"])
    expect(text.slideStyle!.textBoxes!.map((b) => b.source)).toEqual([1])
    // A heading and subtitle: the heading is the main words, the subtitle the second line.
    const heading = base({
      layout: "heading-and-subtitle",
      contents: ["Easter", "Sunday 9am"],
    })
    expect(
      applyLook(heading, starter("verse"))!.slideStyle!.textBoxes!.map((b) => b.source)
    ).toEqual([0, 1])
    // No subtitle written: the reference box would be blank, so it goes.
    expect(
      applyLook({ ...heading, contents: ["Easter", ""] }, starter("verse"))!
        .slideStyle!.textBoxes
    ).toHaveLength(1)
    // A countdown: the time is the main words, its title the second line.
    const countdown = base({
      type: "countdown",
      layout: "countdown",
      contents: ["", "Service starts in", "04:59"],
    })
    expect(
      applyLook(countdown, starter("verse"))!.slideStyle!.textBoxes!.map((b) => b.source)
    ).toEqual([2, 1])
  })

  it("keeps a template's designed size where the slide has no size of its own", () => {
    const heading = base({ layout: "heading-and-subtitle", contents: ["Easter", "x"] })
    const point = applyLook(heading, starter("verse"))!.slideStyle!.textBoxes![0]
    expect(point.fontSizePercent).toBeGreaterThanOrEqual(40)
    expect(point.fontSizePercent).toBeLessThanOrEqual(250)
  })

  it("refuses slides that have no text to restyle", () => {
    for (const type of ["media", "presentation", "camera"]) {
      expect(applyLook(base({ type }), starter("verse")), type).toBeNull()
    }
    expect(applyLook(base({ layout: "interlude" }), starter("verse"))).toBeNull()
    expect(applyLook(base({ slideMode: "overlay" }), starter("verse"))).toBeNull()
  })

  it("refuses templates that cannot take a look", () => {
    // A template with no main box has nowhere to put the words.
    expect(
      applyLook(base({ contents: ["", "x"] }), {
        ...starter("welcome"),
        looks: [],
      })
    ).toBeNull()
    const song = base({ type: "song", layout: "full-text", contents: ["", "x"] })
    expect(applyLook(song, starter("scripture-caption"))).not.toBeNull()
    expect(applyLook(verse({ type: "song" }), starter("verse"))).not.toBeNull()
  })
})

describe("designFromSlide", () => {
  it("replaces written text with a prompt unless asked to keep it", () => {
    const slide = base({
      backgroundType: "gradient",
      background: "linear-gradient(#000,#111)",
      slideStyle: {
        textBoxes: [
          { id: "a", x: 0.1, y: 0.1, w: 0.5, h: 0.2, source: "custom", html: "<p>Easter lunch at Rebecca's</p>" },
        ],
      },
    })
    expect(designFromSlide(slide)!.boxes[0].html).toBe("<p>Text 1</p>")
    expect(designFromSlide(slide, { keepText: true })!.boxes[0].html).toContain("Easter")
  })

  it("turns a verse slide's own boxes into roles", () => {
    const slide = base({
      type: "bible",
      layout: "bible",
      contents: ["verse", "ref"],
      slideStyle: {
        textBoxes: [
          { id: "a", x: 0.1, y: 0.1, w: 0.8, h: 0.5, source: 0 },
          { id: "b", x: 0.1, y: 0.8, w: 0.5, h: 0.1, source: 1 },
        ],
      },
    })
    const design = designFromSlide(slide)!
    expect(design.boxes.map((b) => b.role)).toEqual(["body", "ref"])
    expect(design.boxes.every((b) => b.source === "custom")).toBe(true)
  })

  it("returns null for a slide with no free layout boxes", () => {
    expect(designFromSlide(base())).toBeNull()
  })
})

describe("song, hymn and Bible versions", () => {
  // Text-only looks (the multi-box designs) are covered by their own tests.
  const withLooks = starterTemplates.filter(
    (t) => t.looks.length && !(t.looks.length === 1 && t.looks[0] === "text")
  )

  it("has a design for every kind of slide with words", () => {
    expect(withLooks.length).toBeGreaterThanOrEqual(12)
    for (const template of withLooks) {
      expect(template.looks, template.name).toEqual(
        expect.arrayContaining(template.looks.includes("song") && template.looks.length === 1 ? ["song"] : ["scripture", "song", "text"])
      )
      const roles = template.design.boxes.map((b) => b.role)
      expect(roles.filter((r) => r === "body"), template.name).toHaveLength(1)
    }
  })

  it("puts a verse, a hymn line and a heading into each of them", () => {
    const verse = base({ type: "bible", layout: "bible", contents: ["For God so loved", "John 3:16"] })
    const hymn = base({ type: "hymn", layout: "full-text", contents: ["", "Great is thy faithfulness"] })
    const heading = base({ layout: "heading-and-subtitle", contents: ["Easter", "Sunday 6 AM"] })
    for (const template of withLooks.filter((t) => t.looks.length === 3)) {
      for (const slide of [verse, hymn, heading]) {
        const looked = applyLook(slide, template)
        expect(looked, `${template.name} on ${slide.type}`).not.toBeNull()
        expect(looked!.contents).toEqual(slide.contents)
        for (const box of looked!.slideStyle!.textBoxes!) {
          expect(box.fontSizePercent).toBeGreaterThanOrEqual(40)
          expect(box.fontSizePercent).toBeLessThanOrEqual(250)
        }
      }
    }
  })
})

describe("bibleSampleOf", () => {
  it("finds a sample verse only in templates made for scripture", () => {
    const verse = bibleSampleOf(starter("verse"))
    expect(verse).toEqual({ label: "Psalm 23:1", content: "The Lord is my shepherd; I shall not want." })
    expect(bibleSampleOf(starter("welcome"))).toBeNull()
    expect(bibleSampleOf(starter("lyric"))).toBeNull()
  })

  it("makes a template that fits a verse restyle a Bible slide", () => {
    const sample = bibleSampleOf(starter("glow-verse"))!
    const bible = base({ type: "bible", layout: "bible", contents: [sample.content, sample.label] })
    const looked = applyLook(bible, starter("glow-verse"))!
    expect(looked.type).toBe("bible")
    expect(looked.slideStyle!.textBoxes).toHaveLength(2)
  })
})

describe("template motion", () => {
  it("uses only kinds the projector can draw", () => {
    for (const template of starterTemplates) {
      if (template.design.motion)
        expect(isTemplateMotion(template.design.motion), template.name).toBe(true)
    }
    expect(isTemplateMotion("video")).toBe(false)
    expect(templateMotionKinds).toHaveLength(12)
  })

  it("is copied onto the slide and ends when the background is replaced", () => {
    const slide = slideFromTemplate(base(), starter("verse"))
    expect(slide.slideStyle!.backgroundMotion).toBe("rays")
    expect(motionOf(slide)).toBe("rays")
    expect(motionOf({ ...slide, background: "https://cdn.example/photo.jpg" })).toBeNull()
    expect(motionOf(base())).toBeNull()
  })

  it("swaps in a picture without the circles the motion draws", () => {
    for (const key of ["series", "soon", "risen", "orbit-verse", "side-panel", "give", "sunrise"]) {
      const slide = slideFromTemplate(base(), starter(key))
      expect(motionBackgroundOf(slide), key).toMatch(/^\/templates\/bg\/[a-z-]+-base\.svg$/)
    }
    // A photo ends the motion, so the base must not outlive it.
    const slide = slideFromTemplate(base(), starter("series"))
    expect(motionBackgroundOf({ ...slide, background: "https://x/y.jpg" })).toBeNull()
    expect(motionBackgroundOf(slideFromTemplate(base(), starter("verse")))).toBeNull()
  })

  it("comes along when a verse takes a look", () => {
    const verse = base({ type: "bible", layout: "bible", contents: ["a", "b"] })
    expect(motionOf(applyLook(verse, starter("aurora-verse"))!)).toBe("aurora")
    expect(motionOf(applyLook(verse, starter("warm-paper"))!)).toBeNull()
  })

  it("scatters the same pieces every time, already in flight", () => {
    const a = motionPieces(12, 7, [1, 2], [6, 11])
    expect(motionPieces(12, 7, [1, 2], [6, 11])).toEqual(a)
    expect(a.every((p) => p.delay <= 0 && p.duration >= 6 && p.duration <= 11)).toBe(true)
  })

  it("surges harder on slower loops, within limits", () => {
    expect(surgePeak(5000)).toBeGreaterThanOrEqual(3)
    expect(surgePeak(140000)).toBeLessThanOrEqual(14)
    expect(surgePeak(140000)).toBeGreaterThan(surgePeak(22000))
  })
})

describe("showsDesignedBackground", () => {
  it("shows a template's own background undimmed", () => {
    expect(showsDesignedBackground(slideFromTemplate(base(), starter("verse")))).toBe(true)
    expect(showsDesignedBackground(slideFromTemplate(base(), starter("name-bar")))).toBe(true)
  })

  it("dims a photo the church puts on a template slide, and every other slide", () => {
    const slide = slideFromTemplate(base(), starter("verse"))
    expect(
      showsDesignedBackground({ ...slide, background: "https://cdn.example/photo.jpg" })
    ).toBe(false)
    expect(showsDesignedBackground({ ...slide, backgroundType: "video" })).toBe(false)
    expect(showsDesignedBackground(base({ backgroundType: "gradient" }))).toBe(false)
  })
})
