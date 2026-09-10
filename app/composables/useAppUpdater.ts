import { ref, computed, watch, type WatchStopHandle } from "vue"
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
// A failed check is usually transient — GitHub publishes a release before its
// assets finish uploading, so the manifest 404s for the first ~15 minutes —
// and waiting the full interval means a release lands hours late. Retries
// back off from here and never exceed the regular interval.
const RETRY_BASE_MS = 10 * 60 * 1000
// Windows that put something on a screen the congregation can see.
const PROJECTION_WINDOW_LABELS = ["live-output", "stage-display"]

// Module-level so the banner, the navbar chip and the quit handler all read
// one source of truth.
const status = ref<UpdateStatus>("idle")
const availableVersion = ref<string | null>(null)
const downloadProgress = ref(0)
const bannerDismissed = ref(false)
// Assume a projection exists until we have looked: never interrupt a service
// because we were early.
const projectionWindowOpen = ref(true)

// Only metadata and an install command live in JS. Verified package bytes are
// staged in a native temporary file, not retained in a Tauri Resource buffer.
let stagedUpdate: { version: string; install: (relaunch: boolean) => Promise<void> } | null = null
let watchStarted = false
let quitHandlerRegistered = false
let checkTimer: ReturnType<typeof setTimeout> | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
let stopServiceWatch: WatchStopHandle | null = null
let stopLiveSlideWatch: WatchStopHandle | null = null

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

/**
 * `liveSlideId` is persisted and restored on launch, so on its own it only
 * says a slide *was* live when the app last closed. A service is in progress
 * only if a projection window actually exists to show it — otherwise a stale
 * id would silently disable updates on every launch until someone happened to
 * clear the live output.
 */
const refreshProjectionWindow = async () => {
  try {
    const { getAllWebviewWindows } = await import("@tauri-apps/api/webviewWindow")
    const windows = await getAllWebviewWindows()
    projectionWindowOpen.value = windows.some((window) =>
      PROJECTION_WINDOW_LABELS.includes(window.label)
    )
  } catch {
    // If we cannot tell, assume the worst.
    projectionWindowOpen.value = true
  }
}

export default function useAppUpdater() {
  const { isTauri } = useTauri()
  const { status: ndiStatus, initialize: initializeNdi } = useNdiBroadcast()

  const isUpdateReady = computed(() => status.value === "ready")

  const isNdiLive = () =>
    ndiStatus.value.phase === "starting" || ndiStatus.value.phase === "broadcasting"

  /** Suppress the prompt while anything is on the projector. */
  const isServiceLive = () => {
    try {
      const slideLive = Boolean(useAppStore().currentState.liveSlideId)
      return (slideLive && projectionWindowOpen.value) || isNdiLive()
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

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
  }

  const scheduleRetry = () => {
    clearRetry()
    if (!watchStarted) return
    retryAttempt += 1
    const delay = Math.min(RETRY_BASE_MS * 2 ** (retryAttempt - 1), CHECK_INTERVAL_MS)
    retryTimer = setTimeout(checkForUpdate, delay)
  }

  // Every check reports an outcome. Without this a check that never runs is
  // indistinguishable from one that found nothing, which is how a stale live
  // slide quietly blocked updates for weeks.
  const captureCheck = (outcome: string, properties: Record<string, any> = {}) =>
    usePosthogCapture("desktop_update_check", { outcome, ...properties })

  const checkForUpdate = async () => {
    if (!isTauri) return
    if (status.value !== "idle" && status.value !== "error") return
    clearRetry()
    try {
      status.value = "checking"
      await refreshProjectionWindow()
      if (isServiceLive()) {
        status.value = "idle"
        captureCheck("skipped_live", { reason: isNdiLive() ? "ndi" : "live_slide" })
        return
      }
      const { invoke } = await import("@tauri-apps/api/core")
      // Dynamic import yields, so check again before starting network work.
      if (isServiceLive()) { status.value = "idle"; return }
      status.value = "downloading"
      const version = await invoke<string | null>("desktop_stage_update")
      if (!version) {
        status.value = "idle"
        retryAttempt = 0
        // A null with a service live means the download was cancelled.
        if (!isServiceLive()) captureCheck("up_to_date")
        return
      }
      stagedUpdate = {
        version,
        install: (relaunch) => invoke<void>("desktop_install_update", { relaunch }),
      }
      availableVersion.value = version
      downloadProgress.value = 100
      bannerDismissed.value = false
      status.value = "ready"
      retryAttempt = 0
      usePosthogCapture("desktop_update_staged", { version })
    } catch (error) {
      console.error("Failed to stage update:", error)
      status.value = "error"
      usePosthogCapture("desktop_update_failed", {
        stage: "download", message: String(error),
      })
      scheduleRetry()
    }
  }

  /**
   * Install straight away at the user's request.
   *
   * On Windows `install()` hands off to the NSIS installer and exits the
   * process, and the installer reopens the app itself, so `relaunch()` below
   * is only ever reached on macOS.
   */
  const installNow = async () => {
    if (!stagedUpdate) return

    const toast = useToast()

    try {
      status.value = "installing"
      await stagedUpdate.install(true)

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
   *
   * The updater always asks the Windows installer to restart the app; passing
   * `relaunch: false` tells our installer template not to, so an app the
   * operator just closed stays closed.
   */
  const installOnQuit = async () => {
    if (!isTauri || quitHandlerRegistered) return
    if (!(await isMainWindow()) || quitHandlerRegistered) return
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
          await stagedUpdate.install(false)

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
    if (!(await isMainWindow()) || watchStarted) return
    watchStarted = true
    await initializeNdi()
    if (!watchStarted) return
    await refreshProjectionWindow()
    if (!watchStarted) return
    // Going live opens the projection window first, so re-probing on every
    // live slide change keeps the gate honest in both directions.
    stopLiveSlideWatch = watch(
      () => useAppStore().currentState.liveSlideId,
      () => { void refreshProjectionWindow() }
    )
    stopServiceWatch = watch(isServiceLive, (live) => {
      if (checkTimer) clearTimeout(checkTimer)
      if (live) {
        void import("@tauri-apps/api/core").then(({ invoke }) =>
          invoke("desktop_cancel_update")
        ).catch((error) => console.warn("Could not defer the desktop update:", error))
      } else {
        checkTimer = setTimeout(checkForUpdate, CHECK_DELAY_MS)
      }
    })

    checkTimer = setTimeout(checkForUpdate, CHECK_DELAY_MS)
    checkInterval = setInterval(checkForUpdate, CHECK_INTERVAL_MS)
  }

  const stopUpdateWatch = () => {
    stopServiceWatch?.()
    stopServiceWatch = null
    stopLiveSlideWatch?.()
    stopLiveSlideWatch = null
    if (checkTimer) clearTimeout(checkTimer)
    if (checkInterval) clearInterval(checkInterval)
    clearRetry()
    checkTimer = null
    checkInterval = null
    retryAttempt = 0
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
