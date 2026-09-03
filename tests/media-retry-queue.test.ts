import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Each test gets a fresh module instance: the queue keeps its tasks in
 * module scope so one window shares a single schedule of retries.
 */
const loadQueue = async () => {
  vi.resetModules()
  const module = await import("~/composables/useMediaRetryQueue")
  return module.default()
}

type OnlineListener = () => void

let onlineListeners: OnlineListener[]

beforeEach(() => {
  vi.useFakeTimers()
  onlineListeners = []
  vi.stubGlobal("window", {
    addEventListener: (event: string, listener: OnlineListener) => {
      if (event === "online") onlineListeners.push(listener)
    },
    removeEventListener: () => {},
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("useMediaRetryQueue", () => {
  it("keeps retrying until the media resolves, then stops", async () => {
    const { retryMediaUntilResolved, pendingMediaRetryCount } = await loadQueue()
    const run = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)

    retryMediaUntilResolved("slide-1", run)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(3)
    expect(pendingMediaRetryCount()).toBe(0)

    // Nothing is left on the schedule once the download has landed.
    await vi.advanceTimersByTimeAsync(120_000)
    expect(run).toHaveBeenCalledTimes(3)
  })

  it("treats a thrown attempt as a failure and tries again", async () => {
    const { retryMediaUntilResolved } = await loadQueue()
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(true)

    retryMediaUntilResolved("slide-2", run)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(run).toHaveBeenCalledTimes(2)
  })

  it("replaces rather than stacks a task re-registered for the same slide", async () => {
    const { retryMediaUntilResolved, pendingMediaRetryCount } = await loadQueue()
    const first = vi.fn().mockResolvedValue(false)
    const second = vi.fn().mockResolvedValue(true)

    retryMediaUntilResolved("slide-3", first)
    retryMediaUntilResolved("slide-3", second)
    expect(pendingMediaRetryCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("does not let an in-flight task clear a replacement source", async () => {
    const { retryMediaUntilResolved, pendingMediaRetryCount } = await loadQueue()
    let finishFirst!: (resolved: boolean) => void
    const first = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishFirst = resolve
        })
    )
    const second = vi.fn().mockResolvedValue(true)

    retryMediaUntilResolved("slide-race", first, "source-a")
    await vi.advanceTimersByTimeAsync(2_000)
    expect(first).toHaveBeenCalledTimes(1)

    retryMediaUntilResolved("slide-race", second, "source-b")
    await vi.advanceTimersByTimeAsync(2_000)
    expect(second).toHaveBeenCalledTimes(1)
    expect(pendingMediaRetryCount()).toBe(0)

    finishFirst(true)
    await Promise.resolve()
    expect(pendingMediaRetryCount()).toBe(0)
  })

  it("times out stalled attempts without blocking the rest of the queue", async () => {
    const { retryMediaUntilResolved } = await loadQueue()
    const stalled = () => new Promise<boolean>(() => {})
    const first = vi.fn(stalled)
    const second = vi.fn(stalled)
    const third = vi.fn().mockResolvedValue(true)

    retryMediaUntilResolved("stalled-1", first)
    retryMediaUntilResolved("stalled-2", second)
    retryMediaUntilResolved("ready-3", third)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(third).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(third).toHaveBeenCalledTimes(1)
  })

  it("does not time out a long download that continues making progress", async () => {
    const { retryMediaUntilResolved, pendingMediaRetryCount } = await loadQueue()
    const run = vi.fn(
      (_signal: AbortSignal, heartbeat: () => void) =>
        new Promise<boolean>((resolve) => {
          const progress = setInterval(heartbeat, 20_000)
          setTimeout(() => {
            clearInterval(progress)
            resolve(true)
          }, 70_000)
        })
    )

    retryMediaUntilResolved("large-video", run)
    await vi.advanceTimersByTimeAsync(72_000)

    expect(run).toHaveBeenCalledTimes(1)
    expect(pendingMediaRetryCount()).toBe(0)
  })

  it("retries immediately when the browser reports the network is back", async () => {
    const { retryMediaUntilResolved } = await loadQueue()
    const run = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)

    retryMediaUntilResolved("slide-4", run)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(run).toHaveBeenCalledTimes(1)

    onlineListeners.forEach((listener) => listener())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("stops after a bounded number of attempts so a dead source cannot loop forever", async () => {
    const { retryMediaUntilResolved, pendingMediaRetryCount } = await loadQueue()
    const run = vi.fn().mockResolvedValue(false)

    retryMediaUntilResolved("slide-5", run)
    await vi.advanceTimersByTimeAsync(30 * 60_000)

    expect(run).toHaveBeenCalledTimes(12)
    expect(pendingMediaRetryCount()).toBe(0)
  })

  it("cancels a pending task on request", async () => {
    const { retryMediaUntilResolved, cancelMediaRetry, pendingMediaRetryCount } =
      await loadQueue()
    const run = vi.fn().mockResolvedValue(false)

    retryMediaUntilResolved("slide-6", run)
    cancelMediaRetry("slide-6")
    expect(pendingMediaRetryCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).not.toHaveBeenCalled()
  })
})
