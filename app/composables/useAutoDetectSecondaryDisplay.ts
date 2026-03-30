import { useAppStore } from '~/store/app'

/**
 * useAutoDetectSecondaryDisplay
 *
 * Automatically detects and saves the non-primary monitor as the live display
 * during app startup. Works for both Tauri (desktop) and browser (web) modes.
 *
 * Priority order when picking the secondary display:
 *  1. Any screen explicitly marked `isPrimary === false`
 *  2. Any screen that is NOT the current/app screen
 *  3. Any screen that is NOT at position (0, 0)  [Tauri fallback]
 *
 * The selection is only written to the store when:
 *  - No display has been manually configured yet (mainDisplayLabel is empty), OR
 *  - `force = true` is passed (used when screens change)
 */
export const useAutoDetectSecondaryDisplay = async (force = false) => {
  const appStore = useAppStore()
  const { isTauri } = useTauri()

  // Skip auto-detection if the user already configured a display and we're not forcing
  if (appStore.currentState.mainDisplayLabel && !force) {
    return
  }

  if (isTauri) {
    await autoDetectTauri(appStore)
  } else if ('getScreenDetails' in window) {
    await autoDetectBrowser(appStore)
  }
  // If neither API is available there's nothing to detect — the user will
  // be prompted when they try to go live.
}

// ── Tauri (desktop) ──────────────────────────────────────────────────────────
async function autoDetectTauri(appStore: ReturnType<typeof useAppStore>) {
  try {
    const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window')
    const monitors = await availableMonitors()
    const current = await currentMonitor()

    if (!monitors || monitors.length < 2) return

    const currentId = current ? useScreenId(current) : null

    // Prefer a monitor that isn't the current app monitor
    let secondary = monitors.find((m: any) => {
      const id = useScreenId(m)
      return id !== currentId
    })

    // Final fallback: anything that is not at (0,0) — typically the non-primary
    if (!secondary) {
      secondary = monitors.find(
        (m: any) => m.position.x !== 0 || m.position.y !== 0
      )
    }

    if (!secondary) return

    const secondaryId = useScreenId(secondary)

    // Build a normalised screen object that matches ScreenDetailed shape
    const screenObj = {
      id: secondaryId,
      label: (secondary as any).name || 'Secondary Display',
      width: (secondary as any).size.width,
      height: (secondary as any).size.height,
      availWidth: (secondary as any).size.width,
      availHeight: (secondary as any).size.height,
      availLeft: (secondary as any).position.x,
      availTop: (secondary as any).position.y,
      left: (secondary as any).position.x,
      top: (secondary as any).position.y,
      isPrimary: (secondary as any).position.x === 0 && (secondary as any).position.y === 0,
      isInternal: false,
      devicePixelRatio: (secondary as any).scaleFactor || 1,
      colorDepth: 24,
      pixelDepth: 24,
    }

    appStore.setMainDisplayLabel(secondaryId)
    appStore.setMainDisplayScreen(screenObj as unknown as Screen)

    useToast().add({
      title: `Live display auto-set to "${screenObj.label} (${screenObj.width} × ${screenObj.height})"`,
      description: `You can change this in Display Settings`,
      icon: 'i-lucide-monitor-check',
    })
  } catch (err) {
    console.warn('Auto-detect secondary display (Tauri) failed:', err)
  }
}

// ── Browser (Web / PWA) ───────────────────────────────────────────────────────
async function autoDetectBrowser(appStore: ReturnType<typeof useAppStore>) {
  try {
    const screenDetails = await (window as any).getScreenDetails() as {
      currentScreen: any
      screens: any[]
      addEventListener: (type: string, fn: () => void) => void
    }

    // Assign stable IDs
    screenDetails.screens.forEach((s: any) => {
      s.id = useScreenId(s)
    })
    screenDetails.currentScreen.id = useScreenId(screenDetails.currentScreen)

    if (screenDetails.screens.length < 2) return

    const currentId = screenDetails.currentScreen.id

    // 1. Prefer a screen explicitly marked as non-primary
    let secondary: any = screenDetails.screens.find(
      (s: any) => s.isPrimary === false
    )

    // 2. Fall back to any screen that isn't the current app screen
    if (!secondary) {
      secondary = screenDetails.screens.find(
        (s: any) => s.id !== currentId
      )
    }

    if (!secondary) return

    appStore.setMainDisplayLabel(secondary.id)
    appStore.setMainDisplayScreen(secondary as unknown as Screen)

    useToast().add({
      title: `Live display auto-set to "${secondary.label || 'Secondary Display'} (${secondary.width} × ${secondary.height})"`,
      description: `You can change this in Display Settings`,
      icon: 'i-lucide-monitor-check',
    })

    // Re-run detection whenever screens are connected / disconnected
    screenDetails.addEventListener('screenschange', async () => {
      await useAutoDetectSecondaryDisplay(true)
    })
  } catch (err) {
    console.warn('Auto-detect secondary display (browser) failed:', err)
  }
}

export default useAutoDetectSecondaryDisplay
