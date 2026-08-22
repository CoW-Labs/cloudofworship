import { getShortcut } from "~/utils/shortcuts"

/**
 * Turns a normalised combo (`"Mod+Shift+D"`) — or a shortcut id from the
 * registry — into the keycap tokens a user actually sees on their platform.
 *
 *   macOS:   ["⌘", "⇧", "D"]
 *   Windows: ["Ctrl", "Shift", "D"]
 *
 * Keep this the only place that decides how a key is spelled, so tooltips and
 * the shortcuts modal always agree.
 */

const MAC_MODIFIERS: Record<string, string> = {
  Mod: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Ctrl: "⌃",
}

const OTHER_MODIFIERS: Record<string, string> = {
  Mod: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Ctrl: "Ctrl",
}

const NAMED_KEYS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Enter: "↵",
  Space: "Space",
}

const isMac = () => {
  if (typeof window === "undefined") return false
  return useClientOS() === "macOS"
}

/** Resolve a shortcut id to its combo, or pass a raw combo straight through. */
export const resolveCombo = (comboOrId: string) =>
  getShortcut(comboOrId)?.combo ?? comboOrId

const useShortcutLabel = (comboOrId: string): string[] => {
  const combo = resolveCombo(comboOrId)
  if (!combo) return []

  const modifiers = isMac() ? MAC_MODIFIERS : OTHER_MODIFIERS

  // Split on "+" but keep a literal "+" key (as in "Mod++") intact.
  const parts = combo.split("+").reduce<string[]>((acc, part, index, all) => {
    if (part === "" && index > 0 && index < all.length - 1) {
      acc.push("+")
      return acc
    }
    if (part !== "") acc.push(part)
    return acc
  }, [])

  return parts.map((part) => {
    if (modifiers[part]) return modifiers[part] as string
    if (NAMED_KEYS[part]) return NAMED_KEYS[part] as string
    return part.length === 1 ? part.toUpperCase() : part
  })
}

/** Flat, screen-reader friendly form: "Cmd + Shift + D". */
export const useShortcutAriaLabel = (comboOrId: string) => {
  const tokens = useShortcutLabel(comboOrId)
  if (!tokens.length) return ""
  const spoken = isMac() ? tokens.map((t) => (t === "⌘" ? "Cmd" : t === "⇧" ? "Shift" : t === "⌥" ? "Option" : t)) : tokens
  return spoken.join(" + ")
}

export default useShortcutLabel
