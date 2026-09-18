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
  // `$state` is undefined once the store is disposed — see the note in the
  // patch below. An empty snapshot is the honest answer for a store that no
  // longer exists, and it keeps the watcher and the post-patch re-read from
  // throwing on the way out.
  const serialize = () => sharedStateSerializer.serialize(Object.fromEntries(
    Object.keys(store.$state || {})
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
    // Another window wrote this; nothing guarantees its shape. A payload
    // without a state object has nothing to merge, and reading keys off it
    // throws before the first one is applied.
    if (!message.state || typeof message.state !== "object") return
    latestTimestamp = message.timestamp
    store.$patch((state) => {
      // Pinia hands back whatever `pinia.state.value[$id]` holds, which is
      // gone once the store has been disposed. `broadcast-channel` delivers a
      // queued batch in one pass (a single `forEach` over the pending
      // messages), so a store torn down partway through that pass still
      // receives the rest of the batch — and `Object.keys(undefined)` threw
      // "Cannot convert undefined or null to object" from inside this
      // callback, 45 times in one session on /stage. A disposed store has no
      // state left to merge into, so there is nothing to do but stop.
      if (!state) return
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
