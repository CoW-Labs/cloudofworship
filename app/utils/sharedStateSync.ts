import { watch } from "vue"
import { sharedStateSerializer, NEVER_BROADCAST } from "./sharedStateSerializer"
import { mergeSharedStateValue } from "./sharedStateMerge"

export type SharedStateMessage = {
  timestamp: number
  state: Record<string, unknown>
}

type SharedStore = {
  $state: Record<string, any>
  $patch: (patch: (state: Record<string, any>) => void) => void
}

type SharedChannel = {
  onmessage: ((message?: SharedStateMessage) => void) | null
  postMessage: (message?: SharedStateMessage) => unknown
}

let sequence = 0
const nextTimestamp = () => Date.now() * 1000 + (sequence++ % 1000)

export function synchronizeStore(
  store: SharedStore,
  channel: SharedChannel,
  options: { omit?: string[]; initialize?: boolean } = {}
) {
  const omitted = new Set([...NEVER_BROADCAST, ...(options.omit || [])])
  const serialize = () => sharedStateSerializer.serialize(Object.fromEntries(
    Object.keys(store.$state)
      .filter((key) => !omitted.has(key))
      .map((key) => [key, store.$state[key]])
  ))
  let latestTimestamp = 0
  let acceptedSnapshot = serialize()

  // Watch the serialized projection, not the complete store. The serializer
  // skips activeSlides before descending into it, so Vue never traverses the
  // corpus or undo history to track their nested dependencies.
  const stop = watch(serialize, (snapshot) => {
    if (snapshot === acceptedSnapshot) return
    acceptedSnapshot = snapshot
    latestTimestamp = Math.max(nextTimestamp(), latestTimestamp + 1)
    void channel.postMessage({
      timestamp: latestTimestamp,
      state: sharedStateSerializer.deserialize(snapshot),
    })
  })

  channel.onmessage = (message) => {
    if (!message) {
      latestTimestamp = Math.max(latestTimestamp, nextTimestamp())
      void channel.postMessage({
        timestamp: latestTimestamp,
        state: sharedStateSerializer.deserialize(serialize()),
      })
      return
    }
    if (message.timestamp <= latestTimestamp) return
    latestTimestamp = message.timestamp
    store.$patch((state) => {
      Object.keys(state).filter((key) => !omitted.has(key)).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(message.state, key)) {
          state[key] = mergeSharedStateValue(state[key], message.state[key])
        }
      })
    })
    // Suppress only this exact external snapshot. A local change before the
    // queued watcher runs still broadcasts, even after a no-op remote patch.
    acceptedSnapshot = serialize()
  }

  if (options.initialize !== false) void channel.postMessage(undefined)
  return () => {
    stop()
    channel.onmessage = null
  }
}
