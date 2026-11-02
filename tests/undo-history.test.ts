import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MAX_UNDO_STEPS,
  changedSlideFields,
  clearUndoHistory,
  isLatestUndoStep,
  pickSlideFields,
  recordUndoStep,
  redoLastStep,
  undoLastStep,
  type UndoStep,
} from "~/utils/undoHistory"

const counter = (label: string) => {
  const state = { value: 1 }
  const step: UndoStep = {
    label,
    undo: () => (state.value -= 1, true),
    redo: () => (state.value += 1, true),
  }
  return { state, step }
}

afterEach(() => clearUndoHistory())

describe("undo history", () => {
  it("undoes and redoes in order", () => {
    const a = counter("A")
    const b = counter("B")
    recordUndoStep(a.step)
    recordUndoStep(b.step)

    expect(undoLastStep()).toBe("B")
    expect(b.state.value).toBe(0)
    expect(undoLastStep()).toBe("A")
    expect(undoLastStep()).toBeNull()
    expect(redoLastStep()).toBe("A")
    expect(redoLastStep()).toBe("B")
    expect(redoLastStep()).toBeNull()
    expect([a.state.value, b.state.value]).toEqual([1, 1])
  })

  it("drops the redo branch, discarding it, when a new step is recorded", () => {
    const discard = vi.fn()
    recordUndoStep({ ...counter("A").step, discard })
    undoLastStep()
    recordUndoStep(counter("B").step)
    expect(discard).toHaveBeenCalledTimes(1)
    expect(redoLastStep()).toBeNull()
  })

  it("skips a step with nothing left to reverse", () => {
    const gone = vi.fn()
    recordUndoStep(counter("A").step)
    recordUndoStep({ label: "B", undo: () => false, redo: () => true, discard: gone })
    expect(undoLastStep()).toBe("A")
    expect(gone).toHaveBeenCalledTimes(1)
  })

  it("does not record steps made while a step is replaying", () => {
    const inner = counter("inner")
    recordUndoStep({
      label: "outer",
      undo: () => (recordUndoStep(inner.step), true),
      redo: () => true,
    })
    undoLastStep()
    expect(undoLastStep()).toBeNull()
  })

  it("keeps a failing step from wedging the history", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    recordUndoStep(counter("A").step)
    recordUndoStep({ label: "B", undo: () => { throw new Error("boom") }, redo: () => true })
    expect(undoLastStep()).toBe("A")
  })

  it("caps its depth and discards the oldest steps", () => {
    const discard = vi.fn()
    recordUndoStep({ ...counter("oldest").step, discard })
    for (let i = 0; i < MAX_UNDO_STEPS; i++) recordUndoStep(counter(`${i}`).step)
    expect(discard).toHaveBeenCalledTimes(1)
  })

  it("reports the latest step only while nothing is undone", () => {
    const { step } = counter("A")
    recordUndoStep(step)
    expect(isLatestUndoStep(step)).toBe(true)
    undoLastStep()
    expect(isLatestUndoStep(step)).toBe(false)
  })

  it("clears both directions", () => {
    const discard = vi.fn()
    recordUndoStep({ ...counter("A").step, discard })
    recordUndoStep({ ...counter("B").step, discard })
    undoLastStep()
    clearUndoHistory()
    expect(discard).toHaveBeenCalledTimes(2)
    expect(undoLastStep()).toBeNull()
    expect(redoLastStep()).toBeNull()
  })
})

describe("slide field diffing", () => {
  it("ignores identity and bookkeeping fields", () => {
    const before = { id: "1", _id: "a", index: 0, updatedAt: "x", contents: ["a"] }
    const after = { id: "1", _id: "b", index: 3, updatedAt: "y", contents: ["a"] }
    expect(changedSlideFields(before, after)).toEqual([])
  })

  it("finds nested and added fields", () => {
    const before = { slideStyle: { blur: 1 }, contents: ["a"] }
    const after = { slideStyle: { blur: 2 }, contents: ["a"], background: "x" }
    expect(changedSlideFields(before, after).sort()).toEqual(["background", "slideStyle"])
  })

  it("picks detached copies, keeping an absent field absent", () => {
    const slide = { slideStyle: { blur: 1 } }
    const picked = pickSlideFields(slide, ["slideStyle", "background"])
    slide.slideStyle.blur = 9
    expect(picked).toEqual({ slideStyle: { blur: 1 }, background: undefined })
  })
})
