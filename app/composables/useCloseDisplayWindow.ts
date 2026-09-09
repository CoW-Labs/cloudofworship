import { exitFullscreenSafely } from "~/utils/browserSafety"

/**
 * Closes the display window this page is running in — the live output or the
 * stage display. On desktop that is the Tauri webview window; in the browser
 * it is the popup the operator opened, which may only close itself when the
 * script that opened it is still the opener.
 *
 * A window the browser refuses to close (e.g. the operator opened /live in a
 * normal tab, or restored it on reload) is left in a usable state: full screen
 * is dropped so the banner and the browser chrome come back, and the operator
 * is told to close the tab themselves.
 */
export const useCloseDisplayWindow = (windowLabel: string) => {
  const { isTauri } = useTauri()

  const closeWindow = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window")
        await getCurrentWindow().close()
        return
      } catch (error) {
        console.error(`Failed to close the ${windowLabel} window:`, error)
      }
    }

    window.close()

    // window.close() is a no-op — silently — for a window the script didn't
    // open, so check rather than assume it worked.
    setTimeout(() => {
      if (window.closed) return
      exitFullscreenSafely()
      useToast().add({
        icon: "i-bx-info-circle",
        title: `Close this ${windowLabel} tab from your browser`,
        description:
          "Your browser only lets a window close itself when it was opened by the app.",
        color: "orange",
      })
    }, 300)
  }

  return { closeWindow }
}
