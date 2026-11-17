import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { PendingUpload, Slide } from "~/types"
import { tabSessionId } from "~/composables/useRealtimeSlides"
import { toSocketSafeSlide } from "~/utils/mediaTransport"
import { applyPendingState } from "~/composables/usePendingSlideState"
import useSlideUploadProgress from "~/composables/useSlideUploadProgress"

/**
 * The creator's side of sharing a slide before its files have finished
 * uploading.
 *
 * A media or presentation slide goes to teammates the moment it is made, as a
 * placeholder (`pendingUpload.state === "uploading"`) with no media URLs. While
 * the files go to the cloud the percentage is sent on its own light event, and
 * when the upload ends the slide is sent again as `update-slide` carrying the
 * outcome: `pendingUpload: null` when every file reached the cloud, or
 * `device-only` when some could not (offline, storage full, video upload
 * switched off). `uploadSettled` marks that update, so a teammate who missed
 * the placeholder can still add the slide.
 *
 * Every send drops when the socket is down instead of queueing: a queued
 * progress tick replayed after a reconnect is a stale percentage.
 */

/**
 * At most one progress event per slide per interval, plus the final one. A bar
 * that moves every couple of seconds reads the same to a teammate as one that
 * moves every second, and a large video would otherwise send hundreds.
 */
const PROGRESS_EMIT_INTERVAL_MS = 2000

/** Well inside UPLOAD_STALE_AFTER_MS, so a slow upload never reads as quiet. */
const PROGRESS_HEARTBEAT_MS = 15_000

const lastProgressEmit = new Map<string, number>()
const lastProgressPercent = new Map<string, number>()

const liveSocket = () => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null
  const socket = useNuxtApp().$socketio as any
  return socket?.connected ? socket : null
}

export const currentUploadOwner = (): Pick<PendingUpload, "ownerId" | "ownerName"> => {
  const authStore = useAuthStore()
  return {
    ownerId: authStore.user?._id ?? "",
    ownerName: authStore.user?.fullname || "A teammate",
  }
}

/** Marks a freshly built slide as uploading. The caller broadcasts it. */
export const markUploading = (slide: Slide): Slide => {
  slide.pendingUpload = { state: "uploading", ...currentUploadOwner() }
  return slide
}

/** Sends the placeholders: one `create-slide`, or one `batch-create-slides`. */
export const broadcastPendingSlides = async (slides: Slide[]) => {
  const pending = slides.filter((slide) => slide.pendingUpload)
  if (!pending.length || !liveSocket()) return
  try {
    const safe = await Promise.all(pending.map((s) => toSocketSafeSlide(s)))
    // Reading IndexedDB took a moment; the socket may have gone in the meantime.
    const socket = liveSocket()
    if (!socket) return
    if (safe.length === 1) {
      socket.emit("create-slide", { ...safe[0], tabId: tabSessionId })
    } else {
      socket.emit("batch-create-slides", { slides: safe, tabId: tabSessionId })
    }
  } catch (err) {
    console.warn("Could not share the pending slides with teammates:", err)
  }
}

/**
 * Records progress for one slide, here and (throttled) for teammates.
 * `fraction` is 0..1. Pass `force` for the value that must not be skipped.
 */
export const reportUploadProgress = (
  slideId: string,
  fraction: number,
  force = false
) => {
  const { setUploadProgress } = useSlideUploadProgress()
  setUploadProgress(slideId, fraction)
  if (!Number.isFinite(fraction)) return

  const now = Date.now()
  const last = lastProgressEmit.get(slideId) ?? 0
  const percent = Math.round(fraction * 100)
  if (!force && fraction < 1) {
    if (now - last < PROGRESS_EMIT_INTERVAL_MS) return
    // The same whole percent is nothing new to show, but a big file on a slow
    // line can sit on one percent for minutes. Teammates read silence as a
    // closed laptop (see UPLOAD_STALE_AFTER_MS), so still say "alive" now and
    // then.
    if (
      lastProgressPercent.get(slideId) === percent &&
      now - last < PROGRESS_HEARTBEAT_MS
    ) {
      return
    }
  }

  const socket = liveSocket()
  if (!socket) return
  lastProgressEmit.set(slideId, now)
  lastProgressPercent.set(slideId, percent)
  socket.emit("slide-upload-progress", {
    slideId,
    progress: Math.min(1, Math.max(0, fraction)),
    tabId: tabSessionId,
  })
}

