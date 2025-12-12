/**
 * Composable to detect and interact with Tauri desktop environment
 * Use this to conditionally run desktop-specific features
 * Should be run onMounted to avoid undefined window issues
 */
export const useTauri = () => {
  const getTauriAvailability = () => {
    if (typeof window !== 'undefined') {
      return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    }
    return false
  }

  return {
    isTauri: getTauriAvailability(),
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

export const initializeTauri = () => {
  const { isTauri } = useTauri()

  if (isTauri) {
    document.body.classList.add("tauri")

    // Initialize zoom functionality for desktop app
    const { initializeZoom, registerZoomShortcuts } = useZoom()
    initializeZoom()
    registerZoomShortcuts()
  }
}
