import { useDebounceFn } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide } from "~/types"

export default function useSlides() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const churchId = authStore.church?._id
  const slides = ref<Array<Slide>>(appStore.currentState.activeSlides || [])

  const updateLiveOutput = (updatedSlide: Slide, options?: { forceGoLive: boolean }) => {
    appStore.replaceScheduleActiveSlides(slides.value || [])

    // If the current slide in the live output/slide schedule is being edited, then update LiveOutput immediately
    if (updatedSlide.id === appStore.currentState.liveSlideId || options?.forceGoLive) {
      appStore.setLiveSlide(updatedSlide.id)
      // useDebounceFn(useBroadcastPost, 100)(JSON.stringify(updatedSlide))
      useBroadcastPost(JSON.stringify(updatedSlide))
    }
  }

  const fetchSavedSlides = async () => {
    try {
      const activeSchedule = appStore.currentState.activeSchedule
      appStore.setSlidesLoading(true)
      const { data } = await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule?._id}/slides/saved`,
        {
          method: "GET",
          key: "get-saved-slides",
        }
      )
      return data.value as Slide[]
    } catch (error) {
      console.error("Error getting saved slides:", error)
    } finally {
      appStore.setSlidesLoading(false)
    }
  }

  const saveSlideOnline = async (slide: Slide) => {
    try {
      const activeSchedule = appStore.currentState.activeSchedule
      appStore.setSlidesLoading(true)
      await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule?._id}/slides/${slide._id}/save`,
        {
          method: "PUT",
          key: "save-slides",
        }
      )
    } catch (error) {
      console.error("Error saving slide online:", error)
    } finally {
      appStore.setSlidesLoading(false)
    }
  }

  const unsaveSlideOnline = async (slideId: string) => {
    try {
      const activeSchedule = appStore.currentState.activeSchedule
      appStore.setSlidesLoading(true)
      await useAPIFetch(
        `/church/${churchId}/schedules/${activeSchedule?._id}/slides/${slideId}/unsave`,
        {
          method: "PUT",
          key: "unsave-slides",
        }
      )
    } catch (error) {
      console.error("Error unsaving slide online:", error)
    } finally {
      appStore.setSlidesLoading(false)
    }
  }

  return {
    slides,
    updateLiveOutput,
    fetchSavedSlides,
    saveSlideOnline,
    unsaveSlideOnline
  }
}