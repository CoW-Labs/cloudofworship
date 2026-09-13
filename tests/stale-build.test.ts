import { beforeEach, describe, expect, it, vi } from "vitest"

const posthogCapture = vi.fn()

vi.mock("posthog-js", () => ({
  default: { capture: posthogCapture },
}))

const RUNNING_VERSION = "v1.1.2"
const DEPLOYED_VERSION = "v1.2.0"

type PluginHarness = Awaited<ReturnType<typeof installPlugin>>

const installPlugin = async (options?: {
  pathname?: string
  liveSlideId?: string
  deployedVersion?: string | null
  sessionValues?: Map<string, string>
}) => {
  const pathname = options?.pathname ?? "/"
  const values = options?.sessionValues ?? new Map<string, string>()
  const reload = vi.fn()
  const toastAdd = vi.fn()
  const windowListeners = new Map<string, () => void>()
  const documentListeners = new Map<string, () => void>()
  const timers: Array<{ fn: () => void; ms: number; kind: string }> = []

  const currentState = {
    liveSlideId: options?.liveSlideId ?? "",
    activeAlert: null,
  }

  vi.stubGlobal("defineNuxtPlugin", (setup: unknown) => setup)
  vi.stubGlobal("useToast", () => ({ add: toastAdd }))
  vi.stubGlobal("useAppVersion", () => ({ appVersion: RUNNING_VERSION }))
  vi.stubGlobal("navigator", { onLine: true })
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: (name: string, handler: () => void) =>
      documentListeners.set(name, handler),
  })
  vi.stubGlobal("window", {
    location: { pathname, reload },
    addEventListener: (name: string, handler: () => void) =>
      windowListeners.set(name, handler),
  })
  vi.stubGlobal("setTimeout", ((fn: () => void, ms: number) => {
    timers.push({ fn, ms, kind: "timeout" })
    return timers.length
  }) as unknown as typeof setTimeout)
  vi.stubGlobal("setInterval", ((fn: () => void, ms: number) => {
    timers.push({ fn, ms, kind: "interval" })
    return timers.length
  }) as unknown as typeof setInterval)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        appVersion:
          options?.deployedVersion === undefined
            ? DEPLOYED_VERSION
            : options?.deployedVersion,
      }),
    }))
  )

  const filters = await import("~/utils/errorFilters")

  vi.doMock("~/store/app", () => ({
    useAppStore: () => ({ currentState }),
  }))

  const plugin = (await import("~/plugins/build-freshness.client")).default as any
  plugin({ runWithContext: (callback: () => void) => callback() })

  /** The plugin's first version check, which it schedules rather than runs. */
  const runFirstCheck = async () => {
    const first = timers.find((timer) => timer.kind === "timeout")
    first?.fn()
    // Let the fetch and its two awaits settle.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  return {
    values,
    reload,
    toastAdd,
    timers,
    currentState,
    runFirstCheck,
    filters,
    runIdleTicks: () => {
      timers
        .filter((timer) => timer.kind === "interval" && timer.ms <= 60_000)
        .forEach((timer) => timer.fn())
    },
  }
}

/** Fire the plugin's idle tick with the clock past the away-from-keyboard mark. */
const runWhileIdle = async (harness: PluginHarness) => {
  const realNow = Date.now
  Date.now = () => realNow() + 6 * 60_000
  try {
    harness.runIdleTicks()
  } finally {
    Date.now = realNow
  }
}

describe("stale build detection", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    posthogCapture.mockClear()
  })

  it("reports once and stops sending exceptions when the origin is ahead", async () => {
    const harness: PluginHarness = await installPlugin()
    expect(harness.filters.isBuildStale()).toBe(false)

    await harness.runFirstCheck()

    expect(harness.filters.isBuildStale()).toBe(true)
    expect(posthogCapture).toHaveBeenCalledWith(
      "stale_build_detected",
      expect.objectContaining({
        running_version: RUNNING_VERSION,
        deployed_version: DEPLOYED_VERSION,
      })
    )
    // Crashes from code this build no longer contains are not worth a report.
    expect(harness.filters.shouldSuppressError(new Error("anything"))).toBe(true)
  })

  it("treats an unreadable version as fresh rather than silencing the tab", async () => {
    const harness: PluginHarness = await installPlugin({ deployedVersion: null })

    await harness.runFirstCheck()

    expect(harness.filters.isBuildStale()).toBe(false)
    expect(harness.filters.shouldSuppressError(new Error("real bug"))).toBe(false)
  })

  it("still hands a dead chunk to recovery after the tab knows it is behind", async () => {
    const harness: PluginHarness = await installPlugin()
    const recover = vi.fn()

    const { registerChunkRecovery } = await import("~/utils/chunkErrors")
    registerChunkRecovery(recover)

    await harness.runFirstCheck()
    expect(harness.filters.isBuildStale()).toBe(true)

    harness.filters.shouldSuppressError(
      new Error("Failed to fetch dynamically imported module: /_nuxt/abc.js")
    )

    // A stale tab is the one most likely to hit a dead chunk, and the reload
    // plugin is what heals it — suppression must not short-circuit past it.
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it("reloads once the operator is away and nothing is live", async () => {
    const harness: PluginHarness = await installPlugin()

    await harness.runFirstCheck()
    expect(harness.reload).not.toHaveBeenCalled()

    // Six minutes without a pointer, key or scroll clears the idle threshold.
    await runWhileIdle(harness)

    expect(harness.reload).toHaveBeenCalledTimes(1)
    expect(harness.values.get("cow:stale-build-reload")).toBe(RUNNING_VERSION)
    expect(posthogCapture).toHaveBeenCalledWith(
      "stale_build_reloaded",
      expect.objectContaining({ deployed_version: DEPLOYED_VERSION }),
      { send_instantly: true }
    )
  })

  it("does not reload while a slide is live", async () => {
    const harness: PluginHarness = await installPlugin({ liveSlideId: "slide-1" })

    await harness.runFirstCheck()
    // Idle by every other measure: an operator away from the keyboard mid-song
    // is still mid-service.
    await runWhileIdle(harness)

    expect(harness.reload).not.toHaveBeenCalled()
  })

  it("never reloads a projection window", async () => {
    const harness: PluginHarness = await installPlugin({ pathname: "/live" })

    await harness.runFirstCheck()
    await runWhileIdle(harness)

    // A reload there blanks the congregation screen, and a toast there is shown
    // to the congregation.
    expect(harness.reload).not.toHaveBeenCalled()
    expect(harness.toastAdd).not.toHaveBeenCalled()
  })

  it("asks instead of reloading when a reload already failed to move the version", async () => {
    const values = new Map([["cow:stale-build-reload", RUNNING_VERSION]])
    const harness: PluginHarness = await installPlugin({ sessionValues: values })

    await harness.runFirstCheck()

    expect(harness.reload).not.toHaveBeenCalled()
    expect(harness.toastAdd).toHaveBeenCalledTimes(1)
  })
})
