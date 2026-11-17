import type { PendingUpload, Slide } from "~/types"
import { slideTypes } from "~/utils/constants"

/**
 * A teammate's slide whose files are still uploading. It is on the schedule so
 * everyone can see it coming, but it has no media to show yet, so it cannot be
 * selected, edited, paired or taken live from any other device. Its owner's
 * own copy is never locked: the bytes are on their device.
 *
 * A slide that is `device-only` is not locked. Its media is unavailable, like
 * any slide whose upload failed, and anyone can still delete it.
 */
export const isLockedByUpload = (
  slide: Slide | null | undefined,
  currentUserId?: string | null
) =>
  slide?.pendingUpload?.state === "uploading" &&
  slide.pendingUpload.ownerId !== currentUserId

/** The cache keys of the files a media or presentation slide has to upload. */
export const cloudKeysForSlide = (slide: Slide): string[] =>
  slide.type === slideTypes.presentation
    ? (slide.presentationObjects || []).map(
        (page) => `${slide.id}-page-${page.page}`
      )
    : slide.type === slideTypes.media
    ? [slide.id]
    : []

/**
 * A media slide with no file URL, or a deck with a page that has none: nothing
 * to show anywhere, so its media never made it to the cloud. Only meaningful for
 * a slide that has been through the server or a socket, whose device-only URLs
 * were already swapped for cloud ones or blanked.
 */
export const isMissingCloudMedia = (slide: Slide): boolean => {
  if (slide.type === slideTypes.media) {
    const data = slide.data as { url?: string; isExternal?: boolean } | undefined
    return !data?.url
  }
  if (slide.type === slideTypes.presentation) {
    const pages = slide.presentationObjects || []
    return pages.length > 0 && pages.some((page) => !page.imageUrl)
  }
  return false
}

/**
 * The slide carries a cloud URL for every file it has: proof, from the message
 * alone, that its media is in the cloud. A partial update (a rename) says
 * nothing either way, so it does not count.
 */
export const hasCloudMedia = (slide: Partial<Slide>): boolean => {
  if (slide.type === slideTypes.media) {
    return !!(slide.data as { url?: string } | undefined)?.url
  }
  if (slide.type === slideTypes.presentation) {
    const pages = slide.presentationObjects || []
    return pages.length > 0 && pages.every((page) => !!page.imageUrl)
  }
  return false
}

/**
 * `pendingUpload` is not saved on the server, so a reload would forget that a
 * slide stayed behind. The slide does carry what it needs: `mediaCloudSync`
 * records, per file, whether it reached the cloud. Any file that did not means
 * the media is still only on its owner's device.
 *
 * Returns the `device-only` state to put back, or null when every file is in
 * the cloud (or the slide has no files of its own to upload).
 */
export const stayedBehindFromSync = (
  slide: Slide,
  currentUser?: { _id?: string; fullname?: string } | null
): PendingUpload | null => {
  if (slide.pendingUpload) return null
  const keys = cloudKeysForSlide(slide)
  if (!keys.length) return null

  // Either a file's own record says it never reached the cloud, or the slide
  // simply has no cloud URL for it. The second needs no record: a slide saved
  // by an older version, or by a device that lost its state, still says so.
  const records = slide.mediaCloudSync
  const recordSaysBehind =
    !!records &&
    keys.some((key) => {
      const record = records[key]
      return !!record && record.status !== "uploaded"
    })
  const stayedBehind = recordSaysBehind || isMissingCloudMedia(slide)
  if (!stayedBehind) return null

  const isMine = !!currentUser?._id && slide.userId === currentUser._id
  return {
    state: "device-only",
    ownerId: slide.userId,
    ownerName: isMine ? currentUser?.fullname || "" : "",
  }
}
