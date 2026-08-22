/**
 * Single source of truth for every keyboard shortcut in the app.
 *
 * Three surfaces read from this list, so they can never drift apart:
 *   1. `useRegisteredShortcut(id, action)` binds the key handler from `combo`.
 *   2. `CowTooltip` renders the keycap chips from `combo`.
 *   3. `ShortcutsModal` renders the full reference sheet.
 *
 * `combo` uses a normalised, platform-neutral notation:
 *   - `Mod`   → Cmd on macOS, Ctrl everywhere else
 *   - `Shift` / `Alt`
 *   - the key itself: a single character, or a `KeyboardEvent.key` name
 *     (`ArrowUp`, `Escape`, `Enter`, `F5`, …)
 * `useShortcutLabel` turns that into the symbols a user actually sees.
 */

export type ShortcutScope =
  | "global"
  | "schedule"
  | "editor"
  | "slide"
  | "live"

export interface ShortcutDefinition {
  id: string
  combo: string
  label: string
  scope: ShortcutScope
  /**
   * Fires even while a text field or the slide editor has focus. Only safe for
   * modifier chords that can't be mistaken for typing.
   */
  allowInEditable?: boolean
  /**
   * Bound by a third party (TipTap's own extensions register the formatting
   * chords), so we render the label but never attach a handler.
   */
  external?: boolean
  /**
   * Documented as a range rather than a single bindable key (e.g. Mod+1..9).
   * Rendered in the modal, never bound directly.
   */
  displayOnly?: boolean
  /** Hidden from the shortcuts modal — an alias or an internal duplicate. */
  hidden?: boolean
}

export const shortcutIds = {
  // Global
  quickActions: "quick-actions",
  quickActionsSlash: "quick-actions-slash",
  shortcutsModal: "shortcuts-modal",
  shortcutsModalAlt: "shortcuts-modal-alt",
  openSchedules: "open-schedules",
  settings: "settings",
  undo: "undo",
  redo: "redo",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
  promoteActiveSlide: "promote-active-slide",

  // Slide schedule
  nextSlide: "next-slide",
  previousSlide: "previous-slide",
  slideByNumber: "slide-by-number",
  lastSlide: "last-slide",
  blankOutput: "blank-output",

  // Live / stage window
  fullscreen: "fullscreen",
  nextVerse: "next-verse",
  previousVerse: "previous-verse",

  // Slide styling & media (SlideContentToolbar)
  slideBold: "slide-bold",
  slideUppercase: "slide-uppercase",
  slideLineBackground: "slide-line-background",
  slideAlignLeft: "slide-align-left",
  slideAlignCenter: "slide-align-center",
  slideAlignRight: "slide-align-right",
  fontSizeIncrease: "font-size-increase",
  fontSizeDecrease: "font-size-decrease",
  muteMedia: "mute-media",
  playPauseMedia: "play-pause-media",

  // Slide editor (bound by TipTap)
  bold: "bold",
  italic: "italic",
  strike: "strike",
  heading1: "heading-1",
  heading2: "heading-2",
  heading3: "heading-3",
  paragraph: "paragraph",
  bulletList: "bullet-list",
  orderedList: "ordered-list",
  alignLeft: "align-left",
  alignCenter: "align-center",
  alignRight: "align-right",
  blockquote: "blockquote",
  codeBlock: "code-block",
} as const

export type ShortcutId = (typeof shortcutIds)[keyof typeof shortcutIds]

