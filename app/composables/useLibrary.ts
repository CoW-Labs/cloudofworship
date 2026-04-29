import { useAuthStore } from '~/store/auth'
import { useAppStore } from '~/store/app'
import type { LibraryItem, Slide, Song } from '~/types'
import { liveQuery } from 'dexie'
import { useObservable } from '@vueuse/rxjs'
import fuzzysort from 'fuzzysort'

export default function useLibrary() {
  const authStore = useAuthStore()
  const appStore = useAppStore()
  const toast = useToast()
  const getChurchId = () => authStore.church?._id || authStore.user?.churchId

  // Reactive loading state
  const loading = ref<boolean>(true)

  // Observable for library items from IndexedDB
  const libraryItems = useObservable<LibraryItem[]>(
    liveQuery(async () => {
      loading.value = true
      const data = await useIndexedDB()
        .library.orderBy('createdAt')
        .reverse()
        .toArray()
      loading.value = false
      return data
    }) as any
  )

  // Computed: Filter songs from library
  const savedSongs = computed(() => {
    return (
      libraryItems?.value?.filter((item) => item.type === libraryTypes.song) || []
    )
  })

  // Computed: Filter slides from library
  const savedSlides = computed(() => {
    return libraryItems?.value?.filter((item) => item.type === libraryTypes.slide) || []
  })

  /**
   * Fetch saved slides from the API and cache them in IndexedDB.
   * The backend filters by churchId only and ignores the scheduleId, so we
   * fall back to the first available schedule if no active one is set.
   */
  const fetchSavedSlides = async () => {
    try {
      // Backend getSavedSlides only uses req.user.churchId — scheduleId is
      // required by the URL structure but not used for filtering.
      const scheduleId =
        appStore.currentState.activeSchedule?._id ||
        appStore.currentState.schedules?.[0]?._id

      if (!scheduleId) {
        console.warn('No schedule available to fetch saved slides')
        return []
      }
      const churchId = getChurchId()
      if (!churchId) {
        console.warn('No church available to fetch saved slides')
        return []
      }

      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${scheduleId}/slides/saved`,
        {
          method: 'GET',
          key: 'get-saved-slides',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch saved slides')
      }

      const remoteSlides = data.value as Slide[]

      // Merge local-only slides up to the server before syncing.
      // A slide may exist only in this user's IndexedDB if it was saved before
      // the saveSlideOnline fix, or while offline. Upload any such slides so
      // they aren't silently lost when we overwrite the local cache.
      const db = useIndexedDB()
      const localSlideItems = await db.library
        .where('type')
        .equals(libraryTypes.slide)
        .toArray()

      const remoteIds = new Set((remoteSlides || []).map((s) => s._id || s.id))
      const localOnlySlides = localSlideItems
        .map((item) => item.content as Slide)
        .filter((s) => {
          const id = s._id || s.id
          return id && !remoteIds.has(id)
        })

      const uploadedLocalSlides: Slide[] = []
      if (localOnlySlides.length > 0) {
        const { createSlide, saveSlideOnline } = useSlides()
        const uploadResults = await Promise.allSettled(
          localOnlySlides.map(async (slide) => {
            const serverSlide = slide._id ? slide : await createSlide(slide)
            if (!serverSlide?._id) return null
            const wasSaved = await saveSlideOnline(serverSlide)
            return wasSaved ? serverSlide : null
          })
        )
        uploadedLocalSlides.push(
          ...uploadResults
            .filter(
              (result): result is PromiseFulfilledResult<Slide | null> =>
                result.status === 'fulfilled'
            )
            .map((result) => result.value)
            .filter((slide): slide is Slide => Boolean(slide))
        )
      }

      // Merge: remote is source of truth for saved status, but include only
      // local-only slides that were successfully uploaded/saved.
      const mergedIds = new Set((remoteSlides || []).map((s) => s._id || s.id))
      const mergedSlides = [
        ...(remoteSlides || []),
        ...uploadedLocalSlides.filter((slide) => {
          const id = slide._id || slide.id
          return Boolean(id) && !mergedIds.has(id)
        }),
      ]

      await cacheSlidesInLibrary(mergedSlides)

      return mergedSlides
    } catch (error) {
      console.error('Error fetching saved slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch saved slides',
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Cache slides in IndexedDB library.
   * Replaces all existing slide entries so IndexedDB always mirrors the
   * server exactly — prevents stale locally-saved slides accumulating and
   * causing different counts across team members.
   */
  const cacheSlidesInLibrary = async (slides: Slide[]) => {
    try {
      const db = useIndexedDB()

      // Delete all existing slide-type entries first so removed saves don't linger
      const existingSlideIds = await db.library
        .where('type')
        .equals(libraryTypes.slide)
        .primaryKeys()
      if (existingSlideIds.length > 0) {
        await db.library.bulkDelete(existingSlideIds)
      }

      const librarySlides: LibraryItem[] = slides.map((slide) => ({
        id: slide._id || slide.id,
        type: libraryTypes.slide,
        content: slide,
        createdAt: slide.createdAt || new Date().toISOString(),
        updatedAt: slide.updatedAt || new Date().toISOString(),
      }))

      await db.library.bulkPut(librarySlides)
    } catch (error) {
      console.error('Error caching slides in library:', error)
    }
  }

  /**
   * Save a song to the library
   */
  const saveSong = async (song: Song) => {
    try {
      const db = useIndexedDB()
      const libraryItem: LibraryItem = {
        id: song._id || song.id,
        type: libraryTypes.song,
        content: song,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await db.library
        .put(libraryItem)
        .catch((err) => console.error('Failed to add song to library:', err))

      toast.add({ icon: 'i-bx-save', title: 'Song saved to Library' })
      return libraryItem
    } catch (error) {
      console.error('Error saving song to library:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to save song',
        color: 'red',
      })
      return null
    }
  }

  /**
   * Save a slide to the library
   */
  const saveSlide = async (slide: Slide) => {
    try {
      const db = useIndexedDB()
      const libraryItem: LibraryItem = {
        id: slide._id || slide.id,
        type: libraryTypes.slide,
        content: slide,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await db.library
        .put(libraryItem)
        .catch((err) => console.error('Failed to add slide to library:', err))

      // Persist to server so all church members can see this saved slide
      const { saveSlideOnline } = useSlides()
      await saveSlideOnline(slide)

      // Re-fetch from server so local cache reflects the latest saved set
      await fetchSavedSlides()

      toast.add({ icon: 'i-bx-save', title: 'Slide saved to Library' })
      return libraryItem
    } catch (error) {
      console.error('Error saving slide to library:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to save slide',
        color: 'red',
      })
      return null
    }
  }

  /**
   * Delete a song from the library
   */
  const deleteSong = async (songId: string) => {
    try {
      await useIndexedDB()
        .library.delete(songId)
        .catch((err) => console.error('Failed to delete song:', err))

      toast.add({ icon: 'i-tabler-trash', title: 'Song has been deleted' })
    } catch (error) {
      console.error('Error deleting song from library:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete song',
        color: 'red',
      })
    }
  }

  /**
   * Delete a slide from the library
   */
  const deleteSlide = async (slideId: string) => {
    try {
      const { unsaveSlideOnline } = useSlides()

      await useIndexedDB()
        .library.delete(slideId)
        .catch((err) => console.error('Failed to delete slide:', err))

      toast.add({ icon: 'i-tabler-trash', title: 'Slide has been deleted' })

      // Also unsave the slide online
      await unsaveSlideOnline(slideId)
    } catch (error) {
      console.error('Error deleting slide from library:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete slide',
        color: 'red',
      })
    }
  }

  /**
   * Search library items using fuzzy search
   */
  const searchLibraryItems = (query: string = ''): LibraryItem[] => {
    if (!query || query.length < 2) {
      return []
    }

    // Cast LibraryItem to Fuzzysort.Prepared to avoid errors
    const tempLibraryItems = [...(libraryItems.value || [])].map(
      (item) => item as unknown as Fuzzysort.Prepared
    )

    let results: Array<Fuzzysort.Result> | any = fuzzysort.go(
      query,
      tempLibraryItems,
      {
        keys: [
          'id',
          'content.type',
          'content.title',
          'content.name',
          'content.artist',
        ],
      }
    )

    results = results?.map((result: Fuzzysort.Result | any) => result.obj)
    return results as LibraryItem[]
  }

  /**
   * Get a library item by ID
   */
  const getLibraryItem = async (itemId: string): Promise<LibraryItem | undefined> => {
    try {
      const db = useIndexedDB()
      return await db.library.get(itemId)
    } catch (error) {
      console.error('Error getting library item:', error)
      return undefined
    }
  }

  /**
   * Check if an item is saved in the library
   */
  const isItemSaved = async (itemId: string): Promise<boolean> => {
    try {
      const item = await getLibraryItem(itemId)
      return !!item
    } catch (error) {
      console.error('Error checking if item is saved:', error)
      return false
    }
  }

  /**
   * Refresh library by fetching saved items from the API
   */
  const refreshLibrary = async () => {
    await fetchSavedSlides()
  }

  return {
    loading,
    libraryItems,
    savedSongs,
    savedSlides,
    fetchSavedSlides,
    cacheSlidesInLibrary,
    saveSong,
    saveSlide,
    deleteSong,
    deleteSlide,
    searchLibraryItems,
    getLibraryItem,
    isItemSaved,
    refreshLibrary,
  }
}
