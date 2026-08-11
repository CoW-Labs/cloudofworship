/**
 * Composable to detect and interact with Tauri desktop environment
 * Use this to conditionally run desktop-specific features
 * Should be run onMounted to avoid undefined window issues
 */

const isExternalUrl = (url: string) => /^https?:\/\//i.test(url)

/**
 * Open a URL in the user's default browser.
 * Desktop webviews ignore `window.open`/`target="_blank"` for remote URLs, so
 * every outbound link has to be handed to the OS instead.
 */
export const useOpenExternal = async (url: string) => {
  const { isTauri } = useTauri()

  if (!isTauri) {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }

  try {
    const { open } = await import("@tauri-apps/plugin-shell")
    await open(url)
  } catch (error) {
    console.error("Failed to open external link:", error)
  }
}

/**
 * Route every outbound link through the system browser on desktop.
 * Covers `window.open` calls, `target="_blank"` anchors, and any third-party
 * SDK (payments, adverts) that reaches for either — all of which silently do
 * nothing inside a Tauri webview.
 */
const captureExternalLinks = () => {
  const nativeOpen = window.open.bind(window)

  window.open = ((
    url?: string | URL,
    target?: string,
    features?: string
  ): Window | null => {
    const href = url?.toString() || ""
    if (isExternalUrl(href)) {
      useOpenExternal(href)
      return null
    }
    return nativeOpen(url as any, target as any, features as any)
  }) as typeof window.open

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a")
      const href = anchor?.getAttribute("href") || ""
      if (!anchor || !isExternalUrl(href)) return

      event.preventDefault()
      useOpenExternal(href)
    },
    true
  )
}

export const useTauri = () => {
  const getTauriAvailability = () => {
    if (typeof window !== 'undefined') {
      return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    }
    return false
  }

  const initializeTauri = () => {
    const { isTauri } = useTauri()

    if (isTauri) {
      document.body.classList.add("tauri")

      const { initializeZoom, registerZoomShortcuts } = useZoom()

      initializeZoom()
      registerZoomShortcuts()
      captureExternalLinks()
      // Update checks live in UpdateNotification.vue, which renders the
      // in-app prompt instead of a native confirm() dialog.
    }
  }

  return {
    isTauri: getTauriAvailability(),
    initializeTauri
  }
}

/**
 * Get Tauri API modules dynamically
 * This prevents errors when running in browser
 */
export const getTauriAPI = async () => {
  const { isTauri } = useTauri()

  if (!isTauri) {
    console.warn('Tauri API is not available in web environment')
    return null
  }

  try {
    const tauri = await import('@tauri-apps/api')
    return tauri
  } catch (error) {
    console.error('Failed to load Tauri API:', error)
    return null
  }
}
