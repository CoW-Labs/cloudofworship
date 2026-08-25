import { beforeEach, describe, expect, it, vi } from "vitest"
import useIndexedDB from "~/composables/useIndexedDB"
import {
  LEGACY_ACTIVE_SLIDES_MIGRATION,
  migrateLegacyActiveSlides,
} from "~/composables/useDataMigrations"
import type { Slide } from "~/types"

const slide = (
  id: string,
  scheduleId: string,
  overrides: Partial<Slide> = {}
): Slide => ({
  id,
  scheduleId,
  index: 0,
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

describe("slide data migrations", () => {
  beforeEach(resetDatabase)

  it("imports legacy slides and records a verified completion marker", async () => {
    const db = useIndexedDB()
    const result = await migrateLegacyActiveSlides([
      slide("one", "sunday", { _id: "server-one", index: 0 }),
      slide("two", "sunday", { index: 1 }),
      slide("one", "midweek", { index: 0 }),
    ])

    expect(result.status).toBe("completed")
    expect(result.record).toMatchObject({
      sourceCount: 3,
      eligibleCount: 3,
      insertedCount: 3,
      skippedCount: 0,
    })
    expect(await db.slides.count()).toBe(3)
    expect(await db.slides.get(["sunday", "one"])).toMatchObject({
      serverId: "server-one",
      syncState: "synced",
      localRevision: 1,
    })
    expect(await db.slides.get(["sunday", "two"])).toMatchObject({
      syncState: "pending",
    })
    expect(
      await db.migrationMeta.get(LEGACY_ACTIVE_SLIDES_MIGRATION)
    ).toEqual(result.record)
  })

  it("is idempotent and never overwrites a newer IndexedDB record", async () => {
    const db = useIndexedDB()
    await migrateLegacyActiveSlides([slide("one", "sunday")])

    const stored = await db.slides.get(["sunday", "one"])
    expect(stored).toBeDefined()
    await db.slides.put({
      ...stored!,
      localRevision: 2,
      slide: { ...stored!.slide, contents: ["newer IndexedDB edit"] },
    })

    const second = await migrateLegacyActiveSlides([
      slide("one", "sunday", { contents: ["stale localStorage edit"] }),
    ])

    expect(second.status).toBe("already-completed")
    expect((await db.slides.get(["sunday", "one"]))?.slide.contents).toEqual([
      "newer IndexedDB edit",
    ])
  })

  it("deduplicates compound keys and skips malformed legacy records", async () => {
    const db = useIndexedDB()
    const result = await migrateLegacyActiveSlides([
      slide("one", "sunday"),
      slide("one", "sunday", { contents: ["duplicate"] }),
      { id: "missing-schedule" } as Slide,
    ])

    expect(result.record).toMatchObject({
      sourceCount: 3,
      eligibleCount: 1,
      insertedCount: 1,
      skippedCount: 2,
    })
    expect(await db.slides.count()).toBe(1)
  })

  it("removes session-only media values from the durable copy", async () => {
    const db = useIndexedDB()
    await migrateLegacyActiveSlides([
      slide("media", "sunday", {
        type: "media",
        background: "blob:operator-window",
        data: {
          id: "media",
          url: "blob:operator-window",
          blob: new Blob(["video"]),
        } as any,
      }),
    ])

    const stored = await db.slides.get(["sunday", "media"])
    expect(stored?.slide.background).toBe("")
    expect((stored?.slide.data as any)?.url).toBe("")
    expect((stored?.slide.data as any)?.blob).toBeUndefined()
  })

  it("rolls back slide writes when the completion marker cannot be committed", async () => {
    const db = useIndexedDB()
    vi.spyOn(db.migrationMeta, "put").mockRejectedValueOnce(
      new Error("simulated metadata failure")
    )

    await expect(
      migrateLegacyActiveSlides([slide("one", "sunday")])
    ).rejects.toThrow("simulated metadata failure")

    expect(await db.slides.count()).toBe(0)
    expect(
      await db.migrationMeta.get(LEGACY_ACTIVE_SLIDES_MIGRATION)
    ).toBeUndefined()
  })
})
