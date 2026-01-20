import { useDebounceFn, useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide } from "~/types"

export default function useSlides() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const online = useOnline()
  const churchId = authStore.church?._id
  const slides = ref<Array<Slide>>(appStore.currentState.activeSlides || [])
  const loading = ref<boolean>(false)

  const updateLiveOutput = (updatedSlide: Slide, options?: { forceGoLive: boolean }) => {
    appStore.replaceScheduleActiveSlides(slides.value || [])

    // If the current slide in the live output/slide schedule is being edited, then update LiveOutput immediately
    if (updatedSlide.id === appStore.currentState.liveSlideId || options?.forceGoLive) {
      appStore.setLiveSlide(updatedSlide.id)
      useBroadcastPost(JSON.stringify(updatedSlide))
    }
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
        throw new Error(error.value?.message || 'Failed to fetch slides')
      }

      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error fetching schedule slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch slides',
        description: error.message,
        color: 'red',
      })
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
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch saved slides',
        description: error.message,
        color: 'red',
      })
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

      loading.value = true
      appStore.setSlidesLoading(true)

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
      appStore.setSlidesLoading(false)
    }
  }

  /**
   * Batch create slides online
   */
  const batchCreateSlides = async (slides: Slide[]): Promise<Slide[]> => {
    if (!online.value) {
      console.warn('Cannot batch create slides while offline')
      return []
    }

    try {
      const activeSchedule = appStore.currentState.activeSchedule

      if (!activeSchedule?._id) {
        throw new Error('No active schedule found')
      }

      loading.value = true
      appStore.setSlidesLoading(true)

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/batch`,
        {
          method: 'POST',
          body: slides,
          key: 'batch-create-slides',
          dedupe: 'defer',
        }
      )

      if (error.value) {
        // Return partial success data if available
        if (error.value?.data?.data) {
          return error.value.data.data as Slide[]
        }
        throw new Error(error.value?.message || 'Failed to create slides')
      }

      appStore.setLastSynced(new Date().toISOString())
      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error batch creating slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to create slides',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
      appStore.setSlidesLoading(false)
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
        throw new Error(error.value?.message || 'Failed to update slide')
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

      loading.value = true
      appStore.setSlidesLoading(true)

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
        throw new Error(error.value?.message || 'Failed to update slides')
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
      appStore.setSlidesLoading(false)
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
        throw new Error(error.value?.message || 'Failed to delete slide')
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
        throw new Error(error.value?.message || 'Failed to delete slides')
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

      loading.value = true
      appStore.setSlidesLoading(true)

      await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule._id}/slides/${slide._id}/save`,
        {
          method: 'PUT',
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