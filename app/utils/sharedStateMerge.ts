const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Merge an incoming shared-state snapshot without deleting keys intentionally
 * omitted by its serializer. Arrays and scalar values still replace normally.
 */
export const mergeSharedStateValue = <T>(current: T, incoming: unknown): T => {
  if (!isPlainObject(current) || !isPlainObject(incoming)) {
    return incoming as T
  }

  const merged: Record<string, unknown> = { ...current }
  Object.entries(incoming).forEach(([key, value]) => {
    merged[key] = mergeSharedStateValue(
      (current as Record<string, unknown>)[key],
      value
    )
  })
  return merged as T
}

export default mergeSharedStateValue

