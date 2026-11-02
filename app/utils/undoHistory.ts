/**
 * Undo and redo for the operator's own schedule changes.
 *
 * Each step is an action, not a picture of the app: it knows how to reverse
 * itself through the same paths the action took (the API, the socket
 * broadcast and IndexedDB), so an undone delete comes back for every teammate
 * and survives a refresh. Nothing here touches live output, settings or
 * anything else the operator did not change in that step.
 *
 * History is per window and per schedule. Changes that arrive from teammates
 * are never recorded, so Cmd+Z only ever takes back what this operator did.
 */

export interface UndoStep {
  /** Named in the toast after an undo or redo, e.g. "Delete slide". */
  label: string
  /**
   * Reverses the step. Returns false when there is nothing left to reverse
   * (a teammate deleted the slide in the meantime); the step is then dropped
   * and the next one is tried.
   */
  undo: () => boolean
  /** Applies the step again. Same contract as `undo`. */
  redo: () => boolean
  /** Runs once the step can no longer be undone or redone. */
  discard?: () => void
}

/** Second argument of the slide editor's `slide-update` event. */
export interface SlideUpdateMeta {
  /**
   * The operator moved through the slide (a presentation page, the setlist's
   * active song) rather than changing it, so there is nothing to undo.
   */
  navigation?: boolean
}

/** Deep enough for an hour of editing; each step holds only what it changed. */
export const MAX_UNDO_STEPS = 100

const past: UndoStep[] = []
const future: UndoStep[] = []
// Set while a step runs, so anything it does through the normal recording
// paths does not land in the history as a new step.
let replaying = false

const discardAll = (steps: UndoStep[]) => {
  steps.splice(0).forEach((step) => step.discard?.())
}

export function recordUndoStep(step: UndoStep) {
  if (replaying) return
  discardAll(future)
  past.push(step)
  if (past.length > MAX_UNDO_STEPS) {
    past.splice(0, past.length - MAX_UNDO_STEPS).forEach((old) => old.discard?.())
  }
}

/** Whether `step` is the most recent one, so a caller may still widen it. */
export function isLatestUndoStep(step: UndoStep) {
  return past[past.length - 1] === step && !future.length
}

const replay = (from: UndoStep[], to: UndoStep[], run: "undo" | "redo") => {
  while (from.length) {
    const step = from.pop()!
    let applied = false
    replaying = true
    try {
      applied = step[run]()
    } catch (error) {
      console.error(`Unable to ${run} "${step.label}":`, error)
    } finally {
      replaying = false
    }
    if (applied) {
      to.push(step)
      return step.label
    }
    step.discard?.()
  }
  return null
}

/** Undoes the latest step. Returns its label, or null when there was none. */
export function undoLastStep() {
  return replay(past, future, "undo")
}

/** Redoes the latest undone step. Returns its label, or null when there was none. */
export function redoLastStep() {
  return replay(future, past, "redo")
}

export function clearUndoHistory() {
  discardAll(past)
  discardAll(future)
}

/**
 * Slide fields an undo never puts back: identity, position, server bookkeeping
 * and pair membership, which belong to other actions (or to the server).
 */
const UNTRACKED_SLIDE_FIELDS = new Set([
  "_id",
  "id",
  "scheduleId",
  "churchId",
  "userId",
  "index",
  "pairId",
  "createdAt",
  "updatedAt",
  "__v",
])

const serialize = (value: unknown) =>
  value === undefined ? undefined : JSON.stringify(value)

/** The tracked fields whose value differs between two versions of a slide. */
export function changedSlideFields(
  before: Record<string, any>,
  after: Record<string, any>
) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter(
    (key) =>
      !UNTRACKED_SLIDE_FIELDS.has(key) &&
      serialize(before[key]) !== serialize(after[key])
  )
}

/**
 * Detached copies of the named fields. Slides in the store are reactive and
 * may share nested objects, so a step keeps plain JSON of its own.
 */
export function pickSlideFields(slide: Record<string, any>, fields: string[]) {
  return Object.fromEntries(
    fields.map((key) => {
      const text = serialize(slide[key])
      return [key, text === undefined ? undefined : JSON.parse(text)]
    })
  )
}
