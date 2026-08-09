const useCreateShortcut = (
  commandKey: string,
  action: () => boolean | void | Promise<boolean | void>,
  options?: { ctrlOrMeta?: boolean; shift?: boolean; allowInEditable?: boolean }
) => {
  const handleKeydown = (e: KeyboardEvent) => {
    const activeElement = document.activeElement
    const isCommandKeyPressed = e.key === commandKey
    const isCtrlOrMetaPressed = e.ctrlKey || e.metaKey
    const isEditableElement =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.getAttribute("contenteditable") === "true"

    // Modifier chords (e.g. Cmd + K) can't be confused with typing, so a
    // shortcut can opt out of the editable-element guard and stay reachable
    // from inside the slide editor or a search box.
    if (isEditableElement && !options?.allowInEditable) return

    if (options?.ctrlOrMeta) {
      if (isCommandKeyPressed && isCtrlOrMetaPressed) {
        const handled = action() !== false
        if (handled) {
          e.preventDefault()
        }
      }
    } else if (isCommandKeyPressed) {
      const handled = action() !== false
      if (handled) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
  }

  window.addEventListener("keydown", handleKeydown)

  return () => {
    window.removeEventListener("keydown", handleKeydown)
  }
}

export default useCreateShortcut
