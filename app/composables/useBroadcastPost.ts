import type { Slide } from "~/types"

// Reuse single BroadcastChannel instance to prevent memory leaks.
let bcInstance: BroadcastChannel | null = null

export type LiveBroadcastEnvelope<T = unknown> = {
  ts: number
  payload: T
}

export type SlideOverlayBroadcast = {
  action: "show-slide-overlay" | "remove-slide-overlay"
  slide: Slide | null
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

export const useBroadcastOverlayPost = (
  action: string,
  slide: Slide | null = null
) => {
  if (
    action !== "show-slide-overlay" &&
    action !== "remove-slide-overlay"
  ) {
    return
  }
  useBroadcastPost<SlideOverlayBroadcast>({ action, slide })
}

export default useBroadcastPost
