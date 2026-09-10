import posthog from "posthog-js"

const reportedSources = new Set<string>()

/**
 * Coerce a font-family value to a plain string before it reaches TipTap.
 *
 * `setFontFamily` stores whatever it is given as a textStyle mark attribute.
 * With a collapsed selection that becomes a *stored mark*, so nothing renders
 * until the next command — which then serialises the mark, and
 * prosemirror-model walks every attribute value recursively looking for
 * injected DOM specs. A non-string with a reference cycle (a DOM Event, an
 * element, a component instance) sends that walk into "Maximum call stack
 * size exceeded" on every subsequent toolbar action until the page reloads.
 *
 * Returns `null` for anything that is not a non-empty string, and reports the
 * shape once per source so the actual origin can be identified.
 */
export const asFontFamily = (value: unknown, source: string): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  if (value == null) return null

  if (!reportedSources.has(source)) {
    reportedSources.add(source)
    const shape =
      typeof value === "object"
        ? Object.keys(value as object).slice(0, 12).join(",")
        : String(value).slice(0, 60)
    posthog.captureException?.(
      new Error(`Font family received a ${typeof value} instead of a string`),
      {
        source,
        value_type: typeof value,
        constructor_name: (value as any)?.constructor?.name,
        shape,
      }
    )
  }
  return null
}
