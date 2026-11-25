import type { Slide } from "~/types"

/**
 * Which server version of a slide an edit started from.
 *
 * The API counts edits per slide (`rev`) and refuses a write whose `baseRev`
 * no longer matches (409). `slide.rev` travels with the content it describes,
 * so it is the base for an edit. It lags only after this device's own saves,
 * because a PUT response carries the new rev but not the slide object being
 * edited; those are remembered here and win when higher.
 *
 * A teammate's confirmed revision travels on their slide snapshot. It never
 * advances this device's own-write revision.
 */
const ownWriteRevs = new Map<string, number>()

const isRev = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

/** Record the rev a successful save of this device returned. Never lowers. */
export const noteSlideRev = (serverId: string | undefined, rev: unknown) => {
  if (!serverId || !isRev(rev)) return
  if ((ownWriteRevs.get(serverId) ?? -1) < rev) ownWriteRevs.set(serverId, rev)
}

/** The rev to send as `baseRev`, or null when the original revision is unknown. */
export const baseRevFor = (slide: Partial<Slide>): number | null => {
  const own = slide._id ? ownWriteRevs.get(slide._id) : undefined
  const carried = isRev(slide.rev) ? slide.rev : undefined
  if (own === undefined && carried === undefined) return null
  return Math.max(own ?? -1, carried ?? -1)
}

/**
 * Serialize each slide's writes across editor and resync, and across browser
 * tabs when Web Locks are available. Build the request after taking the lock.
 */
const savesInFlight = new Map<string, Promise<unknown>>()

export const runSlideSave = async <T>(
  serverId: string,
  send: () => Promise<T>
): Promise<T> => {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request(`cow:slide-save:${serverId}`, send)
  }
  while (savesInFlight.has(serverId)) {
    await savesInFlight.get(serverId)!.catch(() => {})
  }
  const pending = send()
  savesInFlight.set(serverId, pending)
  try {
    return await pending
  } finally {
    if (savesInFlight.get(serverId) === pending) savesInFlight.delete(serverId)
  }
}

/** An incoming version breaks the lineage of this device's earlier writes. */
export const forgetOwnSlideRev = (serverId?: string) => {
  if (serverId) ownWriteRevs.delete(serverId)
}
