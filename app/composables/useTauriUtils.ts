/**
 * Tauri utilities for common desktop operations
 * These are helper functions that work safely in both web and desktop environments
 */

/**
 * Check if the app is running in fullscreen mode
 */
export const useIsFullscreen = () => {
  const isFullscreen = ref(false)
  const { isTauri } = useTauri()

  const checkFullscreen = async () => {
    if (!isTauri) {
      // Web API fallback
      isFullscreen.value = !!document.fullscreenElement
      return
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()
      isFullscreen.value = await window.isFullscreen()
    } catch (error) {
      console.error('Failed to check fullscreen status:', error)
    }
  }

  const toggleFullscreen = async () => {
    if (!isTauri) {
      // Web API fallback
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
      await checkFullscreen()
      return
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()
      await window.setFullscreen(!isFullscreen.value)
      await checkFullscreen()
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }

  onMounted(() => {
    checkFullscreen()

    // Listen for fullscreen changes in web mode
    if (!isTauri) {
      document.addEventListener('fullscreenchange', checkFullscreen)
    }
  })

  onUnmounted(() => {
    if (!isTauri) {
      document.removeEventListener('fullscreenchange', checkFullscreen)
    }
  })

  return {
    isFullscreen: readonly(isFullscreen),
    toggleFullscreen,
    checkFullscreen
  }
}

/**
 * Get system theme preference
 */
export const useSystemTheme = () => {
  const { isTauri } = useTauri()
  const theme = ref<'light' | 'dark'>('light')

  const checkTheme = async () => {
    if (!isTauri) {
      // Web API fallback
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      return
    }

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()
      const tauriTheme = await window.theme()
      theme.value = tauriTheme || 'light'
    } catch (error) {
      console.error('Failed to get system theme:', error)
      // Fallback to web API
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  }

  onMounted(() => {
    checkTheme()
  })

  return {
    theme: readonly(theme),
    checkTheme
  }
}

/**
 * Show native notification (works in both web and desktop)
 */
export const useNativeNotification = () => {
  const { isTauri } = useTauri()

  const showNotification = async (title: string, body: string) => {
    // Use web API for both web and desktop (Tauri apps can use web APIs too)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification(title, { body })
      }
    }
  }

  return {
    showNotification
  }
}

/**
 * Prevent window close and show confirmation
 */
export const usePreventClose = (shouldPrevent: Ref<boolean>) => {
  const { isTauri } = useTauri()

  onMounted(async () => {
    if (!isTauri) return

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()

      await window.onCloseRequested(async (event) => {
        if (shouldPrevent.value) {
          event.preventDefault()

          // You can show a custom dialog here
          const confirmed = confirm('Are you sure you want to close? You have unsaved changes.')
          if (confirmed) {
            shouldPrevent.value = false
            await window.close()
          }
        }
      })
    } catch (error) {
      console.error('Failed to set up close prevention:', error)
    }
  })
}
