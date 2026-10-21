import { useAppStore } from "~/store/app"
import { slideTypes } from "~/utils/constants"

/** Operator side: whether a camera slide is on the projector right now. */
const useCameraOnAir = () => {
  const appStore = useAppStore()
  return computed(() => {
    // Every slide pair holds a camera.
    if (appStore.currentState.livePairId) return true
    const id = appStore.currentState.liveSlideId
    if (!id) return false
    return (
      appStore.activeSlides.find((slide) => slide.id === id)?.type ===
      slideTypes.camera
    )
  })
}

export default useCameraOnAir
