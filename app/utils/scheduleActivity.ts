import type { Schedule } from '~/types'

/**
 * When anything in a schedule last changed, in ms. The API stamps `lastUpdated`
 * on slide writes and renames; `updatedAt` only moves when the schedule document
 * itself is written. Schedules from before that stamp existed have `lastUpdated`
 * stuck at their creation, so the later of the two wins. A schedule that has not
 * synced yet has only the `createdAt` stamped when it was made locally.
 */
export const scheduleActivityTime = (schedule?: Partial<Schedule> | null): number => {
  const times = [schedule?.lastUpdated, schedule?.updatedAt, schedule?.createdAt]
    .map((stamp) => (stamp ? new Date(stamp).getTime() : NaN))
    .filter((time) => !Number.isNaN(time))
  return times.length ? Math.max(...times) : NaN
}
