import { useAppStore } from "~/store/app"
import type { PendingUpload, Slide } from "~/types"
import { enqueueCoalescedSlideShadowPut } from "~/composables/useSlideRepository"
import useIndexedDB from "~/composables/useIndexedDB"
import { cloudKeysForSlide } from "~/utils/pendingUpload"

/**
 * Changes a slide's `pendingUpload` (and optionally its server `_id`) on this
 * device, and writes the new state through to the durable copy.
 *
 * The durable copy matters: another window of the same operator, and this one
 * after a reload, rebuild their slides from it. Without the write a finished
 * slide would come back "uploading", and a teammate's slide would come back
 * with no marker at all, like an unsaved slide of this user's own.
 */
export const applyPendingState = (
  slideId: string,
  pendingUpload: PendingUpload | null,
  extra: Partial<Slide> = {}
) => {
  const appStore = useAppStore()
  appStore.updateSlideInActiveSlides({
    id: slideId,
    pendingUpload,
    ...extra,
  } as Slide)
  const updated = appStore.activeSlides.find((slide) => slide.id === slideId)
  if (!updated) return null
  enqueueCoalescedSlideShadowPut(updated, {
    syncState: updated._id ? "synced" : "pending",
  })
  return updated
}

/**
 * Slides this user added whose files this device never got into the cloud get
 * their "Stayed behind" tag back after a reload. The device's own records are
 * the truth here, so it covers slides saved before the server kept them too.
 * A slide that is mid-upload (it already has a state) is left alone.
 */
export const markStayedBehindFromLocalRecords = async (
  user?: { _id?: string; fullname?: string } | null
) => {
  if (!user?._id) return 0
  const appStore = useAppStore()
  const candidates = appStore.activeSlides
    .filter((slide) => slide._id && !slide.pendingUpload && slide.userId === user._id)
    .map((slide) => ({ slide, keys: cloudKeysForSlide(slide) }))
    .filter(({ keys }) => keys.length)
  if (!candidates.length) return 0

  const allKeys = candidates.flatMap(({ keys }) => keys)
  const records = await useIndexedDB().mediaCloudSync.bulkGet(allKeys)
  const byKey = new Map(allKeys.map((key, index) => [key, records[index]]))

  let marked = 0
  for (const { slide, keys } of candidates) {
    if (!keys.some((key) => byKey.get(key) && byKey.get(key)!.status !== "uploaded")) {
      continue
    }
    // Re-read: the slide may have started uploading while the records loaded.
    const current = appStore.activeSlides.find((s) => s.id === slide.id)
    if (!current || current.pendingUpload) continue
    applyPendingState(slide.id, {
      state: "device-only",
      ownerId: user._id,
      ownerName: user.fullname || "",
    })
    marked++
  }
  return marked
}
