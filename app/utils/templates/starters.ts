import type {
  Template,
  TemplateBox,
  TemplateBoxRole,
  TemplateCategory,
  TemplateDesign,
  TemplateLook,
  TemplateMotion,
  TransitionType,
} from "~/types"

/**
 * The starter templates. They ship in the app, so the gallery needs no network
 * and no database, works offline and costs the API nothing. This file is
 * loaded only when the gallery opens (see `useTemplateGallery`).
 *
 * Sizes are written in cqw, the unit a slide's text is drawn in (a text slide's
 * base is 3cqw). `box()` turns that into what a slide stores: a box size of 40
 * to 250 percent, plus an inline `em` for anything bigger, up to 400 percent.
 */

const DISPLAY = "Bricolage Grotesque Condensed"
const SANS = "Geist"
const BASE_CQW = 3
const MIN_PCT = 40
const MAX_PCT = 250
const MAX_INLINE_EM = 4

// The thin half of a heavy and thin headline. Inline, because a box can only
// be bold or not.
const thin = (text: string) => `<span style="font-weight:200">${text}</span>`
// Semibold, which a box's bold switch can't ask for.
const semi = (text: string) => `<span style="font-weight:600">${text}</span>`

interface BoxOptions {
  color: string
  font?: typeof DISPLAY | typeof SANS
  align?: "left" | "center" | "right"
  bold?: boolean
  upper?: boolean
  role?: TemplateBoxRole
}

const box = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  cqw: number,
  text: string,
  { color, font = SANS, align = "left", bold, upper, role }: BoxOptions
): TemplateBox => {
  const ratio = cqw / BASE_CQW
  const pct = Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(ratio * 100)))
  const inline = Math.min(MAX_INLINE_EM, (ratio * 100) / pct)
  const inner =
    inline > 1.02
      ? `<span style="font-size:${inline.toFixed(2)}em">${text}</span>`
      : text
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    x,
    y,
    w,
    h,
    source: "custom",
    html: `<p>${inner}</p>`,
    fontSizePercent: pct,
    alignment: align,
    color,
    font,
    ...(bold ? { bold: true } : {}),
    ...(upper ? { uppercase: true } : {}),
    ...(role ? { role } : {}),
  }
}

const bg = (
  file: string,
  /** A copy of the picture without the circles its motion draws itself. */
  base?: string
): Pick<TemplateDesign, "backgroundType" | "background" | "motionBackground"> => ({
  backgroundType: "image",
  background: `/templates/bg/${file}.svg`,
  ...(base ? { motionBackground: `/templates/bg/${base}.svg` } : {}),
})
const gradient = (css: string) =>
  ({ backgroundType: "gradient", background: css }) as const

interface Spec {
  key: string
  name: string
  category: TemplateCategory
  description: string
  design: Omit<TemplateDesign, "boxes">
  boxes: TemplateBox[]
  transition: TransitionType
  looks?: TemplateLook[]
  /** Slow motion over the background on the projector. */
  motion?: TemplateMotion
}

const make = (spec: Spec): Template => {
  const design: TemplateDesign = {
    ...spec.design,
    transition: spec.transition,
    ...(spec.motion ? { motion: spec.motion } : {}),
    boxes: spec.boxes,
  }
  return {
    _id: `starter:${spec.key}`,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    source: "starter",
    design,
    // A template with a main box can restyle a text slide, bringing the
    // slide's other boxes into its own. Verses and songs need a design made
    // for them, so those are listed on the template.
    looks: spec.looks ?? (spec.boxes.some((b) => b.role === "body") ? ["text"] : []),
  }
}

const NIGHT = "#0c0f19"
const WHITE = "#ffffff"
// Labels on cream: dark enough to read, and not the app's purple.
const AMBER = "#9a3f06"

