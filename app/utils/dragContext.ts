export type DragContext = { element: unknown; index: number }

/** Accept a drag only while its row still names an item in the current list. */
export function resolveDragContext(
  current: DragContext | null | undefined,
  row: DragContext | null | undefined,
  list: unknown,
): DragContext | null {
  if (!Array.isArray(list)) return null

  const isCurrent = (context: DragContext | null | undefined) =>
    context !== null &&
    context !== undefined &&
    Number.isInteger(context.index) &&
    context.index >= 0 &&
    context.index < list.length &&
    list[context.index] === context.element

  if (isCurrent(current)) return current!
  if (isCurrent(row)) return row!
  return null
}

/** Sortable moves the DOM first. Put the row back when the model cannot move. */
export function restoreDraggedRow(
  item: HTMLElement,
  from: HTMLElement,
  oldIndex: number,
) {
  if (!Number.isInteger(oldIndex) || oldIndex < 0) return
  item.parentNode?.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] ?? null)
}
