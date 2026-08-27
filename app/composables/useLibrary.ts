import { useAuthStore } from '~/store/auth'
import { useAppStore } from '~/store/app'
import type { LibraryItem, Slide, Song } from '~/types'
import { liveQuery } from 'dexie'
import { useObservable } from '@vueuse/rxjs'
import { useOnline } from '@vueuse/core'
import fuzzysort from 'fuzzysort'
import { safeDBGet } from './useIndexedDB'

export default function useLibrary() {
  const authStore = useAuthStore()
  const appStore = useAppStore()
  const toast = useToast()
  const online = useOnline()
  const getChurchId = () => authStore.church?._id || authStore.user?.churchId
  const localMedia = useLocalMediaStorage()

  const toCacheableSlide = (slide: Slide): Slide | null => {
    try {
      return structuredClone(toRaw(slide))
    } catch {
      try {
        return JSON.parse(JSON.stringify(toRaw(slide))) as Slide
      } catch (error) {
        console.error('Unable to prepare slide for library cache:', error)
        return null
      }
    }
  }

  const toCacheableSong = (song: Song): Song | null => {
    try {
      return structuredClone(toRaw(song))
    } catch {
      try {
        return JSON.parse(JSON.stringify(toRaw(song))) as Song
      } catch (error) {
        console.error('Unable to prepare song for library cache:', error)
        return null
      }
    }
  }

  // Reactive loading state
  const loading = ref<boolean>(true)

  // Observable for library items from IndexedDB.
  // NOTE: don't toggle `loading` in here — this re-runs on every write to the
  // `library` table (including the delete+put during a refresh), so flipping
  // the skeleton on each emission causes a visible flash. `loading` is owned by
  // the fetch/refresh functions instead.
  const libraryItems = useObservable<LibraryItem[]>(
    liveQuery(async () => {
      const data = await useIndexedDB()
        .library.orderBy('createdAt')
        .reverse()
        .toArray()
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
            if (slide._id) {
              const wasSaved = await saveSlideOnline(slide)
              if (wasSaved) return slide
              return null
            }

            const { _id, ...slideWithoutServerId } = slide
            const serverSlide = await createSlide(slideWithoutServerId)
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

      const librarySlides = slides.reduce<LibraryItem[]>((items, slide) => {
          const cacheableSlide = toCacheableSlide(slide)
          if (!cacheableSlide) return items

          const slideId = cacheableSlide._id || cacheableSlide.id
          if (!slideId) return items

          items.push({
            id: slideId,
            type: libraryTypes.slide,
            content: cacheableSlide,
            createdAt: cacheableSlide.createdAt || new Date().toISOString(),
            updatedAt: cacheableSlide.updatedAt || new Date().toISOString(),
          })
          return items
        }, [])

      // Replace all slide entries in a single transaction so the liveQuery only
      // emits once (after commit) and never observes the empty mid-state between
      // the delete and the put — which would otherwise flicker the list.
      await db.transaction('rw', db.library, async () => {
        const existingSlideIds = await db.library
          .where('type')
          .equals(libraryTypes.slide)
          .primaryKeys()
        if (existingSlideIds.length > 0) {
          await db.library.bulkDelete(existingSlideIds)
        }
        await db.library.bulkPut(librarySlides)
      })
    } catch (error) {
      console.error('Error caching slides in library:', error)
    }
  }

  // A song counts as "already on the server" if either its client id or its
  // server _id appears in the catalog. Local saves usually only carry the
  // client `id`, while catalog songs carry both — so we match on either.
  const collectSongIds = (songs: Song[]): Set<string> => {
    const ids = new Set<string>()
    songs.forEach((song) => {
      if (song.id) ids.add(song.id)
      if (song._id) ids.add(song._id)
    })
    return ids
  }

  const isSongInSet = (song: Song, ids: Set<string>): boolean =>
    Boolean((song.id && ids.has(song.id)) || (song._id && ids.has(song._id)))

  /**
   * Best-effort, silent upload of a single local-only song to the church
   * catalog. Failures — including the server's duplicate guard (409) — are
   * swallowed; the caller keeps the local copy either way.
   */
  const uploadLocalSong = async (
    song: Song,
    churchId: string
  ): Promise<boolean> => {
    try {
      const { error } = await useAPIFetch(`/church/${churchId}/songs`, {
        method: 'POST',
        body: {
          ...song,
          createdBy: authStore.user?._id,
          churchId,
        },
        key: `library-upload-song-${song.id || song._id}`,
      })
      return !error.value
    } catch (error) {
      console.error('Error uploading local song to catalog:', error)
      return false
    }
  }

  /**
   * Fetch the church's song catalog from the API and merge it with locally
   * saved songs, mirroring fetchSavedSlides.
   *
   * Unlike slides, the backend has no dedicated "saved songs" collection — the
   * only server-backed set is the full church catalog (/songs/all), so that is
   * treated as the source of truth. Any local-only songs (e.g. created offline,
   * which AddSong saves locally without uploading) are pushed up and preserved
   * rather than wiped, so a refresh never loses a song.
   */
  const fetchSavedSongs = async (): Promise<Song[]> => {
    try {
      const churchId = getChurchId()
      if (!churchId) {
        console.warn('No church available to fetch saved songs')
        return []
      }

      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/songs/all?churchId=${churchId}`,
        {
          method: 'GET',
          key: 'get-library-church-songs',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch church songs')
      }

      const remoteSongs = (data.value as Song[]) || []

      // Find songs that live only in this device's IndexedDB.
      const db = useIndexedDB()
      const localSongItems = await db.library
        .where('type')
        .equals(libraryTypes.song)
        .toArray()

      const remoteIds = collectSongIds(remoteSongs)
      const localOnlySongs = localSongItems
        .map((item) => item.content as Song)
        .filter((song) => (song.id || song._id) && !isSongInSet(song, remoteIds))

      // Best-effort push of local-only songs up to the catalog (online only) so
      // teammates see them too. The local copy is kept regardless of outcome.
      if (online.value && localOnlySongs.length > 0) {
        await Promise.allSettled(
          localOnlySongs.map((song) => uploadLocalSong(song, churchId))
        )
      }

      // Merge: remote catalog is the source of truth, plus every local-only song
      // so offline / failed-upload songs survive the cache replacement.
      const mergedSongs = [...remoteSongs, ...localOnlySongs]

      await cacheSongsInLibrary(mergedSongs)

      return mergedSongs
    } catch (error) {
      console.error('Error fetching saved songs:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Cache songs in IndexedDB library.
   * Replaces all existing song entries so IndexedDB mirrors the merged set
   * (server catalog + preserved local-only songs) exactly.
   */
  const cacheSongsInLibrary = async (songs: Song[]) => {
    try {
      const db = useIndexedDB()

      const librarySongs = songs.reduce<LibraryItem[]>((items, song) => {
          const cacheableSong = toCacheableSong(song)
          if (!cacheableSong) return items

          // Key on the client `id` so delete/lookup (which use song.id) keep working.
          const songId = cacheableSong.id || cacheableSong._id
          if (!songId) return items

          items.push({
            id: songId,
            type: libraryTypes.song,
            content: cacheableSong,
            createdAt: cacheableSong.createdAt || new Date().toISOString(),
            updatedAt: cacheableSong.updatedAt || new Date().toISOString(),
          })
          return items
        }, [])

      // Replace all song entries in a single transaction so the liveQuery only
      // emits once (after commit) and never observes the empty mid-state between
      // the delete and the put — which would otherwise flicker the list.
      await db.transaction('rw', db.library, async () => {
        const existingSongIds = await db.library
          .where('type')
          .equals(libraryTypes.song)
          .primaryKeys()
        if (existingSongIds.length > 0) {
          await db.library.bulkDelete(existingSongIds)
        }
        await db.library.bulkPut(librarySongs)
      })
    } catch (error) {
      console.error('Error caching songs in library:', error)
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
   * Drop a slide's locally cached media. Presentation slides write one record per
   * page keyed `${slideId}-page-${n}`, so a single delete by ID would miss them.
   */
  const deleteLocalMedia = async (slideId: string) => {
    await localMedia.deleteGroup(slideId)
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

      // The library copy was the last thing keeping this slide's media around —
      // slide deletion deliberately leaves the blob alone while the slide is
      // saved — so free it now. Unless the slide is still sitting in a schedule,
      // in which case that copy is still playing from it.
      const stillInSchedule = appStore.activeSlides.some(
        (slide) => slide.id === slideId || slide._id === slideId
      )
      if (!stillInSchedule) {
        // Best-effort: deleteGroup refuses when another slide still points at
        // the same media. The library row is already gone at this point, so
        // letting that abort the flow would skip unsaveSlideOnline below and
        // wrongly report the deletion as failed.
        await deleteLocalMedia(slideId).catch((error) =>
          console.warn('Local media kept — still referenced by another slide', error)
        )
      }

      toast.add({ icon: 'i-tabler-trash', title: 'Slide has been deleted' })

      // Also unsave the slide online — this is what releases the uploaded file
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
      return await safeDBGet(db.library, itemId)
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
   * Refresh library by fetching saved items from the API.
   * Songs and slides come from different backend sources (the church catalog
   * vs. the saved-slides collection), so fetch them in parallel.
   */
  const refreshLibrary = async () => {
    await Promise.all([fetchSavedSlides(), fetchSavedSongs()])
  }

  return {
    loading,
    libraryItems,
    savedSongs,
    savedSlides,
    fetchSavedSlides,
    fetchSavedSongs,
    cacheSlidesInLibrary,
    cacheSongsInLibrary,
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
