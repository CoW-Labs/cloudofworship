import { describe, expect, it, vi } from "vitest"
import type { Slide } from "~/types"
import {
  createScheduleSlideHydrator,
  mergeIndexedAndLegacyScheduleSlides,
  mergeServerAndPendingScheduleSlides,
  replaceScheduleSlidesInCorpus,
} from "~/composables/useScheduleSlideHydration"

const slide = (
  id: string,
  scheduleId: string,
  index = 0,
  overrides: Partial<Slide> = {}
) =>
  ({
    id,
    scheduleId,
    index,
    type: "text",
    contents: [id],
    ...overrides,
  }) as Slide

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe("schedule slide hydration", () => {
  it("hydrates IndexedDB-only slides without overwriting newer legacy edits", () => {
    const indexed = [
      slide("shared", "sunday", 0, { contents: ["cached"] }),
      slide("cached-only", "sunday", 1),
    ]
    const legacy = [
      slide("shared", "sunday", 0, { contents: ["latest edit"] }),
    ]

    const merged = mergeIndexedAndLegacyScheduleSlides(indexed, legacy)

    expect(merged.map((item) => item.id)).toEqual(["shared", "cached-only"])
    expect(merged[0].contents).toEqual(["latest edit"])
  })

  it("uses the server snapshot while preserving only pending local slides", () => {
    const merged = mergeServerAndPendingScheduleSlides(
      [slide("server", "sunday", 0, { _id: "server-1" })],
      [
        slide("stale", "sunday", 1, { _id: "stale-server-record" }),
        slide("offline", "sunday", 2),
      ]
    )

    expect(merged.map((item) => item.id)).toEqual(["server", "offline"])
  })

  it("replaces only the hydrated schedule in the in-memory corpus", () => {
    const result = replaceScheduleSlidesInCorpus(
      [slide("old", "sunday"), slide("keep", "midweek")],
      "sunday",
      [slide("cached", "sunday")]
    )

    expect(result.map((item) => item.id)).toEqual(["keep", "cached"])
  })

  it("does not rewrite Pinia when its fallback already matches the cache", async () => {
    const existing = slide("one", "sunday")
    const applyScheduleSlides = vi.fn()
    const hydrator = createScheduleSlideHydrator({
      repository: { getScheduleSlides: async () => [existing] },
      getActiveScheduleId: () => "sunday",
      getLegacySlides: () => [existing],
      applyScheduleSlides,
    })

    const result = await hydrator.hydrate("sunday")

    expect(result).toMatchObject({ source: "indexeddb", applied: false })
    expect(applyScheduleSlides).not.toHaveBeenCalled()
  })

  it("keeps the legacy fallback when IndexedDB cannot be read", async () => {
    const existing = slide("one", "sunday")
    const onError = vi.fn()
    const hydrator = createScheduleSlideHydrator({
      repository: {
        getScheduleSlides: async () => {
          throw new Error("database unavailable")
        },
      },
      getActiveScheduleId: () => "sunday",
      getLegacySlides: () => [existing],
      applyScheduleSlides: vi.fn(),
      onError,
    })

    const result = await hydrator.hydrate("sunday")

    expect(result).toMatchObject({ source: "legacy", slides: [existing] })
    expect(onError).toHaveBeenCalledOnce()
  })

  it("discards a slow read after another schedule is selected", async () => {
    const sundayRead = deferred<Slide[]>()
    const midweekRead = deferred<Slide[]>()
    let activeScheduleId = "sunday"
    const applyScheduleSlides = vi.fn()
    const hydrator = createScheduleSlideHydrator({
      repository: {
        getScheduleSlides: (scheduleId) =>
          scheduleId === "sunday" ? sundayRead.promise : midweekRead.promise,
      },
      getActiveScheduleId: () => activeScheduleId,
      getLegacySlides: () => [],
      applyScheduleSlides,
    })

    const sundayHydration = hydrator.hydrate("sunday")
    activeScheduleId = "midweek"
    const midweekHydration = hydrator.hydrate("midweek")

    midweekRead.resolve([slide("midweek-slide", "midweek")])
    expect(await midweekHydration).toMatchObject({
      source: "indexeddb",
      applied: true,
    })

    sundayRead.resolve([slide("sunday-slide", "sunday")])
    expect(await sundayHydration).toMatchObject({
      source: "stale",
      applied: false,
    })
    expect(applyScheduleSlides).toHaveBeenCalledOnce()
    expect(applyScheduleSlides).toHaveBeenCalledWith(
      "midweek",
      expect.arrayContaining([expect.objectContaining({ id: "midweek-slide" })])
    )
  })
})

