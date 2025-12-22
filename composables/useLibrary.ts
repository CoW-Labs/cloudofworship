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
  const churchId = authStore.church?._id

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
   * Fetch saved slides from the API and cache them in IndexedDB
   */
  const fetchSavedSlides = async () => {
    try {
      const activeSchedule = appStore.currentState.activeSchedule
      if (!activeSchedule?._id) {
        console.warn('No active schedule found')
        return []
      }

      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/saved`,
        {
          method: 'GET',
          key: 'get-saved-slides',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch saved slides')
      }

      const slides = data.value as Slide[]

      // Cache slides in IndexedDB
      if (slides && slides.length > 0) {
        await cacheSlidesInLibrary(slides)
      }

      return slides
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
   * Cache slides in IndexedDB library
   */
  const cacheSlidesInLibrary = async (slides: Slide[]) => {
    try {
      const db = useIndexedDB()
      const librarySlides: LibraryItem[] = slides.map((slide) => ({
        id: slide._id || slide.id,
        type: libraryTypes.slide,
        content: slide,
        createdAt: slide.createdAt || new Date().toISOString(),
        updatedAt: slide.updatedAt || new Date().toISOString(),
      }))

      // Bulk add or update slides in library
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
