import { BroadcastChannel } from "broadcast-channel"
import { sharedStateSerializer } from '~/utils/sharedStateSerializer'
import { mergeSharedStateValue } from "~/utils/sharedStateMerge"

type SharedStateMessage = {
  timestamp: number
  state: Record<string, unknown>
}

let timestampSequence = 0
const nextTimestamp = () => Date.now() * 1000 + (timestampSequence++ % 1000)

export default defineNuxtPlugin(nuxtApp => {
  const pinia = nuxtApp.$pinia as any

  pinia.use(({ store, options }: any) => {
    if (options?.share?.enable === false) return

    const omittedKeys = options?.share?.omit || []
    const keysToUpdate = Object.keys(store.$state).filter(
      (key) => !omittedKeys.includes(key)
    )
    const channel = new BroadcastChannel(store.$id)
    let latestTimestamp = 0
    let applyingExternalUpdate = false

    const serializedState = () =>
      sharedStateSerializer.deserialize(
        sharedStateSerializer.serialize(store.$state)
      ) as Record<string, unknown>

    channel.onmessage = (message?: SharedStateMessage) => {
      if (!message) {
        const timestamp = nextTimestamp()
        latestTimestamp = Math.max(latestTimestamp, timestamp)
        void channel.postMessage({ timestamp, state: serializedState() })
        return
      }
      if (message.timestamp <= latestTimestamp) return

      applyingExternalUpdate = true
      latestTimestamp = message.timestamp
      store.$patch((state: Record<string, unknown>) => {
        keysToUpdate.forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(message.state, key)) return
          state[key] = mergeSharedStateValue(state[key], message.state[key])
        })
      })
    }

    if (options?.share?.initialize !== false) {
      void channel.postMessage(undefined)
    }

    store.$subscribe((_: unknown, state: Record<string, unknown>) => {
      if (applyingExternalUpdate) {
        applyingExternalUpdate = false
        return
      }
      const timestamp = nextTimestamp()
      latestTimestamp = timestamp
      const serialized = sharedStateSerializer.deserialize(
        sharedStateSerializer.serialize(state)
      )
      void channel.postMessage({ timestamp, state: serialized })
    })

    const originalDispose = store.$dispose.bind(store)
    store.$dispose = () => {
      void channel.close()
      originalDispose()
    }
  })
})
