const useCreateShortcut = (
  commandKey: string,
  action: () => boolean | void | Promise<boolean | void>,
  options?: {
    ctrlOrMeta?: boolean
    shift?: boolean
    alt?: boolean
    allowInEditable?: boolean
    /**
     * Physical key (`KeyboardEvent.code`) to accept in addition to
     * `commandKey`. Punctuation chords need this: what `event.key` reports for
     * Shift+"." varies by keyboard layout and by how the browser applies Shift
     * while Meta is held, so ">" alone is not a reliable match.
     */
    code?: string
  }
) => {
  const handleKeydown = (e: KeyboardEvent) => {
    const activeElement = document.activeElement
    // Single-character keys are compared case-insensitively — `event.key`
    // reports "D" rather than "d" as soon as Shift is held. `event.key` can
    // itself be undefined for some synthetic/IME-composed events, so guard it.
    const matchesKey =
      commandKey.length === 1
        ? e.key?.toLowerCase() === commandKey.toLowerCase()
        : e.key === commandKey
    const isCommandKeyPressed =
      matchesKey || (options?.code ? e.code === options.code : false)
    const isCtrlOrMetaPressed = e.ctrlKey || e.metaKey
    const isEditableElement =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.getAttribute("contenteditable") === "true"

    // Modifier chords (e.g. Cmd + K) can't be confused with typing, so a
    // shortcut can opt out of the editable-element guard and stay reachable
    // from inside the slide editor or a search box.
    if (isEditableElement && !options?.allowInEditable) return

    if (!isCommandKeyPressed) return

    // Only constrain a modifier when the caller asked for it. `shift: false`
    // means "must NOT be held" — that's how Cmd+1 stays distinct from Cmd+Shift+1.
    if (options?.shift !== undefined && e.shiftKey !== options.shift) return
    if (options?.alt !== undefined && e.altKey !== options.alt) return

    if (options?.ctrlOrMeta) {
      if (isCtrlOrMetaPressed) {
        const handled = action() !== false
        if (handled) {
          e.preventDefault()
        }
      }
      return
    }

    // A bare-key shortcut must not hijack a browser or OS chord. Without this,
    // pressing Cmd+B in the editor would also blank the live output.
    if (isCtrlOrMetaPressed) return

    const handled = action() !== false
    if (handled) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  window.addEventListener("keydown", handleKeydown)

  return () => {
    window.removeEventListener("keydown", handleKeydown)
  }
}

export default useCreateShortcut
