/**
 * Composable for managing multiple windows in Tauri
 * Handles creating and managing live output windows on multiple monitors
 */

export const useTauriWindows = () => {
  const { isTauri } = useTauri()
  const liveWindowLabel = 'live-output'

  /**
   * Get all available monitors/displays
   */
  const getMonitors = async () => {
    if (!isTauri) {
      console.warn('Monitor detection only available in Tauri')
      return []
    }

    try {
      const { availableMonitors } = await import('@tauri-apps/api/window')
      return await availableMonitors()
    } catch (error) {
      console.error('Failed to get monitors:', error)
      return []
    }
  }

  /**
   * Check if live window is already open
   */
  const isLiveWindowOpen = async () => {
    if (!isTauri) return false

    try {
      const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
      const windows = await getAllWebviewWindows()
      return windows.some((w: any) => w.label === liveWindowLabel)
    } catch (error) {
      console.error('Failed to check live window:', error)
      return false
    }
  }

  /**
   * Get the live window instance if it exists
   */
  const getLiveWindow = async () => {
    if (!isTauri) return null

    try {
      const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')
      const windows = await getAllWebviewWindows()
      return windows.find((w: any) => w.label === liveWindowLabel) || null
    } catch (error) {
      console.error('Failed to get live window:', error)
      return null
    }
  }

  /**
   * Close the live window
   */
  const closeLiveWindow = async () => {
    if (!isTauri) return

    try {
      const liveWindow = await getLiveWindow()
      if (liveWindow) {
        await liveWindow.close()
      }
    } catch (error) {
      console.error('Failed to close live window:', error)
    }
  }

  /**
   * Focus the live window
   */
  const focusLiveWindow = async () => {
    if (!isTauri) return

    try {
      const liveWindow = await getLiveWindow()
      if (liveWindow) {
        await liveWindow.setFocus()
        await liveWindow.setFullscreen(true)
      }
    } catch (error) {
      console.error('Failed to focus live window:', error)
    }
  }

  /**
   * Create a new live output window on the specified monitor
   */
  const createLiveWindow = async (monitorIndex?: number) => {
    if (!isTauri) {
      throw new Error('Live windows can only be created in Tauri')
    }

    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const monitors = await getMonitors()

      if (monitors.length === 0) {
        throw new Error('No monitors detected')
      }

      // Select target monitor
      const targetMonitor = monitors[monitorIndex || 0] || monitors[0]

      // Create the window
      const liveWindow = new WebviewWindow(liveWindowLabel, {
        url: '/live',
        title: 'Cloud of Worship - Live Output',
        fullscreen: true,
        alwaysOnTop: false,
        decorations: false,
        resizable: true,
        skipTaskbar: false,
        x: targetMonitor.position.x,
        y: targetMonitor.position.y,
        width: targetMonitor.size.width,
        height: targetMonitor.size.height,
      })

      return new Promise((resolve, reject) => {
        liveWindow.once('tauri://created', () => {
          console.log('Live window created successfully')
          // Ensure fullscreen after window is fully created
          setTimeout(() => {
            liveWindow.setFullscreen(true).catch(console.error)
          }, 500)
          resolve(liveWindow)
        })

        liveWindow.once('tauri://error', (error) => {
          console.error('Error creating live window:', error)
          reject(error)
        })
      })
    } catch (error) {
      console.error('Failed to create live window:', error)
      throw error
    }
  }

  /**
   * Toggle live window (open if closed, close if open)
   */
  const toggleLiveWindow = async (monitorIndex?: number) => {
    const isOpen = await isLiveWindowOpen()

    if (isOpen) {
      await closeLiveWindow()
    } else {
      await createLiveWindow(monitorIndex)
    }
  }

  return {
    getMonitors,
    isLiveWindowOpen,
    getLiveWindow,
    closeLiveWindow,
    focusLiveWindow,
    createLiveWindow,
    toggleLiveWindow,
    liveWindowLabel
  }
}
