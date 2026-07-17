// Reuse single BroadcastChannel instance to prevent memory leaks.
let bcInstance: BroadcastChannel | null = null

export type LiveBroadcastEnvelope<T = unknown> = {
  ts: number
  payload: T
}

const useBroadcastPost = <T>(payload: T) => {
  if (!bcInstance) {
    bcInstance = new BroadcastChannel("cow-live-channel")
  }

  const message: LiveBroadcastEnvelope<T> = {
    ts: Date.now(),
    payload,
  }

  // Slides can contain Vue/Pinia reactive proxies, which the structured-clone
  // algorithm rejects with DataCloneError. Serialize the complete envelope
  // once to strip those proxies. The receiver parses it once, avoiding the old
  // payload-plus-envelope double serialization while remaining reliable.
  bcInstance.postMessage(JSON.stringify(message))
}

export default useBroadcastPost
