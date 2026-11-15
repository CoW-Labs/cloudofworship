import { useAuthStore } from "~/store/auth"

export interface ParsedEasyWorshipSong {
  title: string
  artist: string
  lyrics: string
}

export interface EasyWorshipImportResult {
  importedCount: number
  skippedDuplicates: number
  failedCount: number
  totalParsed: number
}

interface EasyWorshipParseResult {
  songs: ParsedEasyWorshipSong[]
  totalParsed: number
}

/**
 * Same slugification the manual "Add a song" form uses client-side (see
 * useURLFriendlyString), with a numeric suffix on collision — expected
 * whenever two songs in one import share a title and artist.
 */
const buildUniqueSongId = (
  title: string,
  artist: string,
  usedIds: Set<string>
): string => {
  const slug = useURLFriendlyString(`${artist} ${title}`)
  const base = slug || crypto.randomUUID()
  let id = base
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  usedIds.add(id)
  return id
}

/**
 * Unzips a zipped EasyWorship database export and reads every song out of
 * it, entirely on this machine — a Tauri Rust command unzips it, reads the
 * Paradox `Songs.DB`/`.MB` table, and strips the RTF lyrics. Nothing is
 * added to the library yet; the caller decides what to do with the result
 * (e.g. let the user review and pick which ones to keep).
 *
 * Desktop (Tauri) only: `zipPath` has to be a real path on disk, which a
 * browser file picker cannot give.
 */
export const parseEasyWorshipFile = async (
  zipPath: string
): Promise<EasyWorshipParseResult> => {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<EasyWorshipParseResult>("import_easyworship_songs", {
    path: zipPath,
  })
}

/**
 * Adds the given (already-parsed, already-picked) songs to this church's
 * library, one at a time — not in parallel. This used to be a backend
 * route that unzipped and parsed server-side, but a church's real export
 * bundles every past database rebuild plus media and routinely runs 1GB+,
 * which doesn't scale. Now that the parsing happens locally, the server
 * only ever sees this same lightweight per-song create call a manual "Add
 * a song" already makes — sequential on purpose, since keeping that load
 * low is the whole point of moving this off the server.
 */
export const importSelectedEasyWorshipSongs = async (
  songs: ParsedEasyWorshipSong[],
  onProgress?: (done: number, total: number) => void
): Promise<EasyWorshipImportResult> => {
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId

  const usedIds = new Set<string>()
  let importedCount = 0
  let skippedDuplicates = 0
  let failedCount = 0

  for (let i = 0; i < songs.length; i++) {
    // Offline, useAPIFetch queues a POST to replay later, which would add
    // songs after this import has reported them as not added. Stop instead.
    if (!navigator.onLine) {
      failedCount += songs.length - i
      break
    }

    const song = songs[i]!
    const id = buildUniqueSongId(song.title, song.artist, usedIds)

    try {
      const { data, error } = await useAPIFetch(`/church/${churchId}/songs`, {
        method: "POST",
        body: {
          id,
          title: song.title,
          artist: song.artist,
          lyrics: song.lyrics,
          // Always force: a bulk import can't stop and ask about every
          // near-duplicate. The exact-fingerprint guard below still runs
          // regardless of force, so true repeats are still skipped.
          force: true,
          importSource: "easyworship",
          createdBy: authStore.user?._id,
          churchId,
        },
        key: `easyworship-import-song-${id}`,
      })

      if (error.value) {
        if (error.value.statusCode === 409) {
          skippedDuplicates++
        } else {
          failedCount++
          console.warn(
            "EasyWorship import: failed to create song",
            song.title,
            error.value
          )
        }
      } else if (data.value) {
        importedCount++
      }
    } catch (err) {
      failedCount++
      console.warn("EasyWorship import: failed to create song", song.title, err)
    }

    onProgress?.(i + 1, songs.length)
  }

  return { importedCount, skippedDuplicates, failedCount, totalParsed: songs.length }
}
