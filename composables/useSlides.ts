import { useDebounceFn } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"

export default function useSlides() {
  const appStore = useAppStore()
  const slides = ref<Array<Slide>>(appStore.currentState.activeSlides || [])

  const updateLiveOutput = (updatedSlide: Slide) => {
    appStore.replaceScheduleActiveSlides(slides.value || [])

    // If the current slide in the live output/slide schedule is being edited, then update LiveOutput immediately
    if (updatedSlide.id === appStore.currentState.liveSlideId) {
      appStore.setLiveSlide(updatedSlide.id)
      useDebounceFn(useBroadcastPost, 100)(JSON.stringify(updatedSlide))
    }
  }

  return {
    slides,
    updateLiveOutput
  }
}