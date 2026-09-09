import { persistAppState } from "~/utils/appStatePersistence"

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
