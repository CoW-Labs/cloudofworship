const useCreateShortcut = (commandKey: string, action: () => void, options?: { ctrlOrMeta: boolean, shift: boolean }) => {
  window.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
    if (options?.ctrlOrMeta && options?.shift) {
      // e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === commandKey) {
        e.preventDefault();
        e.stopPropagation();
        action();
        return
      }
    } else if (options?.ctrlOrMeta) {
      // e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.key === commandKey) {
        action();
        e.stopImmediatePropagation()
        return
      }
    }
    else if (
      activeElement?.tagName !== 'INPUT' &&
      activeElement?.tagName !== 'TEXTAREA' &&
      activeElement?.contentEditable !== 'true'
    ) {
      if (e.key === commandKey) {
        // console.log("keypress", activeElement)
        action();
        e.stopImmediatePropagation()
      }
    }
  })
}

export default useCreateShortcut