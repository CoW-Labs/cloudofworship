import { reactive } from "vue"

/**
 * App-wide cloud upload progress for slides that carry media.
 *
 * The creator's upload flow writes here as bytes leave the device, and a
 * teammate's socket handler writes here from `slide-upload-progress` events, so
 * one slide card reads the same map on both sides. Keyed by `slide.id`.
 *
 * The percentage lives here and not on the slide on purpose: a tick every
 * second must not rewrite slide objects, bump `updatedAt` or invalidate the
 * grid's `v-memo`. In memory only: a reload starts clean and the slide's own
 * `pendingUpload` state says what to show.
 */
type UploadProgressEntry = {
  /** 0..1 */
  fraction: number
  /** Last time this value moved, for spotting a creator that went quiet. */
  updatedAt: number
}

const uploads = reactive<Record<string, UploadProgressEntry>>({})

/** A pending slide silent for this long reads as "waiting for the owner". */
export const UPLOAD_STALE_AFTER_MS = 45_000

/**
 * Silent for this long, the owner is not coming back with it (a closed laptop,
 * a lost connection). It stops being locked and reads "only on their device".
 */
export const UPLOAD_GIVEN_UP_AFTER_MS = 120_000

export default function useSlideUploadProgress() {
  const setUploadProgress = (slideId: string, fraction: number) => {
    if (!slideId || !Number.isFinite(fraction)) return
    const next = Math.min(1, Math.max(0, fraction))
    const current = uploads[slideId]
    // Never move backwards: a retried part restarts its own counter, but the
    // slide as a whole has not lost the bytes already in the cloud.
    if (current && next < current.fraction) {
      uploads[slideId] = { fraction: current.fraction, updatedAt: Date.now() }
      return
    }
    uploads[slideId] = { fraction: next, updatedAt: Date.now() }
  }

  const clearUploadProgress = (slideId: string) => {
    delete uploads[slideId]
  }

  /** 0..1, or `null` when nothing has been reported for this slide yet. */
  const uploadFractionFor = (slideId?: string | null): number | null =>
    slideId && uploads[slideId] ? uploads[slideId]!.fraction : null

  /** Whole percent for display, or `null` when unknown. */
  const uploadPercentFor = (slideId?: string | null): number | null => {
    const fraction = uploadFractionFor(slideId)
    return fraction === null ? null : Math.round(fraction * 100)
  }

  const lastUploadUpdateFor = (slideId?: string | null): number | null =>
    slideId && uploads[slideId] ? uploads[slideId]!.updatedAt : null

  return {
    uploads,
    setUploadProgress,
    clearUploadProgress,
    uploadFractionFor,
    uploadPercentFor,
    lastUploadUpdateFor,
  }
}
