const useCreateShortcut = (commandKey: string, action: () => void) => {
  window.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
      action();
      return
    }
    if (
      activeElement?.tagName !== 'INPUT' &&
      activeElement?.tagName !== 'TEXTAREA' &&
      activeElement?.contentEditable !== 'true'
    ) {
      if (e.key === commandKey) {
        // console.log("keypress", activeElement)
        action();
      }
    }
  })
}

export default useCreateShortcut