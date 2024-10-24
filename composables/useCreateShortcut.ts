const useCreateShortcut = (commandKey: string, action: () => void, options?: { ctrlOrMeta: boolean, shift: boolean }) => {
  window.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
    const isCommandKeyPressed = e.key === commandKey;
    const isCtrlOrMetaPressed = e.ctrlKey || e.metaKey;
    const isEditableElement = activeElement?.tagName === 'INPUT' ||
      activeElement?.tagName === 'TEXTAREA' ||
      activeElement?.contentEditable === 'true';

    if (isEditableElement) return;

    if (options?.ctrlOrMeta) {
      if (isCommandKeyPressed && isCtrlOrMetaPressed) {
        action();
        e.preventDefault();
      }
    } else if (isCommandKeyPressed) {
      action();
      e.stopImmediatePropagation();
    }
  });
}

export default useCreateShortcut
