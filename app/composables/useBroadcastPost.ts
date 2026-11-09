import type { LivePayload, Slide } from "~/types"
import { isSessionMediaUrl } from "~/utils/mediaTransport"
import { useLiveProjectionRepository } from "~/composables/useLiveProjectionRepository"
import { isPairPayload, primaryLiveSlide } from "~/utils/slidePairs"

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

/**
 * No longer sent: the live slide now travels in the message itself (see
 * useBroadcastPost). Still understood, so a window on an older bundle during a
 * hot update keeps working.
 */
export type LiveSlideChangedNotification = {
  kind: "live-slide-changed"
  revision: string
  /** The live slide, or a live pair's active member. */
  slideId: string | null
  /** Every slide on screen; more than one while a slide pair is live. */
  slideIds?: string[]
}

export const isLiveSlideChangedNotification = (
  payload: unknown
): payload is LiveSlideChangedNotification =>
  !!payload &&
  typeof payload === "object" &&
  (payload as LiveSlideChangedNotification).kind === "live-slide-changed" &&
  typeof (payload as LiveSlideChangedNotification).revision === "string"

/**
 * What a live-slide message puts on screen. `payload` is the whole thing: one
 * slide, a slide pair's members, or null. `slide` is the one a single-slide
 * reader follows, which for a pair is its active member, so the stage display
 * keeps treating the slide the operator is driving as NOW.
 */
export const resolveLiveSlideBroadcast = async (payload: unknown) => {
  if (!isLiveSlideChangedNotification(payload)) {
    const matched = payload === null || isLivePayload(payload)
    const live = (matched ? payload : null) as LivePayload
    return { matched, payload: live, slide: primaryLiveSlide(live) }
  }

  const record = await useLiveProjectionRepository().getCurrent()
  if (!record || record.revision !== payload.revision) {
    return { matched: false, payload: null as LivePayload, slide: null as Slide | null }
  }
  const live: LivePayload = record.slides?.length ? record.slides : record.slide
  return { matched: true, payload: live, slide: record.slide }
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

/** One slide, or the members of a slide pair. */
const isLivePayload = (payload: unknown): payload is Slide | Slide[] =>
  isPairPayload(payload)
    ? (payload as unknown[]).every(isSlidePayload)
    : isSlidePayload(payload)

/**
 * The newest live state still to be written for windows that open later (a
 * reloaded /live, the stage display). Only the newest matters, so a write that
 * has not started yet is replaced rather than queued behind it.
 */
type PendingProjection = { live: LivePayload; revision: string; timestamp: number }
let pendingProjection: PendingProjection | null = null
let projectionWriter: Promise<void> | null = null

const writePendingProjections = async () => {
  while (pendingProjection) {
    const { live, revision, timestamp } = pendingProjection
    pendingProjection = null
    try {
      await useLiveProjectionRepository().putCurrent(live, revision, timestamp)
    } catch (error) {
      console.warn("Unable to persist live projection:", error)
    }
  }
}

const persistLiveProjection = (projection: PendingProjection) => {
  pendingProjection = projection
  if (!projectionWriter) {
    projectionWriter = writePendingProjections().finally(() => {
      projectionWriter = null
    })
  }
}

const useBroadcastPost = <T>(payload: T) => {
  // Overlay messages are already small and do not represent the primary live
  // slide, so they stay on the direct channel.
  if (payload !== null && !isLivePayload(payload)) {
    postCrossWindowNotification(payload)
    return
  }

  const live = payload as LivePayload
  const revision = messageId()
  const timestamp = Date.now()

  // The slide itself goes out now. It used to wait for its IndexedDB record to
  // commit and send only a notice, which every window then read back from
  // IndexedDB: two database round trips before the projector moved. While the
  // database was busy (a large video being saved, say) a go-live or a
  // play/pause took seconds to reach the screen. Session-only media links are
  // blanked on the wire; each window resolves its own local copy.
  postEnvelope(live, revision, timestamp)

  // The record is for windows that open later, so it no longer holds up the
  // ones already open.
  persistLiveProjection({ live, revision, timestamp })
}

/** Resolves once the newest live state is in IndexedDB. */
export const flushLiveProjectionBroadcasts = async () => {
  while (projectionWriter) await projectionWriter
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
