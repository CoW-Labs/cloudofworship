import { useAuthStore } from '~/store/auth'
import type { Song } from '~/types'

// The API logs every song search and returns its `search_id`. Picking a song
// from those results is reported back against that id, which is what lets the
// ranking be measured on real queries (see searchLog.js in the API).
//
// Picks arrive far from the search that produced them — a "new-song" event
// from QuickActions or SongsList, by click or keyboard — so rather than thread
// the id through every list, remember which search last returned each song.
// The most recent search wins: if "way maker" and then "miracle worker" both
// return the same song, the pick belongs to the search the operator was in.

// A pick this long after the search is a different intent, not a result of it.
const PICK_WINDOW_MS = 30 * 60 * 1000
const MAX_REMEMBERED = 200

const lastSearchBySong = new Map<string, { searchId: string, at: number }>()

export const rememberSongSearch = (searchId: string | undefined, songs: Song[]) => {
  if (!searchId) return
  const at = Date.now()
  for (const song of songs) {
    if (!song._id) continue
    lastSearchBySong.delete(song._id)
    lastSearchBySong.set(song._id, { searchId, at })
  }
  // Maps iterate in insertion order, so the oldest entries go first.
  for (const key of lastSearchBySong.keys()) {
    if (lastSearchBySong.size <= MAX_REMEMBERED) break
    lastSearchBySong.delete(key)
  }
}

/**
 * Report that `song` was picked, if it came from a recent search. Fire and
 * forget: a lost pick must never get in the way of creating the slide.
 */
export const reportSongSearchPick = (song?: Song | null) => {
  const songId = song?._id
  if (!songId) return
  const entry = lastSearchBySong.get(songId)
  if (!entry) return
  lastSearchBySong.delete(songId)
  if (Date.now() - entry.at > PICK_WINDOW_MS) return

  const churchId = useAuthStore().user?.churchId
  useAPIFetch(`/church/${churchId}/songs/search-logs/${entry.searchId}/picks`, {
    method: 'POST',
    body: { songId },
  }).catch(() => {})
}
