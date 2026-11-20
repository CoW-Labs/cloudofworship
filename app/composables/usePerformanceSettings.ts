import { computed } from "vue"
import { useAppStore } from "~/store/app"
import {
  LITE_PRESET,
  isLiteMode,
  resolveDevicePerformance,
  type DevicePerformanceSettings,
} from "~/utils/performanceSettings"

/**
 * Reactive view of this computer's performance settings, for components.
 * Plain modules (camera streams, camera sharing) read the same values with
 * `currentPerformanceSettings()`.
 */
export const usePerformanceSettings = () => {
  const appStore = useAppStore()

  const settings = computed(() =>
    resolveDevicePerformance(appStore.currentState.settings)
  )
  const lite = computed(() => isLiteMode(settings.value))

  const update = (patch: Partial<DevicePerformanceSettings>) => {
    appStore.setAppSettings({ ...appStore.currentState.settings, ...patch })
  }

  /** Lite mode off puts every setting it controls back to its default. */
  const setLite = (on: boolean) =>
    update(
      on
        ? { ...LITE_PRESET }
        : { reduceEffects: false, stillPreviewVideo: false, cameraResolution: "auto" }
    )

  return { settings, lite, update, setLite }
}

/**
 * The current values outside a component or a reactive context. Falls back to
 * the defaults when Pinia is not up yet, so a camera opening very early still
 * works.
 */
export const currentPerformanceSettings = (): DevicePerformanceSettings => {
  try {
    return resolveDevicePerformance(useAppStore().currentState.settings)
  } catch {
    return resolveDevicePerformance(undefined)
  }
}
