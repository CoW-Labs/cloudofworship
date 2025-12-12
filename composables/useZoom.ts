/**
 * Composable for handling zoom functionality in Tauri desktop app
 * Allows users to zoom in/out using Ctrl/Cmd + Plus/Minus shortcuts
 */

export const useZoom = () => {
  const { isTauri } = useTauri()
  const zoomLevel = ref(1.0)
  const minZoom = 0.5
  const maxZoom = 3.0
  const zoomStep = 0.1

  /**
   * Set the zoom level for the current window
   * Uses CSS transform on the body element for compatibility
   */
  const setZoom = async (level: number) => {
    if (!isTauri) return

    try {
      // Clamp zoom level between min and max
      const clampedLevel = Math.max(minZoom, Math.min(maxZoom, level))
      
      // Apply zoom using CSS transform on the body
      if (typeof document !== 'undefined') {
        document.body.style.zoom = `${clampedLevel * 100}%`
        zoomLevel.value = clampedLevel
        
        // Store zoom level in localStorage for persistence
        localStorage.setItem('app-zoom-level', clampedLevel.toString())
      }
    } catch (error) {
      console.error('Failed to set zoom level:', error)
    }
  }

  /**
   * Zoom in (increase zoom level)
   */
  const zoomIn = async () => {
    await setZoom(zoomLevel.value + zoomStep)
  }

  /**
   * Zoom out (decrease zoom level)
   */
  const zoomOut = async () => {
    await setZoom(zoomLevel.value - zoomStep)
  }

  /**
   * Reset zoom to 100%
   */
  const resetZoom = async () => {
    await setZoom(1.0)
  }

  /**
   * Get the current zoom level from stored value or CSS
   */
  const getZoom = async () => {
    if (!isTauri) return 1.0

    try {
      const storedZoom = localStorage.getItem('app-zoom-level')
      if (storedZoom) {
        const level = parseFloat(storedZoom)
        if (!isNaN(level)) {
          zoomLevel.value = level
          return level
        }
      }
      return 1.0
    } catch (error) {
      console.error('Failed to get zoom level:', error)
      return 1.0
    }
  }

  /**
   * Initialize zoom level from stored value
   */
  const initializeZoom = async () => {
    if (!isTauri) return

    try {
      const storedZoom = localStorage.getItem('app-zoom-level')
      if (storedZoom) {
        const level = parseFloat(storedZoom)
        if (!isNaN(level)) {
          await setZoom(level)
        }
      }
    } catch (error) {
      console.error('Failed to initialize zoom:', error)
    }
  }

  /**
   * Register keyboard shortcuts for zoom
   */
  const registerZoomShortcuts = () => {
    if (!isTauri) return

    // Prevent default browser zoom behavior
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
          e.preventDefault()
        }
      })
    }

    // Handle Ctrl/Cmd + Plus (=) for zoom in
    useCreateShortcut('=', zoomIn, { ctrlOrMeta: true })
    useCreateShortcut('+', zoomIn, { ctrlOrMeta: true })

    // Handle Ctrl/Cmd + Minus for zoom out
    useCreateShortcut('-', zoomOut, { ctrlOrMeta: true })
    useCreateShortcut('_', zoomOut, { ctrlOrMeta: true })
  }

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    getZoom,
    initializeZoom,
    registerZoomShortcuts,
    minZoom,
    maxZoom,
  }
}