export const starterTemplates: Template[] = [
  make({
    key: "welcome",
    name: "Welcome home",
    category: "general",
    description: "Opens the service, with what a newcomer needs along the bottom.",
    design: { ...bg("welcome") },
    transition: "drift",
    motion: "aurora",
    boxes: [
      box("Eyebrow", 0.0625, 0.09, 0.6, 0.09, 3, "Sunday service", { color: "#d8b4fe", upper: true, bold: true }),
      box("Headline", 0.0625, 0.2, 0.88, 0.4, 14, `Welcome ${thin("home.")}`, { color: WHITE, font: DISPLAY, bold: true, role: "body" }),
      box("Service", 0.23, 0.86, 0.23, 0.075, 2.4, "9:00 and 11:30 AM", { color: "#e9d5ff" }),
      box("Kids", 0.48, 0.86, 0.23, 0.075, 2.4, "Kids: Room 4", { color: "#e9d5ff" }),
      box("Wi-Fi", 0.73, 0.86, 0.23, 0.075, 2.4, "Wi-Fi: GraceGuest", { color: "#e9d5ff", align: "right" }),
    ],
  }),
  make({
    key: "series",
    name: "Series title",
    category: "sermon",
    description: "The poster for a sermon series. One word owns the slide.",
    design: { ...bg("series", "series-base") },
    transition: "breathe",
    motion: "orbit",
    boxes: [
      box("Kicker", 0.0625, 0.08, 0.5, 0.09, 3, "A series in Nehemiah", { color: NIGHT, upper: true, bold: true }),
      box("Part", 0.62, 0.08, 0.32, 0.09, 3, "Part 3 of 6", { color: NIGHT, upper: true, bold: true, align: "right" }),
      box("Title", 0.0625, 0.16, 0.88, 0.55, 19, `Re${thin("build.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Promise", 0.46, 0.72, 0.48, 0.2, 3.4, "What God builds when we come back home.", { color: NIGHT, align: "right" }),
    ],
  }),
  make({
    key: "verse",
    name: "Verse on a page",
    category: "sermon",
    description: "One verse set large, with the reference pinned low right.",
    design: { ...bg("verse") },
    transition: "fade",
    motion: "rays",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Verse", 0.1, 0.14, 0.8, 0.5, 9, `The Lord is my shepherd; ${thin("I shall not want.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Reference", 0.5, 0.83, 0.4, 0.09, 3, "Psalm 23:1", { color: "#8a41c9", upper: true, bold: true, align: "right", role: "ref" }),
    ],
  }),
  make({
    key: "glow-verse",
    name: "Verse in candlelight",
    category: "worship",
    description: "A warm glow from below. For scripture, and for songs that need a quiet room.",
    design: { ...bg("glowverse"), textColor: "#f5e9d8" },
    transition: "fade",
    motion: "candle",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Verse", 0.1, 0.18, 0.8, 0.5, 6, "Be still, and know that I am God.", { color: "#f5e9d8", bold: true, align: "center", role: "body" }),
      box("Reference", 0.3, 0.78, 0.4, 0.09, 3, "Psalm 46:10", { color: "#e8b067", upper: true, bold: true, align: "center", role: "ref" }),
    ],
  }),
  make({
    key: "poster-verse",
    name: "Verse on purple",
    category: "sermon",
    description: "Bold and bright, in the app's own purple. Reads from the back of the room.",
    design: { ...bg("posterverse"), textColor: NIGHT },
    transition: "breathe",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Verse", 0.08, 0.12, 0.84, 0.6, 8, "Come, let us rebuild the wall of Jerusalem.", { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Reference", 0.08, 0.82, 0.5, 0.09, 3.2, "Nehemiah 2:17", { color: NIGHT, upper: true, bold: true, role: "ref" }),
    ],
  }),
  make({
    key: "point",
    name: "Sermon point",
    category: "sermon",
    description: "A big numeral in a gold panel, the point beside it, one line of support.",
    design: { ...bg("point") },
    transition: "cascade",
    boxes: [
      box("Number", 0.03, 0.06, 0.32, 0.56, 20, "1", { color: NIGHT, font: DISPLAY, bold: true, align: "center" }),
      box("Of", 0.44, 0.1, 0.4, 0.09, 3, "Point 1 of 3", { color: "#fbbf24", upper: true, bold: true }),
      box("Point", 0.44, 0.22, 0.5, 0.46, 8.5, `Rest is not ${thin("laziness.")}`, { color: WHITE, font: DISPLAY, bold: true, role: "body" }),
      box("Support", 0.44, 0.71, 0.48, 0.19, 3.4, "God rested, and he never needed to.", { color: "#c9ccdc" }),
    ],
  }),
  make({
    key: "announce",
    name: "This Sunday",
    category: "announcement",
    description: "The date on a calendar page, with when and where beside it.",
    design: { ...bg("announce") },
    transition: "drift",
    boxes: [
      box("Headline", 0.0625, 0.06, 0.62, 0.33, 11, `This ${thin("Sunday.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Month", 0.05, 0.42, 0.225, 0.08, 3, "Nov", { color: WHITE, upper: true, bold: true, align: "center" }),
      box("Date", 0.05, 0.49, 0.225, 0.33, 11, "30", { color: NIGHT, font: DISPLAY, bold: true, align: "center" }),
      box("When label", 0.3, 0.47, 0.13, 0.1, 2.9, "When", { color: AMBER, upper: true, bold: true }),
      box("When", 0.43, 0.44, 0.52, 0.17, 6, "9:00 and 11:30 AM", { color: NIGHT, font: DISPLAY, bold: true }),
      box("Where label", 0.3, 0.69, 0.13, 0.1, 2.9, "Where", { color: AMBER, upper: true, bold: true }),
      box("Where", 0.43, 0.66, 0.52, 0.17, 6, "Main Hall, Grace Ave", { color: NIGHT, font: DISPLAY, bold: true }),
    ],
  }),
  make({
    key: "prayer",
    name: "Let us pray",
    category: "prayer",
    description: "Quiet and centred, with rings around the words like a held breath.",
    design: { ...bg("prayer") },
    transition: "breathe",
    motion: "breathe",
    boxes: [
      box("Prayer", 0.15, 0.27, 0.7, 0.34, 12, `Let us ${thin("pray.")}`, { color: WHITE, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Invitation", 0.22, 0.68, 0.56, 0.2, 3.4, "Come forward if you would like prayer.", { color: "#c9b8f5", align: "center" }),
    ],
  }),
  make({
    key: "give",
    name: "Giving",
    category: "general",
    description: "The invitation on the left, three ways to give on the right.",
    design: { ...bg("give", "give-base") },
    transition: "cascade",
    motion: "pulse",
    boxes: [
      box("Headline", 0.0625, 0.1, 0.45, 0.26, 8.5, `Give ${thin("gladly.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Verse", 0.0625, 0.4, 0.4, 0.18, 3.2, "God loves a cheerful giver. 2 Cor 9:7", { color: "#2f6b45" }),
      box("Number 1", 0.506, 0.35, 0.05, 0.09, 3, semi("1"), { color: "#e3f5e9", align: "center" }),
      box("Way 1", 0.57, 0.3, 0.39, 0.19, 3.4, "Scan the code on your seat", { color: NIGHT, bold: true }),
      box("Number 2", 0.506, 0.57, 0.05, 0.09, 3, semi("2"), { color: "#e3f5e9", align: "center" }),
      box("Way 2", 0.57, 0.52, 0.39, 0.19, 3.4, "yourchurch.org/give", { color: NIGHT, bold: true }),
      box("Number 3", 0.506, 0.79, 0.05, 0.09, 3, semi("3"), { color: "#e3f5e9", align: "center" }),
      box("Way 3", 0.57, 0.74, 0.39, 0.19, 3.4, "Baskets at every door", { color: NIGHT, bold: true }),
    ],
  }),
  make({
    key: "soon",
    name: "Starting soon",
    category: "live",
    description: "The pre-service slide. Loud on purpose, with the time on the right.",
    design: { ...bg("soon", "soon-base") },
    transition: "fade",
    motion: "settle",
    boxes: [
      box("Headline", 0.0625, 0.1, 0.88, 0.4, 14, `Starting ${thin("soon.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Time", 0.56, 0.55, 0.38, 0.29, 10, "9:00 AM", { color: NIGHT, font: DISPLAY, bold: true, align: "right" }),
      box("Note", 0.46, 0.85, 0.48, 0.09, 3, "Phones on silent, please.", { color: NIGHT, align: "right" }),
    ],
  }),
  make({
    key: "lyric",
    name: "Lyric and translation",
    category: "worship",
    description: "The sung line above, its meaning below, for congregations that sing in two languages.",
    design: { ...bg("lyric") },
    transition: "fade",
    motion: "rise",
    looks: ["song"],
    boxes: [
      box("Lyric", 0.08, 0.1, 0.84, 0.5, 9, "Amazing grace, how sweet the sound", { color: WHITE, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Translation", 0.2, 0.64, 0.6, 0.24, 4.2, "<em>Gracia asombrosa, qué dulce el son</em>", { color: "#c9b8f5", align: "center" }),
    ],
  }),
  make({
    key: "versions",
    name: "Two translations",
    category: "sermon",
    description: "The same verse in two versions side by side, with a hairline between.",
    design: { ...bg("versions") },
    transition: "cascade",
    boxes: [
      box("Version A", 0.0625, 0.11, 0.4, 0.09, 2.9, "KJV", { color: "#c084fc", upper: true, bold: true }),
      box("Text A", 0.0625, 0.21, 0.39, 0.46, 4, "For God so loved the world, that he gave his only begotten Son.", { color: WHITE, bold: true, role: "body" }),
      box("Version B", 0.54, 0.11, 0.4, 0.09, 2.9, "WEB", { color: "#c084fc", upper: true, bold: true }),
      box("Text B", 0.54, 0.21, 0.39, 0.46, 4, "For God so loved the world, that he gave his one and only Son.", { color: WHITE, bold: true }),
      box("Reference", 0.5, 0.83, 0.44, 0.09, 3, "John 3:16", { color: "#d8b4fe", upper: true, bold: true, align: "right" }),
    ],
  }),
  make({
    key: "birthdays",
    name: "Happy birthday",
    category: "announcement",
    description: "This week's birthdays in two neat columns.",
    design: { ...bg("celebrate") },
    transition: "drift",
    motion: "confetti",
    boxes: [
      box("Headline", 0.1, 0.07, 0.8, 0.34, 12, `Happy ${thin("birthday!")}`, { color: NIGHT, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Names left", 0.17, 0.48, 0.31, 0.22, 3.8, "Rebecca Hall<br>Joshua Tan", { color: NIGHT, bold: true, align: "right" }),
      box("Names right", 0.52, 0.48, 0.31, 0.22, 3.8, "Naomi Mensah<br>Caleb Wright", { color: NIGHT, bold: true }),
      box("Note", 0.15, 0.82, 0.7, 0.09, 2.8, "Say happy birthday after the service", { color: "#b4233a", upper: true, bold: true, align: "center" }),
    ],
  }),
  make({
    key: "risen",
    name: "He is risen",
    category: "announcement",
    description: "A seasonal poster. Swap the words for Christmas, Harvest or a conference.",
    design: { ...bg("risen", "risen-base") },
    transition: "breathe",
    motion: "daybreak",
    boxes: [
      box("Headline", 0.08, 0.05, 0.84, 0.43, 15, `He is ${thin("risen.")}`, { color: WHITE, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Details", 0.22, 0.85, 0.56, 0.09, 3, "Easter Sunday · 6:00 AM", { color: WHITE, upper: true, bold: true, align: "center" }),
    ],
  }),
  // Song, hymn and Bible versions of the designs above: same backgrounds and
  // motion, with the words in a body box and the reference in a ref box.
  make({
    key: "aurora-verse",
    name: "Aurora",
    category: "worship",
    description: "Soft purple light drifting behind the words. For scripture and slow songs.",
    design: { ...bg("welcome") },
    transition: "drift",
    motion: "aurora",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.1, 0.12, 0.8, 0.6, 7, `The Lord bless you ${thin("and keep you.")}`, { color: WHITE, font: DISPLAY, bold: true, role: "body" }),
      box("Reference", 0.5, 0.86, 0.44, 0.08, 3, "Numbers 6:24", { color: "#d8b4fe", upper: true, bold: true, align: "right", role: "ref" }),
    ],
  }),
  make({
    key: "orbit-verse",
    name: "Orbit",
    category: "sermon",
    description: "Bold purple with slow turning rings. Reads from the back of the room.",
    design: { ...bg("series", "series-base"), textColor: NIGHT },
    transition: "breathe",
    motion: "orbit",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.0625, 0.14, 0.56, 0.6, 7, `I will build ${thin("my church.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Reference", 0.0625, 0.82, 0.5, 0.09, 3.2, "Matthew 16:18", { color: NIGHT, upper: true, bold: true, role: "ref" }),
    ],
  }),
  make({
    key: "quiet-night",
    name: "Quiet night",
    category: "prayer",
    description: "Deep blue with rings that breathe. For prayer songs and scripture.",
    design: { ...bg("prayer") },
    transition: "breathe",
    motion: "breathe",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.15, 0.18, 0.7, 0.52, 6.5, `Be still before ${thin("the Lord.")}`, { color: WHITE, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Reference", 0.3, 0.76, 0.4, 0.09, 3, "Psalm 37:7", { color: "#c9b8f5", upper: true, bold: true, align: "center", role: "ref" }),
    ],
  }),
  make({
    key: "warm-paper",
    name: "Warm paper",
    category: "worship",
    description: "A sheet of cream paper with a folded corner. For hymns and long verses.",
    design: { ...bg("paper"), textColor: NIGHT },
    transition: "drift",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.0625, 0.08, 0.72, 0.5, 6, `Taste and see ${thin("that the Lord is good.")}`, { color: NIGHT, font: DISPLAY, bold: true, role: "body" }),
      box("Reference", 0.3, 0.87, 0.64, 0.08, 3, "Psalm 34:8", { color: AMBER, upper: true, bold: true, align: "right", role: "ref" }),
    ],
  }),
  make({
    key: "side-panel",
    name: "Side panel",
    category: "sermon",
    description: "The reference in a purple panel, the words beside it. The ring pings on the next verse.",
    design: { ...bg("sidepanel", "sidepanel-base") },
    transition: "cascade",
    motion: "ping",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.44, 0.12, 0.5, 0.76, 4.6, "For God so loved the world, that he gave his only Son.", { color: WHITE, bold: true, role: "body" }),
      box("Reference", 0.03, 0.3, 0.32, 0.4, 5, "John 3:16", { color: NIGHT, font: DISPLAY, bold: true, align: "center", role: "ref" }),
    ],
  }),
  make({
    key: "sunrise",
    name: "Sunrise",
    category: "worship",
    description: "A sunrise over the hills, the glow around the sun swelling slowly. For Easter and songs of hope.",
    design: { ...bg("risen", "risen-base") },
    transition: "breathe",
    motion: "daybreak",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.1, 0.17, 0.8, 0.36, 5.4, `Joy comes ${thin("in the morning.")}`, { color: WHITE, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Reference", 0.3, 0.07, 0.4, 0.08, 3, "Psalm 30:5", { color: "#ffe7a8", upper: true, bold: true, align: "center", role: "ref" }),
    ],
  }),
  make({
    key: "celebration",
    name: "Celebration",
    category: "worship",
    description: "Confetti on pink. For praise songs and thanksgiving.",
    design: { ...bg("celebrate"), textColor: NIGHT },
    transition: "drift",
    motion: "confetti",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Words", 0.1, 0.16, 0.8, 0.52, 6.6, `Shout for joy ${thin("to the Lord.")}`, { color: NIGHT, font: DISPLAY, bold: true, align: "center", role: "body" }),
      box("Reference", 0.3, 0.78, 0.4, 0.09, 3, "Psalm 100:1", { color: "#b4233a", upper: true, bold: true, align: "center", role: "ref" }),
    ],
  }),
  make({
    key: "name-bar",
    name: "Name bar",
    category: "live",
    description: "Who is speaking, low on the screen. The name and role ease in. In a pair with a camera, the name shows.",
    design: gradient("linear-gradient(135deg,#1d2a44 0%,#33224f 55%,#5a3a6e 100%)"),
    transition: "drift",
    motion: "reveal",
    boxes: [
      box("Name", 0.085, 0.7, 0.7, 0.15, 5.2, "Pastor Daniel Carter", { color: WHITE, font: DISPLAY, bold: true, role: "body" }),
      box("Role", 0.085, 0.85, 0.7, 0.08, 2.8, "Lead Pastor · Rebuild, part 3", { color: "#d8b4fe", upper: true, bold: true }),
    ],
  }),
  make({
    key: "scripture-caption",
    name: "Scripture caption",
    category: "live",
    description: "The verse being read, low on the screen. Good beside a camera in a pair.",
    design: gradient("linear-gradient(180deg,#0c0f19 0%,#140c22 100%)"),
    transition: "fade",
    looks: ["scripture", "song", "text"],
    boxes: [
      box("Reference", 0.0625, 0.64, 0.5, 0.09, 3, "Nehemiah 2:17", { color: "#ffb38a", upper: true, bold: true, role: "ref" }),
      box("Verse", 0.0625, 0.74, 0.875, 0.22, 4, "Come, let us rebuild the wall of Jerusalem.", { color: WHITE, bold: true, role: "body" }),
    ],
  }),
]

export const starterById = (id: string) =>
  starterTemplates.find((template) => template._id === id)
