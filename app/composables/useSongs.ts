import { useAuthStore } from '~/store/auth'
import type { Song } from '~/types'
import { rememberSongSearch } from './useSongSearchLog'
import { safeDBOperation } from './useIndexedDB'

/**
 * Library songs this device has already claimed, kept in IndexedDB's `cached`
 * table so picking one again goes straight onto the schedule with no claim
 * round trip, online or not. The claim would release it again for free anyway
 * (a song claimed once stays the church's on Free, and Teams only counts
 * different songs), so skipping it costs the church nothing.
 *
 * A copy is used only while its `updatedAt` matches the search result being
 * picked, which the server sent moments ago: a song edited since the claim
 * goes through the claim again and the copy is replaced. Database scripts
 * that change lyrics must move `updatedAt` too, or a stale copy still matches.
 *
 * Keyed by church as well as song: a device shared by two churches must not
 * hand one church a song only the other claimed. Bump the version to drop
 * every copy at once.
 */
const CLAIMED_SONG_CACHE_VERSION = 1
const claimedSongKey = (churchId: string, songId: string) =>
  `claimed-song:v${CLAIMED_SONG_CACHE_VERSION}:${churchId}:${songId}`

const readClaimedSong = async (
  churchId: string,
  preview: Song
): Promise<Song | null> => {
  const songId = (preview as any)?._id
  if (!songId || !preview.updatedAt) return null
  const record = (await safeDBOperation((db) =>
    db.cached.get(claimedSongKey(churchId, songId))
  )) as { content?: Song } | undefined
  const song = record?.content
  return song?.lyrics && song.updatedAt === preview.updatedAt ? song : null
}

const writeClaimedSong = (churchId: string, song: Song) => {
  const songId = (song as any)?._id
  if (!songId) return
  const now = new Date().toISOString()
  // Not awaited: a failed write only costs the next pick a claim.
  safeDBOperation((db) =>
    db.cached.put({
      id: claimedSongKey(churchId, songId),
      content: song,
      createdAt: now,
      updatedAt: now,
    } as any)
  )
}

// Songs picked but not yet on the schedule, by id. Song rows read it to show a
// spinner from the click until the slide exists (see ActionCard), whatever
// the wait turns out to be: the claim, the local copy, building the slide.
const pendingSongIds = ref(new Set<string>())

export const isSongPending = (songId?: string) =>
  !!songId && pendingSongIds.value.has(songId)

export const setSongPending = (songId: string | undefined, pending: boolean) => {
  if (!songId) return
  const next = new Set(pendingSongIds.value)
  if (pending) next.add(songId)
  else next.delete(songId)
  pendingSongIds.value = next
}

// Claims on the wire, by id. Not reactive: only the double-click guard reads it.
const claimsInFlight = new Set<string>()

