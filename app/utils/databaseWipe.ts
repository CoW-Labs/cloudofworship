/**
 * Shared state between `useIndexedDB`'s wipe helper and the error filters.
 *
 * "Delete all local data" in Storage settings calls Dexie's `db.delete()`,
 * which closes the connection out from under everything still using it. Media
 * rehydration, the slide shadow writes and the prefetch queue all run
 * fire-and-forget on their own cached handle, so a wipe during a service left
 * PostHog with a burst of unhandled `DatabaseClosedError` rejections — 29 in
 * one desktop session — that read like a crash but were the operator getting
 * exactly what they asked for.
 *
 * The rejections themselves cannot be prevented: an in-flight IndexedDB
 * request has nowhere to go once its connection is gone. What can be fixed is
 * calling them a bug. A close that this app asked for is expected; one that
 * arrives unannounced (storage reclaimed, another window upgrading the schema)
 * is still worth reporting, so the suppression is scoped to the wipe rather
 * than applied to the error type at large.
 */

/**
 * How long after a wipe to keep treating a closed database as expected.
 *
 * Dexie rejects queued operations as soon as the connection goes, so this only
 * has to outlive the tail of whatever was already in flight — not the wipe.
 */
const WIPE_GRACE_MS = 5_000

let wipeSettlesAt = 0

/** Called by `deleteDatabase()` before the connection is torn down. */
export const markDatabaseWipe = () => {
  wipeSettlesAt = Date.now() + WIPE_GRACE_MS
}

export const isDatabaseWiping = () => Date.now() < wipeSettlesAt

/** Test seam: forget any wipe currently in its grace period. */
export const clearDatabaseWipe = () => {
  wipeSettlesAt = 0
}

/** Dexie's error for any operation on a connection that has been closed. */
export const isDatabaseClosedError = (text: string | undefined | null) =>
  Boolean(text && text.includes("DatabaseClosedError"))
