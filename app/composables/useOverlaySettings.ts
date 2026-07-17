import type { OverlayPosition, OverlaySettings, Slide } from "~/types"
import { useAppStore } from "~/store/app"

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  position: "bottom-left",
  scale: 100,
}

const clampOverlayScale = (scale?: number) =>
  Math.min(200, Math.max(50, Number(scale) || DEFAULT_OVERLAY_SETTINGS.scale))

export const useOverlaySettings = () => {
  const appStore = useAppStore()

  const overlaySettings = computed<OverlaySettings>(() => ({
    position:
      appStore.currentState.settings.overlaySettings?.position ||
      DEFAULT_OVERLAY_SETTINGS.position,
    scale: clampOverlayScale(
      appStore.currentState.settings.overlaySettings?.scale
    ),
  }))

  const applyOverlaySettings = (slide: Slide): Slide => ({
    ...slide,
    slideStyle: {
      ...slide.slideStyle,
      overlayPlacement: overlaySettings.value.position,
      overlayScale: overlaySettings.value.scale,
    },
  })

  const getOverlaySettingsForSlide = (slide?: Slide | null): OverlaySettings => {
    const savedSettings = appStore.currentState.settings.overlaySettings
    return {
      position:
        savedSettings?.position ||
        slide?.slideStyle?.overlayPlacement ||
        DEFAULT_OVERLAY_SETTINGS.position,
      scale: clampOverlayScale(
        savedSettings?.scale ?? slide?.slideStyle?.overlayScale
      ),
    }
  }

  const setOverlaySettings = (
    updates: Partial<{ position: OverlayPosition; scale: number }>
  ) => {
    appStore.setOverlaySettings({
      ...overlaySettings.value,
      ...updates,
      scale: clampOverlayScale(updates.scale ?? overlaySettings.value.scale),
    })
  }

  return {
    overlaySettings,
    applyOverlaySettings,
    getOverlaySettingsForSlide,
    setOverlaySettings,
  }
}