export default function useSongs() {
  const authStore = useAuthStore()
  const toast = useToast()
  const churchId = authStore.user?.churchId

  // Reactive states
  const loading = ref<boolean>(false)
  const songs = ref<Song[]>([])

  /**
   * Search songs by query
   */
  const searchSongs = async (
    query: string = '',
    limit: number = 20,
    source?: 'songs-list' | 'quick-actions'
  ): Promise<Song[]> => {
    try {
      loading.value = true

      // Encode the query: an unescaped "&" ("Kari Jobe & Cody Carnes") or "#"
      // would otherwise end the search value and drop the rest of the text.
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs?search=${encodeURIComponent(
          query
        )}&limit=${limit}${source ? `&source=${source}` : ''}`,
        {
          method: 'GET',
          key: `search-songs-${source}-${limit}-${query}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to search songs')
      }

      // Clean up song titles
      const songsData = ((data.value as any)?.data?.data || []).map(
        (song: Song) => ({
          ...song,
          title: song.title.replaceAll('â', "'"),
        })
      )

      rememberSongSearch((data.value as any)?.data?.search_id, songsData)
      songs.value = songsData
      return songsData
    } catch (error: any) {
      console.error('Error searching songs:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to search songs',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Proactive duplicate check: returns existing songs that look like duplicates
   * of the given title (similarity-filtered server-side, so it's empty for a
   * genuinely new song). Stays quiet on error — it's a non-blocking hint.
   */
  const findSimilarSongs = async (
    title: string,
    artist = '',
    lyrics = ''
  ): Promise<Song[]> => {
    const query = title?.trim()
    if (!query || query.length < 2) return []
    try {
      // POST so the full lyrics (the strongest signal, too long for a URL) ride
      // in the body. Returns only genuine near-duplicates, empty for a new song.
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/duplicates`,
        {
          method: 'POST',
          body: { title: query, artist: artist?.trim(), lyrics: lyrics?.trim(), churchId },
        }
      )
      if (error.value) return []
      return ((data.value as any)?.data?.data || []) as Song[]
    } catch {
      return []
    }
  }

  /**
   * Get all songs for the church
   */
  const getAllSongs = async (): Promise<Song[]> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/all?churchId=${churchId}`,
        {
          method: 'GET',
          key: 'get-all-songs',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch songs')
      }

      const songsData = (data.value as Song[]) || []
      rememberSongSearch((data.value as any)?.data?.search_id, songsData)
      songs.value = songsData
      return songsData
    } catch (error: any) {
      console.error('Error fetching all songs:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch songs',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Get songs count for the church
   */
  const getSongsCount = async (): Promise<number> => {
    try {
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/all/count?churchId=${churchId}`,
        {
          method: 'GET',
          key: 'get-songs-count',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch songs count')
      }

      return (data.value as number) || 0
    } catch (error: any) {
      console.error('Error fetching songs count:', error)
      return 0
    }
  }

  /**
   * Get a single song by ID
   */
  const getSongById = async (songId: string): Promise<Song | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/${songId}`,
        {
          method: 'GET',
          key: `get-song-${songId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch song')
      }

      return data.value as Song
    } catch (error: any) {
      console.error('Error fetching song:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Song not found',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Releases the full lyrics of a library song a free church is about to use.
   *
   * A free church's search returns library songs as previews (first verse,
   * `isPreview: true`). Turning one into a slide goes through here, which
   * spends one of the month's library songs server-side and returns the whole
   * song. Out of songs (429 SONG_QUOTA) opens the upgrade modal and resolves
   * null, so the caller simply does not create the slide.
   *
   * A song this device already claimed comes from the local copy instead (see
   * readClaimedSong), and a song still being claimed resolves null so a
   * double click cannot add it twice.
   *
   * Never queued offline: a retried claim would spend a song later for a slide
   * that was never made.
   */
  const claimSong = async (song: Song): Promise<Song | null> => {
    const songId = (song as any)?._id
    // Read at call time: PreviewContent creates this composable at setup,
    // possibly before the signed-in user has loaded.
    const claimChurchId = authStore.user?.churchId
    if (!songId || !claimChurchId) return null

    const cached = await readClaimedSong(claimChurchId, song)
    if (cached) return { ...song, ...cached, isPreview: false } as Song

    // A second click while the first claim is still out would add the song
    // twice once both land.
    if (claimsInFlight.has(songId)) return null

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.add({
        icon: 'i-bx-wifi-off',
        title: 'Library songs need a connection',
        description: 'Reconnect to add this song. Your own saved songs still work offline.',
        color: 'amber',
      })
      return null
    }

    claimsInFlight.add(songId)
    const { data, error } = await useAPIFetch(
      `/church/${claimChurchId}/songs/${songId}/claim`,
      { method: 'POST' }
    ).finally(() => claimsInFlight.delete(songId))

    if (error.value) {
      const body = (error.value as any)?.data
      if (body?.code === 'SONG_QUOTA') {
        useUsageQuotas().setSongsUsed(body.used)
        useGlobalEmit(appWideActions.showUpgradeModal, {
          feature: appWideActions.newSongSearch,
        })
        usePosthogCapture('SONG_QUOTA_REACHED', { used: body.used, limit: body.limit })
        return null
      }
      toast.add({
        icon: 'i-bx-error',
        title: "Couldn't add this song",
        description: body?.msg || body?.message || (error.value as any)?.message,
        color: 'red',
      })
      return null
    }

    // The count moved (or not, for a song already added this month); re-read
    // it rather than guess.
    useUsageQuotas().refresh()

    const full = (data.value as any)?.data as Song
    if (!full) return null
    writeClaimedSong(claimChurchId, full)
    return { ...song, ...full, isPreview: false } as Song
  }

  /**
   * Create a new song
   */
  const createSong = async (songData: Partial<Song>): Promise<Song | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs`,
        {
          method: 'POST',
          body: {
            ...songData,
            createdBy: authStore.user?._id,
            churchId: churchId,
          },
          key: 'create-song',
        }
      )

      if (error.value) {
        throw new Error(error.value?.data?.message || error.value?.message || 'Failed to create song')
      }

      toast.add({
        icon: 'i-bx-cloud-upload',
        title: 'Song uploaded successfully',
      })

      return data.value as Song
    } catch (error: any) {
      console.error('Error creating song:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to upload song',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing song
   */
  const updateSong = async (songId: string, updateData: Partial<Song>): Promise<Song | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/${songId}`,
        {
          method: 'PUT',
          body: updateData,
          key: `update-song-${songId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to update song')
      }

      toast.add({
        icon: 'i-bx-save',
        title: 'Song updated successfully',
      })

      return data.value as Song
    } catch (error: any) {
      console.error('Error updating song:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to update song',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a song
   */
  const deleteSong = async (songId: string): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/${songId}`,
        {
          method: 'DELETE',
          key: `delete-song-${songId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to delete song')
      }

      toast.add({
        icon: 'i-tabler-trash',
        title: 'Song deleted successfully',
      })

      return true
    } catch (error: any) {
      console.error('Error deleting song:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete song',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Parse song lyrics into verses
   */
  const parseSongLyrics = (lyrics: string, linesPerVerse: number = 4): string[] => {
    const verses = []
    let tempVerse = ''
    let lineCount = 0

    const lyricLines = lyrics?.replaceAll('\n \n', '\n\n')?.split('\n')

    for (let i = 0; i < lyricLines.length; i++) {
      let line = lyricLines[i]

      // Clean up line
      line = line
        ?.replaceAll("â", "'")
        .replaceAll('solo: ', '')
        .replaceAll(' ??? ', '')
        .replaceAll(' ?? ', '')
        .replaceAll('[force-verse-break]', '')

      // If line is empty, start new verse
      if (line?.trim() === '') {
        if (tempVerse) {
          verses.push(tempVerse.replace('\n\n', ''))
        }
        lineCount = 0
        tempVerse = ''
        continue
      }

      tempVerse += `${line}\n`
      lineCount += 1

      // Force verse break on double newline
      if (tempVerse.includes('\n\n')) {
        verses.push(tempVerse.replace('\n\n', ''))
        lineCount = 0
        tempVerse = ''
        continue
      }

      // Start new verse when line count is reached
      if (lineCount === linesPerVerse) {
        verses.push(tempVerse.replace('\n\n', ''))
        lineCount = 0
        tempVerse = ''
      }

      // Add remaining lines as last verse
      if (lyricLines.length - i === 1 && tempVerse) {
        verses.push(tempVerse.replace('\n\n', ''))
      }
    }

    return verses.filter((verse) => verse !== '')
  }

  return {
    loading,
    songs,
    searchSongs,
    claimSong,
    findSimilarSongs,
    getAllSongs,
    getSongsCount,
    getSongById,
    createSong,
    updateSong,
    deleteSong,
    parseSongLyrics,
  }
}
