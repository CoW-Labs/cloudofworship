import { useDebounceFn, useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide } from "~/types"
import {
  getAPIErrorMessage,
  isForbiddenError,
  isNotFoundError,
} from "~/utils/apiErrors"

export default function useSlides() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const online = useOnline()
  const getChurchId = () => authStore.church?._id || authStore.user?.churchId
  const slides = ref<Array<Slide>>(appStore.currentState.activeSlides || [])
  const loading = ref<boolean>(false)
  const removeStaleSlide = (slideId?: string) => {
    if (!slideId) return

    const nextSlides = appStore.currentState.activeSlides.filter(
      (activeSlide) => activeSlide?._id !== slideId && activeSlide?.id !== slideId
    )
    if (nextSlides.length !== appStore.currentState.activeSlides.length) {
      appStore.setActiveSlides(nextSlides)
    }
  }

  const showForbiddenToast = () => {
    toast.add({
      icon: 'i-bx-lock-alt',
      title: "You don't have permission to edit this schedule.",
      color: 'red',
    })
  }

  const updateLiveOutput = (updatedSlide: Slide, options?: { forceGoLive: boolean }) => {
    const shouldUpdateLiveSlide =
      updatedSlide.id === appStore.currentState.liveSlideId ||
      options?.forceGoLive

    // Update only the changed slide. Replacing the full schedule array here
    // made every verse navigation re-filter and re-render unrelated slides.
    appStore.updateSlideInActiveSlides(updatedSlide)

    if (shouldUpdateLiveSlide) {
      // Same-slide verse changes already have the correct live id. Avoid a
      // second Pinia mutation, persistence pass, and shared-state broadcast.
      if (appStore.currentState.liveSlideId !== updatedSlide.id) {
        appStore.setLiveSlide(updatedSlide.id)
      }

      // Send immediately after the targeted local update. The channel applies
      // one serialization boundary so Vue reactive proxies remain clone-safe.
      useBroadcastPost(updatedSlide)

      // Local-first: if this slide's media is still a remote URL on this device
      // (e.g. a teammate's slide received via socket that idle-prefetch hasn't
      // localized yet), fetch+cache it once, then re-broadcast with the local
      // object URL so the operator preview and projection play locally instead
      // of streaming. Gated on a remote URL, so the creating device (already a
      // blob: URL) and verse navigation never trigger it.
      localizeLiveSlideMedia(updatedSlide)
    }
  }

  const { rehydrateSlideMedia } = useSlideMediaCache()

  const localizeLiveSlideMedia = (liveSlide: Slide) => {
    const bg = liveSlide.background
    const isRemote = !!bg && (bg.startsWith("http://") || bg.startsWith("https://"))
    const bearsMedia =
      liveSlide.type === slideTypes.media ||
      liveSlide.type === slideTypes.presentation ||
      !!liveSlide.backgroundVideoKey
    if (!isRemote || !bearsMedia) return

    rehydrateSlideMedia({ ...liveSlide }, { allowDownload: true })
      .then((rehydrated) => {
        // Nothing was localized (no local/remote copy available) — leave as-is.
        if (rehydrated.background === bg) return
        appStore.updateSlideInActiveSlides(rehydrated)
        if (appStore.currentState.liveSlideId === rehydrated.id) {
          useBroadcastPost(rehydrated)
        }
      })
      .catch((err) => console.warn("Go-live media localize failed:", err))
  }

  /**
   * Fetch slides for the active schedule
   */
  const fetchScheduleSlides = async (scheduleId?: string): Promise<Slide[]> => {
    // Don't fetch when offline
    if (!online.value) {
      console.warn('Device is offline. Skipping fetch.')
      return []
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule
      const targetScheduleId = scheduleId || activeSchedule?._id

      if (!targetScheduleId) {
        console.warn('No schedule ID provided')
        return []
      }

      const churchId = getChurchId()
      if (!churchId) {
        console.warn('No church ID available. Skipping slide fetch.')
        return []
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${targetScheduleId}/slides`,
        {
          method: 'GET',
          key: `get-schedule-slides-${targetScheduleId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Unable to refresh slides')
      }

      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error fetching schedule slides:', error)
      return []
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Fetch saved slides from the API
   */
  const fetchSavedSlides = async (): Promise<Slide[]> => {
    if (!online.value) {
      console.warn('Cannot fetch saved slides while offline')
      return []
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        console.warn('No active schedule found')
        return []
      }

      const churchId = getChurchId()
      if (!churchId) {
        console.warn('No church ID available. Skipping saved slide fetch.')
        return []
      }

      loading.value = true
      appStore.setSlidesLoading(true)

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

      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error getting saved slides:', error)
      return []
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Create a single slide online
   */
  const createSlide = async (slide: Slide): Promise<Slide | null> => {
    // Don't make API calls when offline
    if (!online.value) {
      console.warn('Device is offline. Skipping create.')
      return null
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        throw new Error('No active schedule found')
      }

      const churchId = getChurchId()
      if (!churchId) {
        throw new Error('No church ID available')
      }

      loading.value = true
      // appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides`,
        {
          method: 'POST',
          body: slide,
          key: 'create-slide',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to create slide')
      }

      appStore.setLastSynced(new Date().toISOString())
      return data.value as Slide
    } catch (error: any) {
      console.error('Error creating slide:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to create slide',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
      // appStore.setSlidesLoading(false)
    }
  }

  /**
   * Batch create slides online.
   * Returns an object with:
   * - inserted: Slide[] — slides successfully created on the server
   * - duplicateIds: string[] — slide ids that already existed (were already uploaded)
   */
  const batchCreateSlides = async (slides: Slide[]): Promise<{ inserted: Slide[]; duplicateIds: string[] }> => {
    const emptyResult = { inserted: [], duplicateIds: [] }

    if (!online.value) {
      console.warn('Cannot batch create slides while offline')
      return emptyResult
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        throw new Error('No active schedule found')
      }

      const churchId = getChurchId()
      if (!churchId) {
        throw new Error('No church ID available')
      }

      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/batch`,
        {
          method: 'POST',
          body: slides,
          key: `batch-create-slides-${Date.now()}`,
        }
      )

      if (error.value) {
        if (isForbiddenError(error.value)) {
          showForbiddenToast()
          return emptyResult
        }
        throw new Error(getAPIErrorMessage(error.value, 'Failed to create slides'))
      }

      appStore.setLastSynced(new Date().toISOString())

      const result = data.value as any

      // The server returns either:
      // 1. An array of slides (all succeeded, no duplicates)
      // 2. An object { inserted: Slide[], duplicateIds: string[] } (partial duplicates)
      if (Array.isArray(result)) {
        return { inserted: result as Slide[], duplicateIds: [] }
      }

      return {
        inserted: (result?.inserted || []) as Slide[],
        duplicateIds: (result?.duplicateIds || []) as string[],
      }
    } catch (error: any) {
      console.error('Error batch creating slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to create slides',
        description: error.message,
        color: 'red',
      })
      return emptyResult
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a single slide online
   */
  const updateSlide = async (slide: Slide): Promise<Slide | null> => {
    if (!online.value) {
      console.warn('Cannot update slide while offline')
      return null
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id || !slide._id) {
        throw new Error('Missing schedule or slide ID')
      }

      const churchId = getChurchId()
      if (!churchId) {
        throw new Error('No church ID available')
      }

      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/${slide._id}`,
        {
          method: 'PUT',
          body: slide,
          key: `update-slide-${slide._id}`,
        }
      )

      if (error.value) {
        if (isNotFoundError(error.value)) {
          removeStaleSlide(slide._id || slide.id)
          return null
        }
        if (isForbiddenError(error.value)) {
          showForbiddenToast()
          return null
        }
        throw new Error(getAPIErrorMessage(error.value, 'Failed to update slide'))
      }

      appStore.setLastSynced(new Date().toISOString())
      return data.value as Slide
    } catch (error: any) {
      console.error('Error updating slide:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Batch update slides online
   */
  const batchUpdateSlides = async (slides: Slide[]): Promise<Slide[]> => {
    if (!online.value) {
      console.warn('Cannot batch update slides while offline')
      return []
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        throw new Error('No active schedule found')
      }

      const churchId = getChurchId()
      if (!churchId) {
        throw new Error('No church ID available')
      }

      loading.value = true
      // appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/batch`,
        {
          method: 'PUT',
          body: slides,
          key: 'batch-update-slides',
          dedupe: 'defer',
        }
      )

      if (error.value) {
        if (isForbiddenError(error.value)) {
          showForbiddenToast()
          return []
        }
        throw new Error(getAPIErrorMessage(error.value, 'Failed to update slides'))
      }

      appStore.setLastSynced(new Date().toISOString())
      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error batch updating slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to update slides',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
      // appStore.setSlidesLoading(false)
    }
  }

  /**
   * Delete a slide online
   */
  const deleteSlide = async (slide: Slide): Promise<boolean> => {
    if (!online.value) {
      console.warn('Cannot delete slide while offline')
      return false
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id || !slide._id) {
        return false
      }

      const churchId = getChurchId()
      if (!churchId) {
        return false
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/${slide._id}`,
        {
          method: 'DELETE',
          key: `delete-slide-${slide._id}`,
        }
      )

      if (error.value) {
        if (isNotFoundError(error.value)) {
          removeStaleSlide(slide._id || slide.id)
          return true
        }
        if (isForbiddenError(error.value)) {
          showForbiddenToast()
          return false
        }
        throw new Error(getAPIErrorMessage(error.value, 'Failed to delete slide'))
      }

      appStore.setLastSynced(new Date().toISOString())
      return true
    } catch (error: any) {
      console.error('Error deleting slide:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete slide',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Batch delete slides online
   */
  const batchDeleteSlides = async (slideIds: string[]): Promise<boolean> => {
    if (!online.value) {
      console.warn('Cannot batch delete slides while offline')
      return false
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        throw new Error('No active schedule found')
      }

      const churchId = getChurchId()
      if (!churchId) {
        throw new Error('No church ID available')
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/batch`,
        {
          method: 'DELETE',
          body: { slideIds },
          key: 'batch-delete-slides',
        }
      )

      if (error.value) {
        if (isForbiddenError(error.value)) {
          showForbiddenToast()
          return false
        }
        throw new Error(getAPIErrorMessage(error.value, 'Failed to delete slides'))
      }

      appStore.setLastSynced(new Date().toISOString())
      toast.add({
        icon: 'i-tabler-trash',
        title: `${slideIds.length} slide(s) deleted successfully`,
      })
      return true
    } catch (error: any) {
      console.error('Error batch deleting slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete slides',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Save a slide to the saved slides collection
   */
  const saveSlideOnline = async (slide: Slide): Promise<boolean> => {
    if (!online.value) {
      console.warn('Cannot save slide while offline')
      return false
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id || !slide._id) {
        return false
      }

      const churchId = getChurchId()
      if (!churchId) {
        return false
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/${slide._id}/save`,
        {
          method: 'PUT',
          // Send the full slide so the backend can recreate it if it was deleted
          body: slide,
          key: `save-slide-${slide._id}`,
        }
      )

      return true
    } catch (error: any) {
      console.error('Error saving slide online:', error)
      return false
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Unsave a slide from the saved slides collection
   */
  const unsaveSlideOnline = async (slideId: string): Promise<boolean> => {
    if (!online.value) {
      console.warn('Cannot unsave slide while offline')
      return false
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        return false
      }

      const churchId = getChurchId()
      if (!churchId) {
        return false
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/${slideId}/unsave`,
        {
          method: 'PUT',
          key: `unsave-slide-${slideId}`,
        }
      )

      return true
    } catch (error: any) {
      console.error('Error unsaving slide online:', error)
      return false
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
    }
  }

  return {
    slides,
    loading,
    updateLiveOutput,
    fetchScheduleSlides,
    fetchSavedSlides,
    createSlide,
    batchCreateSlides,
    updateSlide,
    batchUpdateSlides,
    deleteSlide,
    batchDeleteSlides,
    saveSlideOnline,
    unsaveSlideOnline,
  }
}
