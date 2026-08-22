import { getShortcut } from "~/utils/shortcuts"

/**
 * Binds an action to a shortcut from the registry in `~/utils/shortcuts`.
 *
 * Using this instead of calling `useCreateShortcut` with a bare key string
 * means the keys a user presses and the keycaps shown in tooltips / the
 * shortcuts modal are parsed from the exact same `combo`, so they can't drift.
 *
 * Returns a cleanup function, same as `useCreateShortcut`.
 */

interface ParsedCombo {
  key: string
  ctrlOrMeta: boolean
  shift?: boolean
  code?: string
}

// Physical key for each punctuation character we bind. `event.key` for these
// depends on the keyboard layout and on how the browser applies Shift under
// Meta, so a modifier chord matches on `event.code` as well.
const PUNCTUATION_CODES: Record<string, string> = {
  ">": "Period",
  ".": "Period",
  "<": "Comma",
  ",": "Comma",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "-": "Minus",
  "=": "Equal",
  "+": "Equal",
}

// `KeyboardEvent.key` reports a literal " " for the space bar, but "Space" is
// what reads well in a registry entry and on a keycap.
const KEY_ALIASES: Record<string, string> = { Space: " " }

export const parseCombo = (combo: string): ParsedCombo => {
  // Split on "+" while keeping a literal "+" key (as in "Mod++") intact.
  const parts = combo.split("+").reduce<string[]>((acc, part, index, all) => {
    if (part === "" && index > 0 && index < all.length - 1) {
      acc.push("+")
      return acc
    }
    if (part !== "") acc.push(part)
    return acc
  }, [])

  const ctrlOrMeta = parts.includes("Mod")
  const hasShift = parts.includes("Shift")
  const key =
    parts.filter((part) => !["Mod", "Shift", "Alt", "Ctrl"].includes(part))[0] ||
    ""

  const resolvedKey = KEY_ALIASES[key] ?? key

  return {
    // Single characters are matched case-insensitively against `event.key`,
    // which reports "D" (not "d") once Shift is held.
    key: resolvedKey.length === 1 ? resolvedKey.toLowerCase() : resolvedKey,
    ctrlOrMeta,
    // Only constrain Shift when the combo actually mentions it — keys like "?"
    // already encode Shift in `event.key`.
    shift: hasShift ? true : ctrlOrMeta ? false : undefined,
    // Only fall back to the physical key for chords that carry Ctrl/Cmd. Without
    // that guard, bare "?" (code "Slash") would also fire on bare "/".
    code: ctrlOrMeta ? PUNCTUATION_CODES[resolvedKey] : undefined,
  }
}

const useRegisteredShortcut = (
  id: string,
  action: () => boolean | void | Promise<boolean | void>
) => {
  const shortcut = getShortcut(id)

  if (!shortcut) {
    console.warn(`[shortcuts] Unknown shortcut id "${id}"`)
    return () => {}
  }

  if (shortcut.external || shortcut.displayOnly) {
    console.warn(
      `[shortcuts] "${id}" is documentation-only and must not be bound here`
    )
    return () => {}
  }

  const { key, ctrlOrMeta, shift, code } = parseCombo(shortcut.combo)

  return useCreateShortcut(key, action, {
    ctrlOrMeta,
    shift,
    code,
    allowInEditable: shortcut.allowInEditable,
  })
}

export default useRegisteredShortcut
