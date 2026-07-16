const useCreateShortcut = (
  commandKey: string,
  action: () => boolean | void | Promise<boolean | void>,
  options?: { ctrlOrMeta?: boolean; shift?: boolean }
) => {
  const handleKeydown = (e: KeyboardEvent) => {
    const activeElement = document.activeElement
    const isCommandKeyPressed = e.key === commandKey
    const isCtrlOrMetaPressed = e.ctrlKey || e.metaKey
    const isEditableElement =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.getAttribute("contenteditable") === "true"

    if (isEditableElement) return

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
