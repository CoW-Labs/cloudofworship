import type { TextBox } from "~/types"
import { clampBox, roundBox, snapTo } from "~/utils/textBoxes"

export type BoxHandle = "move" | "nw" | "ne" | "sw" | "se"

/** Below this a press is a click, not a drag (a fraction of the slide). */
const DRAG_THRESHOLD = 0.003
/** How close an edge or the centre must be to a guide for it to light up. */
const GUIDE_EPSILON = 0.0008

export interface BoxGuides {
  x: number[]
  y: number[]
}

const lit = (anchors: number[], targets: number[]) => [
  ...new Set(
    anchors
      .map((anchor) => targets.find((t) => Math.abs(t - anchor) < GUIDE_EPSILON))
      .filter((target): target is number => target !== undefined)
  ),
]

const sameList = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i])

/**
 * The shift that brings the anchor nearest a guide onto it, or 0 when none is
 * in reach. An anchor already on a guide wins over one that is merely close.
 */
const nearestSnap = (anchors: number[], targets: number[]) => {
  let best: number | null = null
  for (const anchor of anchors) {
    const snapped = snapTo(anchor, targets)
    const onGuide = snapped !== anchor || targets.includes(anchor)
    if (!onGuide) continue
    const gap = snapped - anchor
    if (best === null || Math.abs(gap) < Math.abs(best)) best = gap
  }
  return best ?? 0
}

interface GestureOptions {
  /** The element the boxes are fractions of. */
  frame: () => HTMLElement | null
  /** Every box on the slide, so a dragged one can snap to the others. */
  boxes: () => TextBox[]
  /** One call per drag, on drop. */
  onCommit: (box: TextBox, handle: BoxHandle) => void
}

/**
 * Moves and resizes one box with the pointer.
 *
 * Nothing is saved while the pointer is down: the box follows it as a local
 * `draft` that is applied once per frame, and the slide changes once, on drop.
 * That single change goes through the editor's usual path, which already merges
 * edits into one undo step and throttles the broadcast and the save.
 *
 * The frame is measured once, when the gesture starts, so moving never forces
 * a layout. Pointer capture keeps the gesture going when the pointer leaves
 * the box or the window, and works the same for mouse, touch and pen.
 */
export const useBoxGesture = (options: GestureOptions) => {
  const draft = ref<TextBox | null>(null)
  const active = computed(() => draft.value !== null)
  // The guides the dragged box is sitting on right now. The slide's edges and
  // centre, and the edges and centres of the other boxes, are the only ones.
  const guides = ref<BoxGuides>({ x: [], y: [] })
  // Which handle the current gesture holds, and whether the last one ended in
  // a change (rather than a click), so the canvas knows when to let go of the
  // text it was moving.
  const handle = ref<BoxHandle>("move")
  const committed = ref(false)

  let target: HTMLElement | null = null
  let pointerId = 0
  let gestureHandle: BoxHandle = "move"
  let origin: TextBox
  let frameWidth = 1
  let frameHeight = 1
  let startX = 0
  let startY = 0
  let snapX: number[] = []
  let snapY: number[] = []
  let latest: PointerEvent | null = null
  let frame = 0

  const compute = (event: PointerEvent): TextBox => {
    const dx = (event.clientX - startX) / frameWidth
    const dy = (event.clientY - startY) / frameHeight
    const free = event.altKey
    let { x, y, w, h } = origin

    if (gestureHandle === "move") {
      x = origin.x + dx
      y = origin.y + dy
      if (!free) {
        // Snap whichever of the left, centre or right edge is nearest a guide.
        x += nearestSnap([x, x + w / 2, x + w], snapX)
        y += nearestSnap([y, y + h / 2, y + h], snapY)
      }
    } else {
      const west = gestureHandle === "nw" || gestureHandle === "sw"
      const north = gestureHandle === "nw" || gestureHandle === "ne"
      let left = west ? origin.x + dx : origin.x
      let right = west ? origin.x + origin.w : origin.x + origin.w + dx
      let top = north ? origin.y + dy : origin.y
      let bottom = north ? origin.y + origin.h : origin.y + origin.h + dy
      if (!free) {
        if (west) left = snapTo(left, snapX)
        else right = snapTo(right, snapX)
        if (north) top = snapTo(top, snapY)
        else bottom = snapTo(bottom, snapY)
      }
      x = Math.min(left, right)
      y = Math.min(top, bottom)
      w = Math.abs(right - left)
      h = Math.abs(bottom - top)
    }
    const box = clampBox({ ...origin, x, y, w, h })
    const next = free
      ? { x: [], y: [] }
      : {
          x: lit([box.x, box.x + box.w / 2, box.x + box.w], snapX),
          y: lit([box.y, box.y + box.h / 2, box.y + box.h], snapY),
        }
    // Most frames light the same guides as the last; only a real change should
    // re-render them.
    if (!sameList(next.x, guides.value.x) || !sameList(next.y, guides.value.y))
      guides.value = next
    return box
  }

  const flush = () => {
    frame = 0
    if (latest && target) draft.value = compute(latest)
  }

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    latest = event
    if (!frame) frame = requestAnimationFrame(flush)
  }

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (event.pointerId !== pointerId || !target) return
    target.removeEventListener("pointermove", onMove)
    target.removeEventListener("pointerup", onUp)
    target.removeEventListener("pointercancel", onCancel)
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      // Already released: the window lost the pointer first.
    }
    if (frame) cancelAnimationFrame(frame)
    frame = 0

    const final = cancelled ? null : compute(event)
    const moved =
      final &&
      (Math.abs(final.x - origin.x) > DRAG_THRESHOLD ||
        Math.abs(final.y - origin.y) > DRAG_THRESHOLD ||
        Math.abs(final.w - origin.w) > DRAG_THRESHOLD ||
        Math.abs(final.h - origin.h) > DRAG_THRESHOLD)
    const done = gestureHandle
    target = null
    latest = null
    committed.value = !!(final && moved)
    draft.value = null
    guides.value = { x: [], y: [] }
    if (final && moved) options.onCommit(roundBox(final), done)
  }
  const onUp = (event: PointerEvent) => finish(event, false)
  const onCancel = (event: PointerEvent) => finish(event, true)

  const begin = (event: PointerEvent, box: TextBox, which: BoxHandle) => {
    if (event.button !== 0 || target) return
    const frameEl = options.frame()
    if (!frameEl) return
    event.preventDefault()
    event.stopPropagation()

    const rect = frameEl.getBoundingClientRect()
    frameWidth = rect.width || 1
    frameHeight = rect.height || 1
    origin = box
    gestureHandle = which
    handle.value = which
    committed.value = false
    startX = event.clientX
    startY = event.clientY
    pointerId = event.pointerId

    const others = options.boxes().filter((other) => other.id !== box.id)
    snapX = [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
    snapY = [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]

    target = event.currentTarget as HTMLElement
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // The pointer is already gone (a touch lifted before this ran). Without
      // capture the gesture still follows the pointer over the box, and its
      // up ends it; throwing here would leave `target` set and lock every
      // later drag out.
    }
    target.addEventListener("pointermove", onMove)
    target.addEventListener("pointerup", onUp)
    target.addEventListener("pointercancel", onCancel)
    draft.value = box
  }

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    target?.removeEventListener("pointermove", onMove)
    target?.removeEventListener("pointerup", onUp)
    target?.removeEventListener("pointercancel", onCancel)
  })

  return { draft, active, guides, handle, committed, begin }
}
