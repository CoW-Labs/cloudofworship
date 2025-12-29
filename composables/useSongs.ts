import { useAuthStore } from '~/store/auth'
import type { Song } from '~/types'

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
  const searchSongs = async (query: string = '', limit: number = 20): Promise<Song[]> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs?search=${query}&limit=${limit}`,
        {
          method: 'GET',
          key: `search-songs-${query}`,
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
        .replaceAll("â", "'")
        .replaceAll('solo: ', '')
        .replaceAll(' ??? ', '')
        .replaceAll(' ?? ', '')
        .replaceAll('[force-verse-break]', '')

      // If line is empty, start new verse
      if (line.trim() === '') {
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
    getAllSongs,
    getSongsCount,
    getSongById,
    createSong,
    updateSong,
    deleteSong,
    parseSongLyrics,
  }
}
