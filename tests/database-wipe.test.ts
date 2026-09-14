import { afterEach, beforeEach, describe, expect, it } from "vitest"
import useIndexedDB, { deleteDatabase } from "~/composables/useIndexedDB"
import {
  clearDatabaseWipe,
  isDatabaseWiping,
  markDatabaseWipe,
} from "~/utils/databaseWipe"
import {
  shouldSuppressError,
  shouldSuppressExceptionEvent,
} from "~/utils/errorFilters"

const databaseClosedError = () => {
  const error = new Error("Database has been closed")
  error.name = "DatabaseClosedError"
  return error
}

const exceptionEvent = (type: string, value: string) => ({
  properties: {
    $exception_list: [{ type, value }],
  },
})

describe("deleteDatabase", () => {
  beforeEach(() => clearDatabaseWipe())
  afterEach(() => clearDatabaseWipe())

  it("hands back a working connection instead of the deleted one", async () => {
    const before = useIndexedDB()
    await before.library.put({
      id: "item-1",
      type: "slide",
      content: "{}",
      createdAt: "",
      updatedAt: "",
    } as any)
    expect(await before.library.count()).toBe(1)

    await deleteDatabase()

    // The old handle is closed for good; the singleton must not still be it.
    const after = useIndexedDB()
    expect(after).not.toBe(before)
    expect(after.isOpen()).toBe(true)
    expect(await after.library.count()).toBe(0)
  })

  it("marks the wipe so late rejections are not reported as crashes", async () => {
    expect(isDatabaseWiping()).toBe(false)
    await deleteDatabase()
    expect(isDatabaseWiping()).toBe(true)
  })
})

describe("DatabaseClosedError reporting", () => {
  beforeEach(() => clearDatabaseWipe())
  afterEach(() => clearDatabaseWipe())

  it("reports a close nobody asked for", () => {
    expect(shouldSuppressError(databaseClosedError())).toBe(false)
    expect(
      shouldSuppressExceptionEvent(
        exceptionEvent("DatabaseClosedError", "Database has been closed")
      )
    ).toBe(false)
  })

  it("stays quiet about the tail of a deliberate wipe", () => {
    markDatabaseWipe()
    expect(shouldSuppressError(databaseClosedError())).toBe(true)
    expect(
      shouldSuppressExceptionEvent(
        exceptionEvent("DatabaseClosedError", "Database has been closed")
      )
    ).toBe(true)
  })

  it("keeps reporting everything else during a wipe", () => {
    markDatabaseWipe()
    expect(shouldSuppressError(new TypeError("Something else broke"))).toBe(
      false
    )
    expect(
      shouldSuppressExceptionEvent(
        exceptionEvent("TypeError", "Something else broke")
      )
    ).toBe(false)
  })

  it("forgets the wipe once its grace period has passed", () => {
    markDatabaseWipe()
    const realNow = Date.now
    Date.now = () => realNow() + 10_000
    try {
      expect(shouldSuppressError(databaseClosedError())).toBe(false)
    } finally {
      Date.now = realNow
    }
  })
})
