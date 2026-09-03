import { afterEach, describe, expect, it, vi } from "vitest"
import { MediaDownloadHttpError } from "~/utils/mediaDownloadErrors"

afterEach(() => {
  vi.unstubAllGlobals()
})

const setupMediaCache = async (
  ensureLocal: ReturnType<typeof vi.fn>,
  retryMediaUntilResolved: ReturnType<typeof vi.fn>
) => {
  vi.stubGlobal("slideTypes", {
    media: "media",
    presentation: "presentation",
  })
  vi.stubGlobal("useLocalMediaStorage", () => ({ ensureLocal }))
  vi.stubGlobal("useMediaDownloadProgress", () => ({
    setProgress: vi.fn(),
    endDownload: vi.fn(),
  }))
  vi.stubGlobal("useMediaRetryQueue", () => ({
    retryMediaUntilResolved,
    cancelMediaRetry: vi.fn(),
  }))

  vi.resetModules()
  const module = await import("~/composables/useSlideMediaCache")
  return module.default()
}

describe("slide media retry policy", () => {
  it("retries only unresolved presentation pages", async () => {
    const ensureLocal = vi
      .fn()
      .mockResolvedValueOnce("blob:page-1")
      .mockRejectedValueOnce(new TypeError("connection dropped"))
      .mockResolvedValueOnce("blob:page-2")
    let retryRun:
      | ((signal: AbortSignal, heartbeat: () => void) => Promise<boolean>)
      | undefined
    const retryMediaUntilResolved = vi.fn(
      (
        _key: string,
        run: (signal: AbortSignal, heartbeat: () => void) => Promise<boolean>
      ) => {
        retryRun = run
      }
    )
    const { rehydrateSlideMediaWithStatus } = await setupMediaCache(
      ensureLocal,
      retryMediaUntilResolved
    )
    const recovered = vi.fn()
    const slide = {
      id: "deck-1",
      type: "presentation",
      presentationPageIndex: 0,
      presentationObjects: [
        { page: 1, imageUrl: "https://cdn.test/page-1.png" },
        { page: 2, imageUrl: "https://cdn.test/page-2.png" },
      ],
    } as any

    const result = await rehydrateSlideMediaWithStatus(slide, {
      allowDownload: true,
      onRecovered: recovered,
    })

    expect(result.pendingKeys).toEqual(["deck-1-page-2"])
    expect(ensureLocal).toHaveBeenCalledTimes(2)
    expect(retryRun).toBeTypeOf("function")

    const resolved = await retryRun!(new AbortController().signal, vi.fn())
    expect(resolved).toBe(true)
    expect(ensureLocal).toHaveBeenCalledTimes(3)
    expect(ensureLocal.mock.calls[2]?.[0]).toBe("deck-1-page-2")
    expect(recovered).toHaveBeenCalledOnce()
  })

  it("reports a permanent HTTP failure without scheduling retries", async () => {
    const ensureLocal = vi
      .fn()
      .mockRejectedValue(new MediaDownloadHttpError(404))
    const retryMediaUntilResolved = vi.fn()
    const { rehydrateSlideMediaWithStatus } = await setupMediaCache(
      ensureLocal,
      retryMediaUntilResolved
    )
    const slide = {
      id: "missing-image",
      type: "media",
      backgroundType: "image",
      background: "https://cdn.test/missing.png",
      data: { type: "image", url: "https://cdn.test/missing.png" },
    } as any

    const result = await rehydrateSlideMediaWithStatus(slide, {
      allowDownload: true,
    })

    expect(result.pendingKeys).toEqual(["missing-image"])
    expect(retryMediaUntilResolved).not.toHaveBeenCalled()
  })
})
