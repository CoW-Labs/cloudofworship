import { BroadcastChannel } from "broadcast-channel"
import { synchronizeStore, type SharedStateMessage } from "~/utils/sharedStateSync"

/**
 * The `02.` prefix is load-bearing, not cosmetic. Nuxt loads app plugins in
 * filename order, and Pinia applies a plugin only to stores created after
 * `pinia.use()` — never retroactively. Any plugin that resolves a store before
 * this one runs therefore opts that store out of cross-window sharing for the
 * life of the tab, with no error anywhere: alerts and settings simply stop
 * reaching the /live and /stage windows. Loading first among app plugins closes
 * that race. `enforce: "pre"` cannot be used instead — it would order this
 * ahead of the Pinia module plugin itself, leaving `nuxtApp.$pinia` undefined.
 */
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
