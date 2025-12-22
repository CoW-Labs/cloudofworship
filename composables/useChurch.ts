import { useAuthStore } from '~/store/auth'
import type { Church } from '~/store/auth'
import type { Song, LibraryItem } from '~/types'

export default function useChurch() {
  const authStore = useAuthStore()
  const toast = useToast()

  // Reactive states
  const loading = ref<boolean>(false)

  /**
   * Fetch church information by ID
   */
  const fetchChurch = async (
    churchId?: string,
    includeTeammates: boolean = true
  ): Promise<Church | null> => {
    try {
      const targetChurchId = churchId || authStore.user?.churchId

      if (!targetChurchId) {
        throw new Error('No church ID provided')
      }

      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${targetChurchId}${includeTeammates ? '?teammates=true' : ''}`,
        {
          method: 'GET',
          key: `get-church-${targetChurchId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch church')
      }

      const church = data.value as unknown as Church
      authStore.setChurch(church)

      return church
    } catch (error: any) {
      console.error('Error fetching church:', error)
      toast.add({
        icon: 'i-mdi-alert-circle-outline',
        title: 'Failed to fetch church information',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new church
   */
  const createChurch = async (churchData: {
    name: string
    address?: string
    city?: string
    country?: string
    [key: string]: any
  }): Promise<Church | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch('/church', {
        method: 'POST',
        body: churchData,
        key: 'create-church',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to create church')
      }

      const church = data.value as Church
      authStore.setChurch(church)

      toast.add({
        icon: 'i-bx-church',
        title: 'Church created successfully',
        color: 'green',
      })

      return church
    } catch (error: any) {
      console.error('Error creating church:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to create church',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Update church information
   */
  const updateChurch = async (
    churchId: string,
    updateData: Partial<Church>
  ): Promise<Church | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(`/church/${churchId}`, {
        method: 'PUT',
        body: updateData,
        key: 'update-church',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to update church')
      }

      const church = data.value as Church
      authStore.setChurch(church)

      toast.add({
        icon: 'i-bx-save',
        title: 'Church updated successfully',
      })

      return church
    } catch (error: any) {
      console.error('Error updating church:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to update church',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch and cache church songs
   */
  const fetchChurchSongs = async (churchId?: string): Promise<Song[]> => {
    try {
      const targetChurchId = churchId || authStore.user?.churchId

      if (!targetChurchId) {
        throw new Error('No church ID provided')
      }

      loading.value = true

      // Get online count
      const { data: countData } = await useAPIFetch(
        `/church/${targetChurchId}/songs/all/count?churchId=${targetChurchId}`,
        {
          method: 'GET',
          key: 'get-church-songs-count',
        }
      )

      const onlineCount = (countData.value as number) || 0
      const db = useIndexedDB()
      const offlineCount = await db.library.where('type').equals('song').count()

      // If online has more songs, sync
      if (onlineCount > offlineCount) {
        // Delete offline songs
        await db.library.where('type').equals('song').delete()

        // Fetch all songs
        const { data: songsData } = await useAPIFetch(
          `/church/${targetChurchId}/songs/all?churchId=${targetChurchId}`,
          {
            method: 'GET',
            key: 'get-all-church-songs',
          }
        )

        const songs = (songsData.value as Song[]) || []

        // Prepare library items
        const libraryData: LibraryItem[] = songs.map((song) => ({
          id: song.id,
          type: 'song',
          content: JSON.parse(JSON.stringify(song)),
          createdAt: song.createdAt,
          updatedAt: song.updatedAt,
        }))

        // Process in chunks to avoid blocking
        const chunkSize = 50
        for (let i = 0; i < libraryData.length; i += chunkSize) {
          const chunk = libraryData.slice(i, i + chunkSize)
          await db.library.bulkAdd(chunk).catch((err) => {
            console.error('Failed to add song chunk:', err)
          })
        }

        return songs
      }

      return []
    } catch (error: any) {
      console.error('Error fetching church songs:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Get church members/teammates
   */
  const getChurchMembers = async (churchId?: string): Promise<any[]> => {
    try {
      const targetChurchId = churchId || authStore.user?.churchId

      if (!targetChurchId) {
        throw new Error('No church ID provided')
      }

      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${targetChurchId}/members`,
        {
          method: 'GET',
          key: `get-church-members-${targetChurchId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch members')
      }

      return (data.value as any[]) || []
    } catch (error: any) {
      console.error('Error fetching church members:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch members',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete church
   */
  const deleteChurch = async (churchId: string): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(`/church/${churchId}`, {
        method: 'DELETE',
        key: 'delete-church',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to delete church')
      }

      toast.add({
        icon: 'i-tabler-trash',
        title: 'Church deleted successfully',
      })

      return true
    } catch (error: any) {
      console.error('Error deleting church:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete church',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Get current church
   */
  const getCurrentChurch = (): Church | null => {
    return authStore.church
  }

  return {
    loading,
    fetchChurch,
    createChurch,
    updateChurch,
    fetchChurchSongs,
    getChurchMembers,
    deleteChurch,
    getCurrentChurch,
  }
}