/**
 * A slide that stayed behind is being uploaded again (the operator tapped
 * Retry). Marks it uploading here and tells teammates, so their card goes back
 * to a progress bar instead of sitting on "Stayed behind".
 */
export const announceUploading = async (slideId: string) => {
  const updated = applyPendingState(slideId, {
    state: "uploading",
    ...currentUploadOwner(),
  })
  if (!updated) return
  reportUploadProgress(slideId, 0, true)
  try {
    const safe = await toSocketSafeSlide(updated)
    const socket = liveSocket()
    if (!socket) return
    socket.emit("update-slide", {
      ...safe,
      slideId,
      pendingUpload: updated.pendingUpload,
      tabId: tabSessionId,
    })
  } catch (err) {
    console.warn("Could not tell teammates the upload restarted:", err)
  }
}

export type UploadOutcome = {
  slideId: string
  /** True when the media did not all reach the cloud. */
  deviceOnly: boolean
  /** The server's copy, when the REST create succeeded: carries `_id` and URLs. */
  serverSlide?: Slide
}

/**
 * Ends the pending state for slides whose upload flow has finished: updates this
 * device's copy, drops the progress entry, and tells teammates the outcome.
 * A slide the operator deleted meanwhile is left alone.
 */
export const settlePendingSlides = async (outcomes: UploadOutcome[]) => {
  const appStore = useAppStore()
  const { clearUploadProgress } = useSlideUploadProgress()
  const owner = currentUploadOwner()

  // Settle every slide here first, in one go. Interleaved with the awaits below,
  // a batch of 30 images would re-render the grid and rewrite the store once
  // per slide on separate ticks.
  const settledHere: { outcome: UploadOutcome; pendingUpload: PendingUpload | null; local: Slide }[] = []
  for (const outcome of outcomes) {
    clearUploadProgress(outcome.slideId)
    lastProgressEmit.delete(outcome.slideId)
    lastProgressPercent.delete(outcome.slideId)

    const local = appStore.activeSlidesById.get(outcome.slideId)
    if (!local) continue

    const pendingUpload: PendingUpload | null = outcome.deviceOnly
      ? { state: "device-only", ...owner }
      : null
    const serverId = outcome.serverSlide?._id

    const settled = applyPendingState(
      outcome.slideId,
      pendingUpload,
      serverId ? { _id: serverId } : {}
    )
    settledHere.push({ outcome, pendingUpload, local: settled ?? local })
  }

  // Then tell teammates.
  for (const { outcome, pendingUpload, local } of settledHere) {
    try {
      const source = outcome.serverSlide
        ? { ...local, ...outcome.serverSlide, pendingUpload }
        : { ...local, pendingUpload }
      const safe = await toSocketSafeSlide(source as Slide)
      const socket = liveSocket()
      if (!socket) continue
      socket.emit("update-slide", {
        ...safe,
        slideId: outcome.slideId,
        // Always present, so a `null` is not lost to a key that never travelled.
        pendingUpload,
        uploadSettled: true,
        tabId: tabSessionId,
      })
    } catch (err) {
      console.warn("Could not tell teammates the upload finished:", err)
    }
  }
}

/**
 * A slide of this user's that still says "uploading" but has no flow running is
 * left over from a reload (or crash) mid-upload. Its bytes are on this device,
 * so it is `device-only`, and the cloud retry sweep finishes it.
 */
export const settleOrphanedUploads = (
  isFlowRunning: (slideId: string) => boolean
) => {
  const appStore = useAppStore()
  const { ownerId, ownerName } = currentUploadOwner()
  if (!ownerId) return 0

  let settled = 0
  for (const slide of appStore.activeSlides) {
    if (slide.pendingUpload?.state !== "uploading") continue
    if (slide.pendingUpload.ownerId !== ownerId) continue
    if (isFlowRunning(slide.id)) continue
    applyPendingState(slide.id, { state: "device-only", ownerId, ownerName })
    settled++
  }
  return settled
}
