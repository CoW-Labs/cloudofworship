import { describe, expect, it } from "vitest"
import { groupPresentationRecords } from "~/composables/useRecentPresentations"

/**
 * "Recent Slides" is reconstructed purely from the per-page media records an
 * import leaves behind, so the grouping has to survive the shapes those records
 * actually take: page numbers only present in the key, decks whose pages were
 * written out of order, and names carrying the original file extension.
 */

const page = (
  groupId: string,
  pageNumber: number,
  fileName: string,
  createdAt: string
) => ({
  key: `${groupId}-page-${pageNumber}`,
  groupId,
  category: "presentation-page" as const,
  originalName: `${fileName}-page-${pageNumber}.png`,
  createdAt,
})

describe("groupPresentationRecords", () => {
  it("groups pages of one deck into a single entry", () => {
    const result = groupPresentationRecords([
      page("slide-1", 1, "sermon.pdf", "2026-08-12T09:00:00.000Z"),
      page("slide-1", 2, "sermon.pdf", "2026-08-12T09:00:02.000Z"),
      page("slide-1", 3, "sermon.pdf", "2026-08-12T09:00:04.000Z"),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.groupId).toBe("slide-1")
    expect(result[0]?.pages).toHaveLength(3)
  })

  it("strips the page suffix and the file extension from the name", () => {
    const [entry] = groupPresentationRecords([
      page("slide-1", 1, "Worker's training class.pptx", "2026-08-12T09:00:00.000Z"),
    ])

    expect(entry?.name).toBe("Worker's training class")
  })

  it("orders pages numerically even when records arrive out of order", () => {
    const [entry] = groupPresentationRecords([
      page("slide-1", 10, "deck.pdf", "2026-08-12T09:00:20.000Z"),
      page("slide-1", 2, "deck.pdf", "2026-08-12T09:00:02.000Z"),
      page("slide-1", 1, "deck.pdf", "2026-08-12T09:00:00.000Z"),
    ])

    expect(entry?.pages.map((p) => p.page)).toEqual([1, 2, 10])
  })

  it("dates a deck by its earliest page and sorts decks newest first", () => {
    const result = groupPresentationRecords([
      page("older", 2, "old.pdf", "2026-08-10T09:00:05.000Z"),
      page("older", 1, "old.pdf", "2026-08-10T09:00:00.000Z"),
      page("newer", 1, "new.pdf", "2026-08-12T09:00:00.000Z"),
    ])

    expect(result.map((entry) => entry.groupId)).toEqual(["newer", "older"])
    expect(result[1]?.createdAt).toBe("2026-08-10T09:00:00.000Z")
  })

  it("ignores records from other media categories", () => {
    const result = groupPresentationRecords([
      page("slide-1", 1, "deck.pdf", "2026-08-12T09:00:00.000Z"),
      {
        key: "slide-2",
        groupId: "slide-2",
        category: "slide" as const,
        originalName: "photo.png",
        createdAt: "2026-08-12T10:00:00.000Z",
      },
    ])

    expect(result.map((entry) => entry.groupId)).toEqual(["slide-1"])
  })

  it("caps the number of decks returned", () => {
    const records = Array.from({ length: 15 }, (_, index) =>
      page(`slide-${index}`, 1, "deck.pdf", `2026-08-1${index % 9}T09:00:00.000Z`)
    )

    expect(groupPresentationRecords(records, 10)).toHaveLength(10)
  })

  it("falls back to a readable name when originalName is missing", () => {
    const [entry] = groupPresentationRecords([
      {
        key: "slide-1-page-1",
        groupId: "slide-1",
        category: "presentation-page" as const,
        createdAt: "2026-08-12T09:00:00.000Z",
      },
    ])

    expect(entry?.name).toBe("Presentation")
    expect(entry?.pages[0]?.page).toBe(1)
  })
})
