import { useAppStore, toSlideArray } from "~/store/app"
import useIndexedDB from "~/composables/useIndexedDB"
import useLocalMediaStorage from "~/composables/useLocalMediaStorage"
import useUploadFile from "~/composables/useUploadFile"
import { tabSessionId } from "./useRealtimeSlides"
import {
  cloudRetryDueAt,
  isCloudRetryDue,
  isCloudRetryDueOnReconnect,
  isStrandedPending,
  mediaCloudFailureReason,
} from "~/utils/mediaCloudSync"
import { toTransportSafeSlide } from "~/utils/mediaTransport"
import { slideTypes } from "~/utils/constants"
import type { MediaCloudSyncRecord, Slide } from "~/types"

export type CloudRetryResult = {
  uploaded: number
  failed: number
  quotaExceeded: boolean
}

// Slides whose re-upload is already running, so the online watcher, the
// schedule sweep and a "Retry now" tap never upload the same page twice.
const inFlight = new Set<string>()

// Pages of one slide re-uploaded at the same time.
const UPLOAD_CONCURRENCY = 3

// The reconnect and schedule-load sweeps never fire while the browser keeps
// reporting online through flaky Wi-Fi, so a page whose backoff runs out has
// this timer to come back for it. Only ever moved earlier.
let backoffSweepTimer: ReturnType<typeof setTimeout> | null = null
let backoffSweepAt = Infinity
const MIN_BACKOFF_SWEEP_DELAY_MS = 5000

const armBackoffSweep = (
  at: number | undefined,
  sweep: () => Promise<unknown>
) => {
  if (!at || at >= backoffSweepAt) return
  if (backoffSweepTimer) clearTimeout(backoffSweepTimer)
  backoffSweepAt = at
  backoffSweepTimer = setTimeout(() => {
    backoffSweepTimer = null
    backoffSweepAt = Infinity
    sweep().catch((err) =>
      console.error("Cloud upload retry sweep failed:", err)
    )
  }, Math.max(at - Date.now(), MIN_BACKOFF_SWEEP_DELAY_MS))
}

/**
 * A page that never reached the cloud and is still worth another try. Quota
 * and the video opt-out are the church's decision, not a transient failure,
 * so they are left alone until something changes on their side. Pages whose
 * background re-uploads keep failing wait out a backoff (see
 * isCloudRetryDue), so flaky Wi-Fi doesn't resend them on every reconnect;
 * `force` is for the operator's own "Retry now", and `reconnected` cuts the
 * backoff short once the connection is back (see isCloudRetryDueOnReconnect).
 * An upload left "pending" by a tab that closed mid-upload counts too.
 */
const needsUpload = (
  record?: MediaCloudSyncRecord,
  force = false,
  reconnected = false
) =>
  !!record &&
  record.reason !== "quota" &&
  record.reason !== "disabled" &&
  (record.status === "failed" ||
    (record.status === "local-only" && record.reason === "offline") ||
    isStrandedPending(record)) &&
  (force ||
    (reconnected
      ? isCloudRetryDueOnReconnect(record)
      : isCloudRetryDue(record)))

/** When the earliest of these pages still waiting out a backoff comes due. */
const earliestBackoffEnd = (
  records: readonly (MediaCloudSyncRecord | undefined)[]
) => {
  const now = Date.now()
  const dueTimes = records
    .filter(
      (record): record is MediaCloudSyncRecord =>
        needsUpload(record, true) && !isCloudRetryDue(record!, now)
    )
    .map(cloudRetryDueAt)
  return dueTimes.length ? Math.min(...dueTimes) : undefined
}

const cloudKeysFor = (slide: Slide): string[] => {
  if (slide.type === slideTypes.presentation) {
    return (slide.presentationObjects || []).map(
      (page) => `${slide.id}-page-${page.page}`
    )
  }
  if (slide.type === slideTypes.media) return [slide.id]
  return []
}

/**
 * Re-upload media that was saved on this device but never reached the cloud,
 * then write the new cloud URLs onto the server slide so every other device
 * and teammate can show it.
 *
 * Only the device that added the media holds its bytes, so this is a no-op
 * everywhere else.
 */
