import type { Slide } from "~/types"
import { isSessionMediaUrl } from "~/utils/mediaTransport"

export const LIVE_CHANNEL_NAME = "cow-live-channel"

// Reuse single BroadcastChannel instance to prevent memory leaks.
let bcInstance: BroadcastChannel | null = null

export type LiveBroadcastEnvelope<T = unknown> = {
  id: string
  ts: number
  payload: T
}

export type SlideOverlayBroadcast = {
  action: "show-slide-overlay" | "remove-slide-overlay"
  slide: Slide | null
}

const messageId = () =>
  crypto.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

// Desktop windows are separate webviews, and BroadcastChannel is not guaranteed
// to cross them the way it crosses browser tabs. Mirror every message over
// Tauri's own event bus, which is process-wide by definition. The receiver
// de-duplicates on the envelope id, so the doubled delivery is invisible.
const mirrorToTauriWindows = async (serialized: string) => {
  try {
    const { emit } = await import("@tauri-apps/api/event")
    await emit(LIVE_CHANNEL_NAME, serialized)
  } catch (error) {
    console.warn("Failed to mirror live broadcast to desktop windows:", error)
  }
}

const useBroadcastPost = <T>(payload: T) => {
  if (!bcInstance) {
    bcInstance = new BroadcastChannel(LIVE_CHANNEL_NAME)
  }

  const message: LiveBroadcastEnvelope<T> = {
    id: messageId(),
    ts: Date.now(),
    payload,
  }

  // Slides can contain Vue/Pinia reactive proxies, which the structured-clone
  // algorithm rejects with DataCloneError. Serialize the complete envelope
  // once to strip those proxies. The receiver parses it once, avoiding the old
  // payload-plus-envelope double serialization while remaining reliable.
  const serialized = JSON.stringify(message, (key, value) => {
    if (key === "blob") return undefined
    return isSessionMediaUrl(value) ? "" : value
  })

  bcInstance.postMessage(serialized)

  const { isTauri } = useTauri()
  if (isTauri) {
    mirrorToTauriWindows(serialized)
  }
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
