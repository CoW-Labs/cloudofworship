import { persistAppState } from "~/utils/appStatePersistence"

/**
 * Numbered for the same reason as `02.pinia-shared-state.ts`: a store created
 * before this plugin registers never gets persistence, silently. Stays ahead of
 * it so a hydrating store is restored before its state is broadcast.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia as any
  pinia.use(({ store }: any) => {
    if (store.$id !== "app") return
    const persistence = persistAppState(store, window.localStorage)
    window.addEventListener("pagehide", persistence.flush)
    const originalDispose = store.$dispose.bind(store)
    store.$dispose = () => {
      persistence.flush()
      persistence.stop()
      window.removeEventListener("pagehide", persistence.flush)
      originalDispose()
    }
  })
})
