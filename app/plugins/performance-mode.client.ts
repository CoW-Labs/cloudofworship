import { watch } from "vue"
import { useAppStore } from "~/store/app"

/**
 * Puts `cow-reduce-effects` on <html> while the "Reduce visual effects"
 * performance setting is on, so stylesheets can switch off frosted glass
 * (backdrop filters re-blur everything behind them on every frame).
 *
 * Each window runs this on its own: the setting travels between windows with
 * the rest of the store, so the projector follows the operator's choice.
 *
 * Costs one boolean watch per window and nothing while the setting is off.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    // Resolved after mount, never at plugin setup: creating the store before
    // `pinia-shared-state` registers its Pinia plugin would stop the operator
    // and projection windows sharing state.
    const appStore = useAppStore()
    watch(
      () => appStore.currentState.settings.reduceEffects === true,
      (on) => document.documentElement.classList.toggle("cow-reduce-effects", on),
      { immediate: true }
    )
  })
})
