import { ref, computed } from "vue"
import { useAppStore } from "~/store/app"

/**
 * Desktop auto-update.
 *
 * The app checks for a new version shortly after launch and every few hours
 * after that, then downloads it silently in the background. Nothing is shown
 * until the bundle is staged on disk, and nothing is shown at all while a
 * slide is live — a church presentation must never be interrupted by us.
 *
 * Once staged the user can restart immediately, or ignore it entirely: the
 * update is installed automatically when they close the app, so the next
 * launch is already up to date and nobody has to reinstall anything.
 *
 * Every `@tauri-apps/*` import is dynamic so none of this reaches the web
 * bundle — the banner component renders on the operator layout for web users
 * too.
 */

export type UpdateStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "installing"
  | "error"

const CHECK_DELAY_MS = 5_000
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// Module-level so the banner, the navbar chip and the quit handler all read
// one source of truth.
const status = ref<UpdateStatus>("idle")
const availableVersion = ref<string | null>(null)
const downloadProgress = ref(0)
const bannerDismissed = ref(false)

// Deliberately not a ref: the Tauri `Update` is a Resource handle and must not
// be wrapped in a reactive proxy.
let stagedUpdate: any = null
let watchStarted = false
let quitHandlerRegistered = false
let checkTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null

/** Windows tears the app down to run its installer; macOS swaps in place. */
const isWindows = () =>
  typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)

/**
 * app.vue mounts in every Tauri window, so without this the live projection
 * and stage display windows would each run their own download, and closing the
 * live window would install an update mid-service.
 */
const isMainWindow = async () => {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    return getCurrentWindow().label === "main"
  } catch {
    return false
  }
}

export default function useAppUpdater() {
  const { isTauri } = useTauri()

  const isUpdateReady = computed(() => status.value === "ready")

  /** Suppress the prompt while anything is on the projector. */
  const isServiceLive = () => {
    try {
      return Boolean(useAppStore().currentState.liveSlideId)
    } catch {
      return false
    }
  }

  const showBanner = computed(
    () => isUpdateReady.value && !bannerDismissed.value && !isServiceLive()
  )

  const installLabel = computed(() =>
    isWindows() ? "Install now" : "Restart now"
  )

  // Reads as a standalone sentence under the heading, and is honest about the
  // platform difference: Windows hands off to its installer and exits.
  const installHint = computed(() =>
    isWindows()
      ? "Cloud of Worship will close while it installs. Leave it and it updates the next time you quit."
      : "Restart now to get it straight away, or leave it and it installs when you close the app."
  )

  const checkForUpdate = async () => {
    if (!isTauri) return
    // Already staged, or mid-flight — nothing to do.
    if (status.value !== "idle" && status.value !== "error") return

    try {
      status.value = "checking"
      const { check } = await import("@tauri-apps/plugin-updater")
      const update = await check()

      if (!update?.available) {
        status.value = "idle"
        return
      }

      availableVersion.value = update.version
      status.value = "downloading"
      downloadProgress.value = 0

      let downloaded = 0
      let contentLength = 0

      // Silent: no UI is rendered for this phase.
      await update.download((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0
            break
          case "Progress":
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              downloadProgress.value = Math.round(
                (downloaded / contentLength) * 100
              )
            }
            break
          case "Finished":
            downloadProgress.value = 100
            break
        }
      })

      stagedUpdate = update
      bannerDismissed.value = false
      status.value = "ready"
      usePosthogCapture("desktop_update_staged", {
        version: update.version,
      })
    } catch (error) {
      console.error("Failed to stage update:", error)
      status.value = "error"
      usePosthogCapture("desktop_update_failed", {
        stage: "download",
        message: String(error),
      })
    }
  }

  /**
   * Install straight away at the user's request.
   *
   * On Windows `install()` hands off to the NSIS installer and exits the
   * process, so `relaunch()` below is only ever reached on macOS — the custom
   * NSIS template only restarts the app when `/R` is passed, which the updater
   * does not do. That is intentional: it is what keeps the install-on-quit
   * path from reopening an app the user just closed.
   */
  const installNow = async () => {
    if (!stagedUpdate) return

    const toast = useToast()

    try {
      status.value = "installing"
      await stagedUpdate.install()

      const { relaunch } = await import("@tauri-apps/plugin-process")
      await relaunch()
    } catch (error) {
      console.error("Failed to install update:", error)
      status.value = "ready"
      toast.add({
        title: "Could not install the update",
        description: "It will try again when you close the app.",
        icon: "i-bx-error",
        color: "red",
      })
      usePosthogCapture("desktop_update_failed", {
        stage: "install",
        message: String(error),
      })
    }
  }

  const dismissBanner = () => {
    bannerDismissed.value = true
  }

  const revealBanner = () => {
    bannerDismissed.value = false
  }

  /**
   * Install a staged update when the operator closes the app, so reopening it
   * lands them on the new version with no download and no reinstall.
   */
  const installOnQuit = async () => {
    if (!isTauri || quitHandlerRegistered) return
    if (!(await isMainWindow())) return
    quitHandlerRegistered = true

    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      const appWindow = getCurrentWindow()

      const unlisten = await appWindow.onCloseRequested(async (event) => {
        if (status.value !== "ready" || !stagedUpdate) return

        event.preventDefault()
        status.value = "installing"

        try {
          usePosthogCapture("desktop_update_installed_on_quit", {
            version: availableVersion.value,
          })

          // Windows exits inside install(); macOS returns and needs the quit.
          await stagedUpdate.install()

          const { exit } = await import("@tauri-apps/plugin-process")
          await exit(0)
        } catch (error) {
          // A failed update must never trap someone inside the app.
          console.error("Failed to install update on quit:", error)
          unlisten()
          await appWindow.destroy()
        }
      })
    } catch (error) {
      console.error("Failed to register the quit-time updater:", error)
      quitHandlerRegistered = false
    }
  }

  /** Kick off the first check and the recurring one. Safe to call twice. */
  const startUpdateWatch = async () => {
    if (!isTauri || watchStarted) return
    if (!(await isMainWindow())) return
    watchStarted = true

    checkTimer = setTimeout(checkForUpdate, CHECK_DELAY_MS)
    checkInterval = setInterval(checkForUpdate, CHECK_INTERVAL_MS)
  }

  const stopUpdateWatch = () => {
    if (checkTimer) clearTimeout(checkTimer)
    if (checkInterval) clearInterval(checkInterval)
    checkTimer = null
    checkInterval = null
    watchStarted = false
  }

  return {
    status,
    availableVersion,
    downloadProgress,
    isUpdateReady,
    showBanner,
    installLabel,
    installHint,
    checkForUpdate,
    installNow,
    dismissBanner,
    revealBanner,
    installOnQuit,
    startUpdateWatch,
    stopUpdateWatch,
  }
}
