import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { reactive, ref, nextTick } from "vue"

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), relaunch: vi.fn(), exit: vi.fn(), capture: vi.fn(),
  store: null as any,
  windows: [] as Array<{ label: string }>,
  closeHandler: null as null | ((event: { preventDefault: () => void }) => Promise<void>),
}))
vi.mock("~/store/app", () => ({ useAppStore: () => mocks.store }))
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }))
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "main",
    onCloseRequested: async (handler: typeof mocks.closeHandler) => {
      mocks.closeHandler = handler
      return () => {}
    },
    destroy: vi.fn(),
  }),
}))
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getAllWebviewWindows: async () => mocks.windows,
}))
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch, exit: mocks.exit }))

const TEN_MINUTES = 10 * 60 * 1000

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mocks.invoke.mockReset()
  mocks.relaunch.mockReset()
  mocks.exit.mockReset()
  mocks.capture.mockReset()
  mocks.store = reactive({ currentState: { liveSlideId: "" } })
  mocks.windows = []
  mocks.closeHandler = null
  vi.stubGlobal("useTauri", () => ({ isTauri: true }))
  vi.stubGlobal("useNdiBroadcast", () => ({ status: ref({ phase: "idle" }), initialize: vi.fn() }))
  vi.stubGlobal("usePosthogCapture", mocks.capture)
  vi.stubGlobal("useToast", () => ({ add: vi.fn() }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("desktop update scheduling", () => {
  it("does not start downloads while presenting", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.store.currentState.liveSlideId = "live"
    mocks.windows = [{ label: "live-output" }]
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(updater.status.value).toBe("idle")
    expect(mocks.capture).toHaveBeenCalledWith("desktop_update_check", {
      outcome: "skipped_live", reason: "live_slide",
    })
  })

  it("ignores a live slide restored from the last session when nothing is projecting", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    // Persisted state says a slide is live, but no projection window exists.
    mocks.store.currentState.liveSlideId = "stale"
    mocks.windows = []
    mocks.invoke.mockResolvedValueOnce("1.0.1")
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_stage_update")
    expect(updater.status.value).toBe("ready")
    expect(updater.showBanner.value).toBe(true)
  })

  it("reports a check that found nothing newer", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.invoke.mockResolvedValueOnce(null)
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(updater.status.value).toBe("idle")
    expect(mocks.capture).toHaveBeenCalledWith("desktop_update_check", { outcome: "up_to_date" })
  })

  it("installs the native disk-staged package without holding a JS update resource", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.invoke.mockResolvedValueOnce("1.0.1").mockResolvedValueOnce(undefined)
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(updater.status.value).toBe("ready")
    expect(updater.availableVersion.value).toBe("1.0.1")
    await updater.installNow()
    expect(mocks.invoke.mock.calls).toEqual([
      ["desktop_stage_update"],
      ["desktop_install_update", { relaunch: true }],
    ])
    expect(mocks.relaunch).toHaveBeenCalledOnce()
  })

  it("installs on quit without asking the installer to reopen the app", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.invoke.mockResolvedValueOnce("1.0.1").mockResolvedValueOnce(undefined)
    const updater = useAppUpdater()
    await updater.installOnQuit()
    await updater.checkForUpdate()
    expect(updater.status.value).toBe("ready")
    const event = { preventDefault: vi.fn() }
    await mocks.closeHandler!(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenLastCalledWith("desktop_install_update", { relaunch: false })
    expect(mocks.exit).toHaveBeenCalledWith(0)
    expect(mocks.relaunch).not.toHaveBeenCalled()
  })

  it("retries a failed check after ten minutes instead of the next four-hour interval", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.invoke
      .mockRejectedValueOnce(new Error("Could not fetch a valid release JSON from the remote"))
      .mockResolvedValueOnce("1.0.1")
    const updater = useAppUpdater()
    await updater.startUpdateWatch()
    await vi.advanceTimersByTimeAsync(5000)
    expect(updater.status.value).toBe("error")
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(TEN_MINUTES)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
    expect(updater.status.value).toBe("ready")
    updater.stopUpdateWatch()
  })

  it("cancels an in-flight download on go-live and retries after the service", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    let finishDownload: ((version: null) => void) | undefined
    mocks.invoke.mockImplementation((command) => {
      if (command === "desktop_cancel_update") {
        finishDownload?.(null)
        return Promise.resolve()
      }
      return new Promise((resolve) => { finishDownload = resolve })
    })
    const updater = useAppUpdater()
    await updater.startUpdateWatch()
    const download = updater.checkForUpdate()
    await vi.dynamicImportSettled()
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_stage_update")
    // Going live opens the projection window before the slide id changes.
    mocks.windows = [{ label: "live-output" }]
    mocks.store.currentState.liveSlideId = "live"
    await nextTick()
    await vi.dynamicImportSettled()
    await download
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_cancel_update")
    expect(updater.status.value).toBe("idle")
    mocks.invoke.mockResolvedValue("1.0.1")
    mocks.store.currentState.liveSlideId = ""
    await nextTick()
    await vi.advanceTimersByTimeAsync(5000)
    expect(updater.status.value).toBe("ready")
    updater.stopUpdateWatch()
  })
})
