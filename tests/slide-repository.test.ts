import { beforeEach, describe, expect, it } from "vitest"
import useIndexedDB from "~/composables/useIndexedDB"
import {
  cancelPendingSlideShadowPut,
  createSlideRepository,
  enqueueCoalescedSlideShadowPut,
  flushSlideShadowWrites,
} from "~/composables/useSlideRepository"
import type { Slide } from "~/types"

const slide = (
  id: string,
  scheduleId: string,
  index: number,
  overrides: Partial<Slide> = {}
): Slide => ({
  id,
  scheduleId,
  index,
  name: id,
  type: "text",
  layout: "full_text",
  userId: "user-1",
  churchId: "church-1",
  contents: [id],
  ...overrides,
})

const resetDatabase = async () => {
  const db = useIndexedDB()
  await Promise.all(db.tables.map((table) => table.clear()))
}

describe("SlideRepository", () => {
  beforeEach(resetDatabase)

  it("stores and returns schedule-scoped slides in presentation order", async () => {
    const repository = createSlideRepository()
    await repository.putSlides([
      slide("second", "sunday", 1),
      slide("other", "midweek", 0),
      slide("first", "sunday", 0),
    ])

    expect(
      (await repository.getScheduleSlides("sunday")).map((item) => item.id)
    ).toEqual(["first", "second"])
    expect(await repository.getSlide("midweek", "other")).toMatchObject({
      id: "other",
    })
  })

  it("increments the local revision for a changed slide", async () => {
    const repository = createSlideRepository()
    await repository.putSlide(slide("one", "sunday", 0))
    await repository.putSlide(
      slide("one", "sunday", 0, { contents: ["updated"] })
    )

    expect(
      await repository.getStoredSlide("sunday", "one")
    ).toMatchObject({
      localRevision: 2,
      slide: { contents: ["updated"] },
    })
  })

  it("queues only records explicitly marked after a failed PUT", async () => {
    const repository = createSlideRepository()
    const edited = slide("one", "sunday", 0, { _id: "server-one" })

    await repository.putSlide(edited, { syncState: "pending" })
    expect(await repository.getPendingSlides()).toEqual([])

    await repository.markSlideSyncState("sunday", "one", "pending")
    expect(await repository.getPendingSlides()).toHaveLength(1)
  })

  it("preserves an explicit retry marker across newer pending edits", async () => {
    const repository = createSlideRepository()
    await repository.putSlide(
      slide("one", "sunday", 0, { _id: "server-one" }),
      { syncState: "pending" }
    )
    await repository.markSlideSyncState("sunday", "one", "pending")

    await repository.putSlide(
      slide("one", "sunday", 0, {
        _id: "server-one",
        contents: ["newer edit"],
      }),
      { syncState: "pending" }
    )

    expect(await repository.getPendingSlides()).toEqual([
      expect.objectContaining({
        localRevision: 2,
        slide: expect.objectContaining({ contents: ["newer edit"] }),
      }),
    ])
  })

  it("does not clear a newer pending revision with an older response", async () => {
    const repository = createSlideRepository()
    const first = slide("one", "sunday", 0, { _id: "server-one" })
    await repository.putSlide(first, { syncState: "pending" })
    await repository.markSlideSyncState("sunday", "one", "pending")
    const firstRevision = (
      await repository.getStoredSlide("sunday", "one")
    )!.localRevision

    await repository.putSlide(
      { ...first, contents: ["newer edit"] },
      { syncState: "pending" }
    )
    await repository.markSlideSyncState(
      "sunday",
      "one",
      "synced",
      firstRevision
    )

    expect(await repository.getPendingSlides()).toHaveLength(1)

    const latest = await repository.getStoredSlide("sunday", "one")
    await repository.markSlideSyncState(
      "sunday",
      "one",
      "synced",
      latest!.localRevision
    )
    expect(await repository.getPendingSlides()).toEqual([])
  })

  it("replaces only the target schedule and preserves pending local slides", async () => {
    const repository = createSlideRepository()
    await repository.putSlides([
      slide("stale", "sunday", 0, { _id: "server-stale" }),
      slide("offline", "sunday", 1),
      slide("other", "midweek", 0),
    ])

    await repository.replaceScheduleSlides(
      "sunday",
      [slide("fresh", "sunday", 0, { _id: "server-fresh" })],
      { removeMissing: true, syncState: "synced" }
    )

    expect(
      (await repository.getScheduleSlides("sunday")).map((item) => item.id)
    ).toEqual(["fresh", "offline"])
    expect(await repository.getSlide("midweek", "other")).toBeDefined()
  })

  it("does not let a fetched snapshot overwrite an explicitly queued update", async () => {
    const repository = createSlideRepository()
    await repository.putSlide(
      slide("edited", "sunday", 0, {
        _id: "server-edited",
        contents: ["local failed edit"],
      }),
      { syncState: "pending" }
    )
    await repository.markSlideSyncState("sunday", "edited", "pending")

    await repository.replaceScheduleSlides(
      "sunday",
      [
        slide("edited", "sunday", 0, {
          _id: "server-edited",
          contents: ["older server content"],
        }),
      ],
      { removeMissing: true, syncState: "synced" }
    )

    expect(await repository.getPendingSlides()).toEqual([
      expect.objectContaining({
        slide: expect.objectContaining({ contents: ["local failed edit"] }),
      }),
    ])
  })

  it("deletes records and verifies complete schedule snapshots", async () => {
    const repository = createSlideRepository()
    const expected = [slide("one", "sunday", 0), slide("two", "sunday", 1)]
    await repository.putSlides(expected)

    expect(await repository.verifySchedule("sunday", expected)).toMatchObject({
      complete: true,
      expectedCount: 2,
      actualCount: 2,
    })

    await repository.deleteSlide("sunday", "two")
    expect(await repository.verifySchedule("sunday", expected)).toMatchObject({
      complete: false,
      missingIds: ["two"],
    })
  })

  it("detects stale slide content even when all expected IDs exist", async () => {
    const repository = createSlideRepository()
    await repository.putSlide(
      slide("one", "sunday", 0, { contents: ["stale"] })
    )

    expect(
      await repository.verifySchedule("sunday", [
        slide("one", "sunday", 0, { contents: ["fresh"] }),
      ])
    ).toMatchObject({
      complete: false,
      missingIds: [],
      unexpectedIds: [],
      mismatchedIds: ["one"],
    })
  })

  it("clears durable slide state for account sign-out", async () => {
    const repository = createSlideRepository()
    await repository.putSlides([
      slide("one", "sunday", 0),
      slide("two", "midweek", 0),
    ])
    await useIndexedDB().liveProjection.put({
      id: "current",
      revision: "old-account",
      slideId: "one",
      scheduleId: "sunday",
      churchId: "church-1",
      updatedAt: 1,
      slide: slide("one", "sunday", 0),
    })

    await repository.clearAllSlides()

    expect(await useIndexedDB().slides.count()).toBe(0)
    expect(await useIndexedDB().slideOutbox.count()).toBe(0)
    expect(await useIndexedDB().liveProjection.count()).toBe(0)
  })

  it("removes session-only media from the durable record", async () => {
    const repository = createSlideRepository()
    await repository.putSlide(
      slide("media", "sunday", 0, {
        type: "media",
        background: "blob:operator-only",
        data: { id: "media", url: "blob:operator-only" } as any,
      })
    )

    const stored = await repository.getSlide("sunday", "media")
    expect(stored?.background).toBe("")
    expect((stored?.data as any)?.url).toBe("")
  })

  it("coalesces repeated editor writes to the latest slide value", async () => {
    enqueueCoalescedSlideShadowPut(
      slide("typing", "sunday", 0, { contents: ["first"] }),
      { syncState: "pending" },
      60_000
    )
    enqueueCoalescedSlideShadowPut(
      slide("typing", "sunday", 0, { contents: ["latest"] }),
      { syncState: "pending" },
      60_000
    )

    await flushSlideShadowWrites()

    expect(
      (await useIndexedDB().slides.get(["sunday", "typing"]))?.slide.contents
    ).toEqual(["latest"])
    expect(
      (await useIndexedDB().slides.get(["sunday", "typing"]))?.localRevision
    ).toBe(1)
  })

  it("can cancel a pending edit before a slide is deleted", async () => {
    enqueueCoalescedSlideShadowPut(
      slide("deleted", "sunday", 0),
      { syncState: "pending" },
      60_000
    )
    cancelPendingSlideShadowPut("sunday", "deleted")

    await flushSlideShadowWrites()

    expect(await useIndexedDB().slides.get(["sunday", "deleted"])).toBeUndefined()
  })
})
