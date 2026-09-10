import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { reactive, ref, nextTick } from "vue"

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), relaunch: vi.fn(), store: null as any,
}))
vi.mock("~/store/app", () => ({ useAppStore: () => mocks.store }))
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }))
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ label: "main" }) }))
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }))

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mocks.invoke.mockReset()
  mocks.relaunch.mockReset()
  mocks.store = reactive({ currentState: { liveSlideId: "" } })
  vi.stubGlobal("useTauri", () => ({ isTauri: true }))
  vi.stubGlobal("useNdiBroadcast", () => ({ status: ref({ phase: "idle" }), initialize: vi.fn() }))
  vi.stubGlobal("usePosthogCapture", vi.fn())
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
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(updater.status.value).toBe("idle")
  })

  it("installs the native disk-staged package without holding a JS update resource", async () => {
    const { default: useAppUpdater } = await import("~/composables/useAppUpdater")
    mocks.invoke.mockResolvedValueOnce("1.0.1").mockResolvedValueOnce(undefined)
    const updater = useAppUpdater()
    await updater.checkForUpdate()
    expect(updater.status.value).toBe("ready")
    expect(updater.availableVersion.value).toBe("1.0.1")
    await updater.installNow()
    expect(mocks.invoke.mock.calls.map(([command]) => command)).toEqual([
      "desktop_stage_update", "desktop_install_update",
    ])
    expect(mocks.relaunch).toHaveBeenCalledOnce()
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
