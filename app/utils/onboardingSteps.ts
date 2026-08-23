import type { Alignment, Side } from "driver.js"

/**
 * One stop on the product tour. `anchor` is matched against the
 * `data-tour="..."` attribute on the element the step points at, so the tour
 * never depends on Tailwind classes or DOM structure that will churn.
 */
export interface TourStep {
  /** Stable id — used for analytics and for resuming a partially-seen tour. */
  id: string
  /** Value of the `data-tour` attribute on the target element. */
  anchor: string
  /** Shown in the popover's header bar. */
  title: string
  /** Body copy inside the popover card. */
  body: string
  side?: Side
  align?: Alignment
  /**
   * Lets the operator use the whole app during this step instead of freezing
   * everything outside the spotlight. Set on steps that ask them to do something.
   */
  interactive?: boolean
  /**
   * Blocks "Next" until `selector` exists in the DOM. Used to make a step wait
   * on real progress (e.g. a Bible slide actually being selected) rather than
   * letting the operator skip past a step the rest of the tour depends on.
   */
  requires?: {
    selector: string
    /** Shown in place of the button row while the requirement is unmet. */
    hint: string
  }
}

/**
 * Copy for the welcome card that opens the tour.
 */
export const onboardingWelcome = {
  /** Small label in the card's header bar. */
  eyebrow: "Welcome to Cloud of Worship",
  title: "Let's make you a pro in no time",
  description:
    "A quick, 2-minute tour of everything you need to prepare, manage, and run your service: from lyrics and scripture to the live screen. Don't skip",
  cta: "Show me around",
}

/** Anchor that only renders while a Bible slide is being edited. */
const BIBLE_SLIDE_ACTIVE = '[data-tour="bible-version"]'

/**
 * The operator-window tour. It walks the three panels left-to-right, then drops
 * into the editor — which is why the "pick a Bible slide" step is gated: every
 * step after it points at toolbar controls that only exist for an active slide.
 */export const onboardingSteps: TourStep[] = [
  {
    id: "magic-search",
    anchor: "quick-actions-search",
    title: "Quick Search Bar",
    body: "Search for anything you want to do — a Bible passage, a Bible reference, a hymn, a song lyric, an app setting or anything you need. Just start typing.",
    side: "right",
    align: "start",
  },
  {
    id: "quick-actions",
    anchor: "quick-actions-list",
    title: "Quick Actions",
    body: "Every way to build a slide lives here: scripture, song lyrics, hymns, media, countdown timers, banners and imported slides.",
    side: "right",
    align: "start",
  },
  {
    id: "preview-content",
    anchor: "preview-slides",
    title: "Preview and Edit Content",
    body: "Every slide you create lands here. Click one to open it in the editor below, or double-click to send it straight to the live screen.",
    side: "bottom",
    align: "start",
  },
  {
    id: "slide-schedule",
    anchor: "schedule-slides",
    title: "Slide Schedule",
    body: "This is your service running order. Drag slides to reorder them, single-click to take one live, and double-click to pull it back into the editor for a quick change.",
    side: "left",
    align: "start",
  },
  {
    id: "live-preview",
    anchor: "live-preview",
    title: "Live Preview",
    body: "This is exactly what your congregation would see on the second screen the moment you go live.",
    side: "left",
    align: "start",
  },
  {
    id: "go-live",
    anchor: "go-live",
    title: "Go Live",
    body: "Open the live window on your second screen, or copy a livestream URL for livestreaming platforms. This is the switch that makes your live preview visible.",
    side: "left",
    align: "start",
  },
  {
    id: "select-bible-slide",
    anchor: "preview-slides",
    title: "Open a Bible slide",
    body: "The rest of the tour walks through the slide editor, so pick a Bible slide to work with. Click one here, or search a passage like “John 3 16” in the Quick Search Bar to create one.",
    side: "bottom",
    align: "start",
    interactive: true,
    requires: {
      selector: BIBLE_SLIDE_ACTIVE,
      hint: "Select a Bible slide to continue",
    },
  },
  {
    id: "verse-switch",
    anchor: "verse-switch",
    title: "Verse Switcher",
    body: "Type a reference straight into this box and press Enter. Shorthand works, so “mat 28 19” gets you Matthew 28:19 — abbreviate the book, and use spaces instead of a colon. The arrows step one verse at a time, and once you are out of the box, Arrow Right and Arrow Left move through verses — or through the pages of an imported slide deck.",
    side: "bottom",
    align: "start",
  },
  {
    id: "editor-go-live",
    anchor: "editor-go-live",
    title: "Take Slide Live",
    body: "This button promotes whatever you're editing to the live screen instantly, without leaving the editor. It's the one to reach for when a scripture is called out mid-sermon.",
    side: "bottom",
    align: "end",
  },
  {
    id: "format-font-size",
    anchor: "format-font-size",
    title: "Text Formatting",
    body: "Size the text to the room here. The rest of this toolbar covers the finer formatting — font, line spacing, alignment, UPPERCASE, bold, and a line highlight that keeps words readable over a busy background image.",
    side: "bottom",
    align: "start",
  },
]
