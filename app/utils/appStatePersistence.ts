import { watch } from "vue"
import { appStateSerializer } from "./appStateSerializer"

/** Preserve the existing `app` storage format without a deep Pinia subscription. */
export function persistAppState(
  store: { $state: Record<string, any>; $patch: (patch: Record<string, any>) => void },
  storage: Pick<Storage, "getItem" | "setItem">
) {
  try {
    const saved = storage.getItem("app")
    if (saved) {
      const snapshot = appStateSerializer.deserialize(saved)
      const patch: Record<string, any> = {}
      for (const key of ["currentState", "panelSizes", "panelSizesTouched"]) {
        if (snapshot?.[key] !== undefined) patch[key] = snapshot[key]
      }
      // Legacy activeSlides remain available for the existing IndexedDB migration.
      store.$patch(patch)
    }
  } catch (error) {
    console.warn("Could not restore app settings:", error)
  }
  if (!Array.isArray(store.$state.currentState.activeSlides)) {
    store.$state.currentState.activeSlides = []
  }

  const serialize = () => appStateSerializer.serialize({
    currentState: store.$state.currentState,
    panelSizes: store.$state.panelSizes,
    panelSizesTouched: store.$state.panelSizesTouched,
  })
  const save = (snapshot: string) => {
    try { storage.setItem("app", snapshot) }
    catch (error) { console.warn("Could not persist app settings:", error) }
  }
  const stop = watch(serialize, save)
  return { stop, flush: () => save(serialize()) }
}
