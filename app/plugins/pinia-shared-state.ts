import { BroadcastChannel } from "broadcast-channel"
import { synchronizeStore, type SharedStateMessage } from "~/utils/sharedStateSync"

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia as any
  pinia.use(({ store, options }: any) => {
    if (options?.share?.enable === false) return
    const channel = new BroadcastChannel<SharedStateMessage | undefined>(store.$id)
    const stop = synchronizeStore(store, channel, options?.share)
    const originalDispose = store.$dispose.bind(store)
    store.$dispose = () => {
      stop()
      void channel.close()
      originalDispose()
    }
  })
})
