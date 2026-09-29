import { useAppStore, toSlideArray } from "~/store/app"
import useIndexedDB from "~/composables/useIndexedDB"
import useLocalMediaStorage from "~/composables/useLocalMediaStorage"
import useUploadFile from "~/composables/useUploadFile"
import { tabSessionId } from "./useRealtimeSlides"
import { mediaCloudFailureReason } from "~/utils/mediaCloudSync"
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

/**
 * A page that never reached the cloud and is still worth another try. Quota
 * and the video opt-out are the church's decision, not a transient failure,
 * so they are left alone until something changes on their side.
 */
const needsUpload = (record?: MediaCloudSyncRecord) =>
  !!record &&
  record.reason !== "quota" &&
  record.reason !== "disabled" &&
  (record.status === "failed" ||
    (record.status === "local-only" && record.reason === "offline"))

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
    slideId: string
  ): Promise<CloudRetryResult> => {
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
      const records = await db.mediaCloudSync.bulkGet(keys)

      for (const [index, key] of keys.entries()) {
        if (!needsUpload(records[index])) continue
        const file = await db.localMediaFiles.get(key)
        // Videos have their own opt-out and multipart retries, and are far
        // too heavy to push again behind the operator's back.
        if (!file || file.kind === "video") continue

        try {
          const url = await localMedia.getPlaybackUrl(key)
          if (!url) continue
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
          })
          if (reason === "quota") {
            result.quotaExceeded = true
            break
          }
          result.failed++
          console.error(`Cloud re-upload failed for ${key}:`, err)
        }
      }

      if (result.uploaded) {
        // Re-read the slide: the operator may have edited it while pages
        // were uploading, and that edit must not be overwritten.
        const latest = findActiveSlide(slideId) || slide
        const { updateSlide } = useSlides()
        const saved = await updateSlide(latest)
        const socket = useNuxtApp().$socketio as any
        if (saved && socket?.connected) {
          const safe = await toTransportSafeSlide(latest)
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
  const retryActiveScheduleUploads = async (): Promise<CloudRetryResult> => {
    const total: CloudRetryResult = {
      uploaded: 0,
      failed: 0,
      quotaExceeded: false,
    }
    if (!navigator.onLine) return total

    const db = useIndexedDB()
    const candidates = toSlideArray(appStore.currentState.activeSlides).filter(
      (slide) =>
        slide._id &&
        (slide.type === slideTypes.presentation ||
          slide.type === slideTypes.media)
    )

    for (const slide of candidates) {
      const records = await db.mediaCloudSync.bulkGet(cloudKeysFor(slide))
      if (!records.some(needsUpload)) continue
      const result = await retrySlideUploads(slide.id)
      total.uploaded += result.uploaded
      total.failed += result.failed
      if (result.quotaExceeded) {
        total.quotaExceeded = true
        break
      }
    }
    return total
  }

  return { retrySlideUploads, retryActiveScheduleUploads }
}
