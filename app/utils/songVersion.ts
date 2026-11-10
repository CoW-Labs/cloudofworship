import type { Song } from "~/types"

const stamp = (song?: Pick<Song, "updatedAt"> | null) => {
  const time = Date.parse(song?.updatedAt || "")
  return Number.isFinite(time) ? time : null
}

/**
 * Whether `candidate` is a strictly newer version of a song than `baseline`.
 *
 * An edit to a song is stamped with `updatedAt` when it is saved, so this is
 * how a copy that carries an edit tells itself apart from the older copy the
 * server (or a library sync) still holds. A song with no usable timestamp on
 * either side is never reported as newer: nothing can be proven, so callers
 * keep what they have rather than overwrite it.
 */
export const isSongNewer = (
  candidate?: Pick<Song, "updatedAt"> | null,
  baseline?: Pick<Song, "updatedAt"> | null
) => {
  const candidateTime = stamp(candidate)
  const baselineTime = stamp(baseline)
  return (
    candidateTime !== null &&
    baselineTime !== null &&
    candidateTime > baselineTime
  )
}
