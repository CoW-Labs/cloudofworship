import { beforeEach, describe, expect, it, vi } from "vitest"

const posthogCapture = vi.fn()

vi.mock("posthog-js", () => ({
  default: { capture: posthogCapture },
}))

type ChunkErrorHandler = (payload: { error: Error }) => void

const installPlugin = async (pathname = "/") => {
  const values = new Map<string, string>()
  const reload = vi.fn()
  const addEventListener = vi.fn()
  const toastAdd = vi.fn()
  let chunkErrorHandler: ChunkErrorHandler | undefined

  vi.stubGlobal("defineNuxtPlugin", (setup: unknown) => setup)
  vi.stubGlobal("useToast", () => ({ add: toastAdd }))
  vi.stubGlobal("navigator", { onLine: true })
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
  vi.stubGlobal("window", {
    location: { pathname, reload },
    addEventListener,
  })

  const plugin = (await import("~/plugins/chunk-error.client")).default as any
  plugin({
    hook: (name: string, handler: ChunkErrorHandler) => {
      if (name === "app:chunkError") chunkErrorHandler = handler
    },
    runWithContext: (callback: () => void) => callback(),
  })

  return {
    values,
    reload,
    addEventListener,
    toastAdd,
    trigger: (message = "Failed to fetch dynamically imported module") =>
      chunkErrorHandler?.({ error: new Error(message) }),
  }
}

describe("chunk error recovery plugin", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("coalesces a burst of chunk errors into one recorded reload", async () => {
    const harness = await installPlugin()

    harness.trigger()
    harness.trigger("A second failed chunk")
    await vi.advanceTimersByTimeAsync(300)

    expect(harness.reload).toHaveBeenCalledOnce()
    expect(
      JSON.parse(harness.values.get("cow:chunk-reload-attempts") || "[]")
    ).toHaveLength(1)
    expect(posthogCapture).toHaveBeenCalledWith(
      "chunk_load_recovered_by_reload",
      expect.objectContaining({ attempt: 1 })
    )
  })

  it("waits for connectivity before reloading", async () => {
    const harness = await installPlugin()
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })

    harness.trigger()
    await vi.advanceTimersByTimeAsync(300)
    expect(harness.reload).not.toHaveBeenCalled()

    const onlineHandler = harness.addEventListener.mock.calls[0]?.[1]
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })
    onlineHandler()
    await vi.advanceTimersByTimeAsync(300)

    expect(harness.reload).toHaveBeenCalledOnce()
  })

  it("stops the reload loop and shows a persistent operator prompt", async () => {
    const harness = await installPlugin("/")
    const now = Date.now()
    harness.values.set(
      "cow:chunk-reload-attempts",
      JSON.stringify([now - 2_000, now - 1_000])
    )

    harness.trigger("Still missing")
    await vi.advanceTimersByTimeAsync(300)

    expect(harness.reload).not.toHaveBeenCalled()
    expect(harness.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 0 })
    )
    expect(posthogCapture).toHaveBeenCalledWith(
      "chunk_load_unrecoverable",
      expect.objectContaining({ attempts: 2 })
    )
  })

  it("does not show recovery UI on a live output route", async () => {
    const harness = await installPlugin("/live")
    const now = Date.now()
    harness.values.set(
      "cow:chunk-reload-attempts",
      JSON.stringify([now - 2_000, now - 1_000])
    )

    harness.trigger()
    await vi.advanceTimersByTimeAsync(300)

    expect(harness.toastAdd).not.toHaveBeenCalled()
    expect(harness.reload).not.toHaveBeenCalled()
  })
})
