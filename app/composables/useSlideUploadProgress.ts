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
// Fraction (0..1) per slide. Written only when the whole percent changes: an
// upload reports bytes many times a second, and each write re-renders the card.
const uploads = reactive<Record<string, number>>({})
// Last time each slide's upload moved. Not reactive: cards check it on their
// own clock, so a fresh timestamp alone must not re-render anything.
const lastMoved = new Map<string, number>()

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
    lastMoved.set(slideId, Date.now())
    if (current !== undefined) {
      // Never move backwards: a retried part restarts its own counter, but the
      // slide as a whole has not lost the bytes already in the cloud.
      if (next <= current) return
      // The same whole percent draws the same bar.
      if (next < 1 && Math.round(next * 100) === Math.round(current * 100)) {
        return
      }
    }
    uploads[slideId] = next
  }

  const clearUploadProgress = (slideId: string) => {
    lastMoved.delete(slideId)
    delete uploads[slideId]
  }

  /** 0..1, or `null` when nothing has been reported for this slide yet. */
  const uploadFractionFor = (slideId?: string | null): number | null =>
    slideId && uploads[slideId] !== undefined ? uploads[slideId]! : null

  /** Whole percent for display, or `null` when unknown. */
  const uploadPercentFor = (slideId?: string | null): number | null => {
    const fraction = uploadFractionFor(slideId)
    return fraction === null ? null : Math.round(fraction * 100)
  }

  /** Not reactive: read it on a clock (see SlideCard, PreviewContent). */
  const lastUploadUpdateFor = (slideId?: string | null): number | null =>
    (slideId && lastMoved.get(slideId)) || null

  return {
    uploads,
    setUploadProgress,
    clearUploadProgress,
    uploadFractionFor,
    uploadPercentFor,
    lastUploadUpdateFor,
  }
}
