import type { Slide } from "~/types"
import { isSessionMediaUrl } from "~/utils/mediaTransport"
import { useLiveProjectionRepository } from "~/composables/useLiveProjectionRepository"

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

export type LiveSlideChangedNotification = {
  kind: "live-slide-changed"
  revision: string
  slideId: string | null
}

export const isLiveSlideChangedNotification = (
  payload: unknown
): payload is LiveSlideChangedNotification =>
  !!payload &&
  typeof payload === "object" &&
  (payload as LiveSlideChangedNotification).kind === "live-slide-changed" &&
  typeof (payload as LiveSlideChangedNotification).revision === "string"

export const resolveLiveSlideBroadcast = async (payload: unknown) => {
  if (!isLiveSlideChangedNotification(payload)) {
    return {
      matched: payload === null || isSlidePayload(payload),
      slide: (payload === null || isSlidePayload(payload)
        ? payload
        : null) as Slide | null,
    }
  }

  const record = await useLiveProjectionRepository().getCurrent()
  if (!record || record.revision !== payload.revision) {
    return { matched: false, slide: null as Slide | null }
  }
  return { matched: true, slide: record.slide }
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

const postEnvelope = <T>(
  payload: T,
  envelopeId = messageId(),
  timestamp = Date.now()
) => {
  if (!bcInstance) {
    bcInstance = new BroadcastChannel(LIVE_CHANNEL_NAME)
  }

  const message: LiveBroadcastEnvelope<T> = {
    id: envelopeId,
    ts: timestamp,
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

/** Send a small non-slide message over the shared browser and Tauri transport. */
export const postCrossWindowNotification = <T>(payload: T) => {
  postEnvelope(payload)
}

const isSlidePayload = (payload: unknown): payload is Slide =>
  !!payload &&
  typeof payload === "object" &&
  typeof (payload as Slide).id === "string" &&
  typeof (payload as Slide).scheduleId === "string"

let liveProjectionWriteTail: Promise<void> = Promise.resolve()

const useBroadcastPost = <T>(payload: T) => {
  // Overlay messages are already small and do not represent the primary live
  // slide, so they stay on the direct channel.
  if (payload !== null && !isSlidePayload(payload)) {
    postCrossWindowNotification(payload)
    return
  }

  const slide = (payload === null ? null : payload) as Slide | null
  const revision = messageId()
  const timestamp = Date.now()

  // Writes and notifications are ordered. The notification is posted only
  // after its record is committed, so a secondary window never wakes up before
  // the projected state is readable. On an IndexedDB failure, send the legacy
  // full payload so projection remains available during the cutover.
  liveProjectionWriteTail = liveProjectionWriteTail
    .catch((error) => {
      console.warn("Previous live projection broadcast failed:", error)
    })
    .then(async () => {
      try {
        await useLiveProjectionRepository().putCurrent(
          slide,
          revision,
          timestamp
        )
        postEnvelope<LiveSlideChangedNotification>(
          {
            kind: "live-slide-changed",
            revision,
            slideId: slide?.id || null,
          },
          revision,
          timestamp
        )
      } catch (error) {
        console.warn(
          "Unable to persist live projection, sending legacy payload:",
          error
        )
        postEnvelope(slide, revision, timestamp)
      }
    })
}

export const flushLiveProjectionBroadcasts = async () => {
  await liveProjectionWriteTail
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
