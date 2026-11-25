import type { TextBox } from "~/types"

/**
 * The link between a slide's canvas and the editor's two toolbars.
 *
 * The canvas has no controls of its own. The toolbars already have the text
 * controls (size, alignment, fonts), so while a box is selected those act on
 * that box, and "Add text box" and "Reset layout" sit beside them. This module
 * is the one place the canvas announces what it can do and which box is
 * selected, so the toolbars read it instead of reaching into the canvas.
 *
 * Module-level on purpose: the canvas and the toolbar are siblings, and there
 * is only ever one slide open in the editor.
 */
export interface CanvasSelection {
  id: string
  source?: TextBox["source"]
  italic?: boolean
  alignment?: TextBox["alignment"]
  fontSizePercent?: number
  color?: string
  bold?: boolean
  uppercase?: boolean
  outlined?: boolean
  linesBackground?: boolean
  font?: string
  /** What the box draws once the slide's and template's styles apply. */
  shown?: {
    bold: boolean
    italic: boolean
    alignment: "left" | "center" | "right"
    font?: string
    color?: string
  }
}

interface CanvasState {
  slideId: string | null
  selected: CanvasSelection | null
  canAdd: boolean
  hasLayout: boolean
  add: (() => void) | null
  reset: (() => void) | null
  patchSelected: ((patch: Partial<TextBox>) => void) | null
}

const state = reactive<CanvasState>({
  slideId: null,
  selected: null,
  canAdd: false,
  hasLayout: false,
  add: null,
  reset: null,
  patchSelected: null,
})

/** Canvas side: take over the bridge for `slideId` until released. */
export const claimCanvasEditor = (
  slideId: string,
  handlers: Pick<CanvasState, "add" | "reset" | "patchSelected">
) => {
  state.slideId = slideId
  state.add = handlers.add
  state.reset = handlers.reset
  state.patchSelected = handlers.patchSelected
}

/** Canvas side: what the toolbars should show right now. */
export const publishCanvasEditor = (
  patch: Partial<Pick<CanvasState, "selected" | "canAdd" | "hasLayout">>
) => Object.assign(state, patch)

export const releaseCanvasEditor = (slideId: string) => {
  if (state.slideId !== slideId) return
  state.slideId = null
  state.selected = null
  state.canAdd = false
  state.hasLayout = false
  state.add = state.reset = state.patchSelected = null
}

/** True while any text box is selected, so global arrow shortcuts can step aside. */
export const canvasHasSelection = () => !!state.selected

/** Toolbar side: the canvas of the slide this toolbar is editing. */
export const useCanvasEditor = (slideId: () => string | undefined) => {
  const mine = computed(() => !!slideId() && state.slideId === slideId())
  return {
    available: mine,
    canAdd: computed(() => mine.value && state.canAdd),
    hasLayout: computed(() => mine.value && state.hasLayout),
    selected: computed(() => (mine.value ? state.selected : null)),
    add: () => {
      if (mine.value) state.add?.()
    },
    reset: () => {
      if (mine.value) state.reset?.()
    },
    /** Applies a style to the selected box. False when none is selected. */
    patchSelected: (patch: Partial<TextBox>) => {
      if (!mine.value || !state.selected || !state.patchSelected) return false
      state.patchSelected(patch)
      return true
    },
  }
}