export const shortcuts: ShortcutDefinition[] = [
  // ─── GLOBAL ────────────────────────────────────────────────────────────────
  {
    id: shortcutIds.quickActions,
    combo: "Mod+K",
    label: "Search actions, songs, scriptures and anything else",
    scope: "global",
    allowInEditable: true,
  },
  {
    id: shortcutIds.quickActionsSlash,
    combo: "/",
    label: "Jump to the quick actions search",
    scope: "global",
  },
  {
    id: shortcutIds.shortcutsModal,
    combo: "?",
    label: "Open this shortcuts sheet",
    scope: "global",
  },
  {
    id: shortcutIds.shortcutsModalAlt,
    combo: "Mod+H",
    label: "Open this shortcuts sheet",
    scope: "global",
    // macOS reserves Cmd+H for "Hide Application", so it never reaches us in
    // the desktop build. Kept as a Windows/Linux alias, documented as `?`.
    hidden: true,
  },
  {
    id: shortcutIds.openSchedules,
    combo: "Mod+Shift+S",
    label: "Open the schedules list",
    scope: "global",
    // The slide editor deliberately yields this chord back (see the
    // cowEditorKeymap extension in TipTap.client.vue), so it behaves the same
    // whether or not the caret is in a text slide.
    allowInEditable: true,
  },
  {
    id: shortcutIds.settings,
    combo: "Mod+,",
    label: "Open app settings",
    scope: "global",
  },
  {
    id: shortcutIds.undo,
    combo: "Mod+Z",
    label: "Undo the previous action",
    scope: "global",
    hidden: true,
  },
  {
    id: shortcutIds.redo,
    combo: "Mod+Y",
    label: "Redo the previous action",
    scope: "global",
    hidden: true,
  },
  {
    id: shortcutIds.promoteActiveSlide,
    combo: "Mod+P",
    label: "Promote the slide you're previewing to the live display",
    scope: "global",
  },
  {
    id: shortcutIds.zoomIn,
    combo: "Mod++",
    label: "Zoom in / increase display size",
    scope: "global",
  },
  {
    id: shortcutIds.zoomOut,
    combo: "Mod+-",
    label: "Zoom out / decrease display size",
    scope: "global",
  },

  // ─── SLIDE SCHEDULE ────────────────────────────────────────────────────────
  {
    id: shortcutIds.nextSlide,
    combo: "ArrowDown",
    label: "Send the next slide in the schedule live",
    scope: "schedule",
  },
  {
    id: shortcutIds.previousSlide,
    combo: "ArrowUp",
    label: "Send the previous slide in the schedule live",
    scope: "schedule",
  },
  {
    id: shortcutIds.slideByNumber,
    combo: "Mod+1…9",
    label: "Send that numbered slide live",
    scope: "schedule",
    displayOnly: true,
  },
  {
    id: shortcutIds.lastSlide,
    combo: "Mod+0",
    label: "Send the last slide in the schedule live",
    scope: "schedule",
  },
  {
    id: shortcutIds.blankOutput,
    combo: "B",
    label: "Blank the live output",
    scope: "schedule",
  },

  // ─── LIVE / STAGE WINDOW ───────────────────────────────────────────────────
  {
    id: shortcutIds.fullscreen,
    combo: "F",
    label: "[Live & stage display only] Toggle fullscreen",
    scope: "live",
  },
  {
    id: shortcutIds.nextVerse,
    combo: "ArrowRight",
    label: "Go to the next verse (scriptures, songs, hymns)",
    scope: "live",
  },
  {
    id: shortcutIds.previousVerse,
    combo: "ArrowLeft",
    label: "Go to the previous verse (scriptures, songs, hymns)",
    scope: "live",
  },

  // ─── SLIDE STYLING & MEDIA (SlideContentToolbar) ───────────────────────────
  {
    id: shortcutIds.slideBold,
    combo: "Mod+B",
    label: "Bold",
    scope: "slide",
    allowInEditable: true,
    // Same key and same user-facing meaning as the TipTap `bold` entry — the
    // two toolbars are mutually exclusive, so only one is ever live. Listed
    // once, under the slide editor, to avoid a confusing duplicate row.
    hidden: true,
  },
  {
    id: shortcutIds.fontSizeIncrease,
    combo: "Mod+Shift+>",
    label: "Increase font size",
    scope: "slide",
    allowInEditable: true,
  },
  {
    id: shortcutIds.fontSizeDecrease,
    combo: "Mod+Shift+<",
    label: "Decrease font size",
    scope: "slide",
    allowInEditable: true,
  },
  {
    id: shortcutIds.slideUppercase,
    combo: "Mod+Shift+U",
    label: "Uppercase the slide text",
    scope: "slide",
    allowInEditable: true,
  },
  {
    id: shortcutIds.slideLineBackground,
    combo: "Mod+Shift+K",
    label: "Toggle the line background behind the text",
    scope: "slide",
    allowInEditable: true,
  },
  {
    id: shortcutIds.slideAlignLeft,
    combo: "Mod+Shift+L",
    label: "Align left",
    scope: "slide",
    allowInEditable: true,
    // Same key and meaning as the TipTap `align-*` entries. The two toolbars
    // are mutually exclusive, so only one is ever live — listed once, under
    // the slide editor, to keep the reference sheet free of duplicate rows.
    hidden: true,
  },
  {
    id: shortcutIds.slideAlignCenter,
    combo: "Mod+Shift+E",
    label: "Align centre",
    scope: "slide",
    allowInEditable: true,
    hidden: true,
  },
  {
    id: shortcutIds.slideAlignRight,
    combo: "Mod+Shift+R",
    label: "Align right",
    scope: "slide",
    allowInEditable: true,
    hidden: true,
  },
  {
    id: shortcutIds.muteMedia,
    combo: "M",
    label: "Mute / unmute the media on this slide",
    scope: "slide",
  },
  {
    id: shortcutIds.playPauseMedia,
    combo: "Space",
    label: "Play / pause the media on this slide",
    scope: "slide",
  },

  // ─── SLIDE EDITOR (registered by TipTap's own extensions) ──────────────────
  {
    id: shortcutIds.bold,
    combo: "Mod+B",
    label: "Bold",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.italic,
    combo: "Mod+I",
    label: "Italic",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.strike,
    combo: "Mod+Shift+X",
    label: "Strikethrough",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.heading1,
    combo: "Mod+Alt+1",
    label: "Heading 1",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.heading2,
    combo: "Mod+Alt+2",
    label: "Heading 2",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.heading3,
    combo: "Mod+Alt+3",
    label: "Heading 3",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.paragraph,
    combo: "Mod+Alt+0",
    label: "Normal text",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.bulletList,
    combo: "Mod+Shift+8",
    label: "Bullet list",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.orderedList,
    combo: "Mod+Shift+7",
    label: "Numbered list",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.alignLeft,
    combo: "Mod+Shift+L",
    label: "Align left",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.alignCenter,
    combo: "Mod+Shift+E",
    label: "Align centre",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.alignRight,
    combo: "Mod+Shift+R",
    label: "Align right",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.blockquote,
    combo: "Mod+Shift+B",
    label: "Quote",
    scope: "editor",
    external: true,
  },
  {
    id: shortcutIds.codeBlock,
    combo: "Mod+Alt+C",
    label: "Code block",
    scope: "editor",
    external: true,
  },
]

const shortcutsById = new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]))

export const getShortcut = (id: string): ShortcutDefinition | undefined =>
  shortcutsById.get(id)

export const scopeHeadings: Record<ShortcutScope, string> = {
  global: "General",
  schedule: "Slide schedule",
  slide: "Slide styling & media",
  editor: "Slide editor",
  live: "Live & stage display",
}