export default function useCloudUploadRetry() {
  const appStore = useAppStore()
  const localMedia = useLocalMediaStorage()

  const findActiveSlide = (slideId: string) =>
    toSlideArray(appStore.currentState.activeSlides).find(
      (slide) => slide.id === slideId
    )

  const retrySlideUploads = async (
    slideId: string,
    options: {
      // The sweep has already read these; pass them on instead of reading again.
      knownRecords?: Map<string, MediaCloudSyncRecord | undefined>
      // Skip the backoff: the operator asked for this retry.
      force?: boolean
      // The connection just came back: retry pages not tried in the last minute.
      reconnected?: boolean
    } = {}
  ): Promise<CloudRetryResult> => {
    const { knownRecords, force = false, reconnected = false } = options
    const result: CloudRetryResult = {
      uploaded: 0,
      failed: 0,
      quotaExceeded: false,
    }
    // The server copy can only be patched while the slide is in the active
    // schedule and has its server id. Otherwise leave the failure recorded so
    // the sweep picks it up when that schedule is open again.
    const slide = findActiveSlide(slideId)
    if (!slide?._id || !navigator.onLine || inFlight.has(slideId)) return result

    inFlight.add(slideId)
    try {
      const db = useIndexedDB()
      const keys = cloudKeysFor(slide)
      // Fall back to a fresh read if pages changed since the sweep read them.
      const records = keys.every((key) => knownRecords?.has(key))
        ? keys.map((key) => knownRecords!.get(key))
        : await db.mediaCloudSync.bulkGet(keys)
      const pending = keys.filter((_, index) =>
        needsUpload(records[index], force, reconnected)
      )
      if (!pending.length) return result

      const files = await db.localMediaFiles.bulkGet(pending)
      // Videos have their own opt-out and multipart retries, and are far
      // too heavy to push again behind the operator's back.
      const queue = pending
        .map((key, index) => ({ key, file: files[index] }))
        .filter(({ file }) => file && file.kind !== "video")

      const uploadPage = async (
        key: string,
        file: NonNullable<(typeof files)[number]>
      ) => {
        try {
          const url = await localMedia.getPlaybackUrl(key)
          if (!url) return
          const bytes = await (await fetch(url)).blob()
          // A Tauri asset:// read can come back untyped, which would push a
          // PNG off the direct upload path.
          const blob = bytes.type
            ? bytes
            : new Blob([bytes], { type: file.mimeType })
          const uploaded = await useUploadFile(blob, {
            name: file.originalName,
          })
          await localMedia.setCloudSyncState(key, {
            groupId: slide.id,
            status: "uploaded",
            remoteUrl: uploaded.file.url,
          })
          result.uploaded++
        } catch (err) {
          const reason = mediaCloudFailureReason(err)
          await localMedia.setCloudSyncState(key, {
            groupId: slide.id,
            status: "failed",
            reason,
            error: err,
            retried: true,
          })
          if (reason === "quota") {
            result.quotaExceeded = true
            return
          }
          result.failed++
          console.error(`Cloud re-upload failed for ${key}:`, err)
        }
      }

      // A few pages at a time: a large deck recovers quickly without
      // saturating the connection the live service is also using.
      let next = 0
      const worker = async () => {
        while (next < queue.length && !result.quotaExceeded) {
          const { key, file } = queue[next++]!
          await uploadPage(key, file!)
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(UPLOAD_CONCURRENCY, queue.length) },
          worker
        )
      )

      // The sweep arms its timer once for the whole schedule. A direct call
      // (the post-create retry, "Retry now") arms it here.
      if (result.failed && !result.quotaExceeded && !knownRecords) {
        armBackoffSweep(
          earliestBackoffEnd(await db.mediaCloudSync.bulkGet(keys)),
          retryActiveScheduleUploads
        )
      }

      if (result.uploaded) {
        // Re-read the slide: the operator may have edited it while pages
        // were uploading, and that edit must not be overwritten.
        const latest = findActiveSlide(slideId) || slide
        const safe = await toTransportSafeSlide(latest)
        const { updateSlide } = useSlides()
        const saved = await updateSlide(latest, safe)
        const socket = useNuxtApp().$socketio as any
        if (saved && socket?.connected) {
          socket.emit("update-slide", {
            ...safe,
            slideId: latest.id,
            tabId: tabSessionId,
          })
        }
      }
    } finally {
      inFlight.delete(slideId)
    }
    return result
  }

  /**
   * Retry every stranded upload in the active schedule. Runs when the
   * connection returns and when a schedule is opened, so a page that failed
   * on Sunday morning is repaired the next time that device is online.
   */
  const retryActiveScheduleUploads = async (
    options: { reconnected?: boolean } = {}
  ): Promise<CloudRetryResult> => {
    const { reconnected = false } = options
    const total: CloudRetryResult = {
      uploaded: 0,
      failed: 0,
      quotaExceeded: false,
    }
    if (!navigator.onLine) return total

    const candidates = toSlideArray(appStore.currentState.activeSlides)
      .filter(
        (slide) =>
          slide._id &&
          (slide.type === slideTypes.presentation ||
            slide.type === slideTypes.media)
      )
      .map((slide) => ({ slide, keys: cloudKeysFor(slide) }))

    // One read for the whole schedule rather than one per slide.
    const allKeys = candidates.flatMap(({ keys }) => keys)
    const allRecords = await useIndexedDB().mediaCloudSync.bulkGet(allKeys)
    const recordsByKey = new Map(
      allKeys.map((key, index) => [key, allRecords[index]])
    )

    for (const { slide, keys } of candidates) {
      if (!keys.some((key) => needsUpload(recordsByKey.get(key), false, reconnected))) {
        continue
      }
      const result = await retrySlideUploads(slide.id, {
        knownRecords: recordsByKey,
        reconnected,
      })
      total.uploaded += result.uploaded
      total.failed += result.failed
      if (result.quotaExceeded) {
        total.quotaExceeded = true
        break
      }
    }

    // Come back when the next page's backoff runs out, including pages that
    // just failed again and pages this sweep skipped as not yet due.
    if (!total.quotaExceeded && allKeys.length) {
      armBackoffSweep(
        earliestBackoffEnd(await useIndexedDB().mediaCloudSync.bulkGet(allKeys)),
        retryActiveScheduleUploads
      )
    }
    return total
  }

  return { retrySlideUploads, retryActiveScheduleUploads }
}
