import { beforeEach, describe, expect, it } from "vitest"
import useIndexedDB from "~/composables/useIndexedDB"
import {
  createLiveProjectionRepository,
  isRestorableLiveProjection,
} from "~/composables/useLiveProjectionRepository"
import { resolveLiveSlideBroadcast } from "~/composables/useBroadcastPost"
import type { Slide } from "~/types"

const slide = (overrides: Partial<Slide> = {}) =>
  ({
    id: "live-slide",
    scheduleId: "sunday",
    index: 0,
    type: "text",
    contents: ["Verse 2"],
    ...overrides,
  }) as Slide

describe("LiveProjectionRepository", () => {
  beforeEach(async () => {
    await useIndexedDB().liveProjection.clear()
  })

  it("stores the exact projected revision separately from durable slides", async () => {
    const repository = createLiveProjectionRepository()
    await repository.putCurrent(slide(), "revision-1", 123)

    expect(await repository.getCurrent()).toMatchObject({
      id: "current",
      revision: "revision-1",
      slideId: "live-slide",
      scheduleId: "sunday",
      updatedAt: 123,
      slide: { contents: ["Verse 2"] },
    })
    expect(await useIndexedDB().slides.count()).toBe(0)
  })

  it("stores an explicit blank projection", async () => {
    const repository = createLiveProjectionRepository()
    await repository.putCurrent(null, "revision-blank", 456)

    expect(await repository.getCurrent()).toMatchObject({
      revision: "revision-blank",
      slideId: null,
      slide: null,
    })
  })

  it("resolves only the notification matching the committed revision", async () => {
    const repository = createLiveProjectionRepository()
    await repository.putCurrent(slide(), "revision-current", 456)

    await expect(
      resolveLiveSlideBroadcast({
        kind: "live-slide-changed",
        revision: "revision-current",
        slideId: "live-slide",
      })
    ).resolves.toMatchObject({
      matched: true,
      slide: { id: "live-slide" },
    })
    await expect(
      resolveLiveSlideBroadcast({
        kind: "live-slide-changed",
        revision: "revision-stale",
        slideId: "live-slide",
      })
    ).resolves.toEqual({ matched: false, slide: null })
  })

  it("rejects stale or mismatched restore records", async () => {
    const repository = createLiveProjectionRepository()
    await repository.putCurrent(
      slide({ churchId: "church-1" }),
      "revision-current",
      1_000
    )
    const record = await repository.getCurrent()

    expect(
      isRestorableLiveProjection(record, {
        expectedSlideId: "live-slide",
        churchId: "church-1",
        now: 2_000,
      })
    ).toBe(true)
    expect(
      isRestorableLiveProjection(record, {
        expectedSlideId: "another-slide",
        churchId: "church-1",
        now: 2_000,
      })
    ).toBe(false)
    expect(
      isRestorableLiveProjection(record, {
        expectedSlideId: "live-slide",
        churchId: "church-2",
        now: 2_000,
      })
    ).toBe(false)
    expect(
      isRestorableLiveProjection(record, {
        expectedSlideId: "live-slide",
        churchId: "church-1",
        now: 100_000,
        maxAgeMs: 10_000,
      })
    ).toBe(false)
  })

  it("removes session-only media URLs from the shared record", async () => {
    const repository = createLiveProjectionRepository()
    await repository.putCurrent(
      slide({
        type: "media",
        background: "blob:operator-window",
        data: { id: "media", url: "blob:operator-window" } as any,
      }),
      "revision-media",
      789
    )

    const stored = await repository.getCurrent()
    expect(stored?.slide?.background).toBe("")
    expect((stored?.slide?.data as any)?.url).toBe("")
  })
})
