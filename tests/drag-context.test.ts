import { describe, expect, it, vi } from "vitest"
import { resolveDragContext, restoreDraggedRow } from "~/utils/dragContext"

describe("draggable recovery", () => {
  it("does not reuse a previous drag when the next row has no context", () => {
    const items = [{ id: "first" }, { id: "second" }]
    const previous = { element: items[0], index: 0 }
    expect(resolveDragContext(null, null, items)).toBeNull()
    expect(resolveDragContext(previous, null, [items[1]])).toBeNull()
  })

  it("recovers only a row that still belongs to the current list", () => {
    const items = [{ id: "first" }, { id: "second" }]
    const stale = { element: items[0], index: 0 }
    const row = { element: items[1], index: 0 }
    expect(resolveDragContext(stale, row, [items[1]])).toBe(row)
    expect(resolveDragContext(null, stale, [items[1]])).toBeNull()
  })

  it("restores Sortable's moved row when the model cannot move", () => {
    const removeChild = vi.fn()
    const item = { parentNode: { removeChild } } as unknown as HTMLElement
    const insertBefore = vi.fn()
    const from = {
      children: [{ id: "first" }, { id: "third" }],
      insertBefore,
    } as unknown as HTMLElement

    restoreDraggedRow(item, from, 1)

    expect(removeChild).toHaveBeenCalledWith(item)
    expect(insertBefore).toHaveBeenCalledWith(item, from.children[1])
  })
})
