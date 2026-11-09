import { describe, expect, it } from "vitest"
import { isSongNewer } from "~/utils/songVersion"

/**
 * An edited song carries a newer `updatedAt` than the copy the server (or a
 * library sync) still holds. That is the only thing that stops the older copy
 * from replacing the edit, so the rule has to hold in both directions and must
 * never claim "newer" without evidence.
 */
describe("isSongNewer", () => {
  const edited = { updatedAt: "2026-11-09T10:00:00.000Z" }
  const older = { updatedAt: "2026-10-01T08:00:00.000Z" }

  it("is true only for a strictly later timestamp", () => {
    expect(isSongNewer(edited, older)).toBe(true)
    expect(isSongNewer(older, edited)).toBe(false)
    expect(isSongNewer(edited, { ...edited })).toBe(false)
  })

  it("compares instants, not strings", () => {
    // Same moment written with a different offset.
    expect(
      isSongNewer(
        { updatedAt: "2026-11-09T11:00:00.000+01:00" },
        { updatedAt: "2026-11-09T10:00:00.000Z" }
      )
    ).toBe(false)
    expect(
      isSongNewer(
        { updatedAt: "2026-11-09T09:30:00.000-01:00" },
        { updatedAt: "2026-11-09T10:00:00.000Z" }
      )
    ).toBe(true)
  })

  it("never reports newer when either side has no usable timestamp", () => {
    expect(isSongNewer(edited, {})).toBe(false)
    expect(isSongNewer({}, older)).toBe(false)
    expect(isSongNewer(edited, { updatedAt: "not a date" })).toBe(false)
    expect(isSongNewer(undefined, older)).toBe(false)
    expect(isSongNewer(edited, null)).toBe(false)
  })
})
