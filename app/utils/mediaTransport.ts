import useIndexedDB from "~/composables/useIndexedDB"
import type { Slide } from "~/types"
import { slideTypes } from "~/utils/constants"
import { cloudKeysForSlide } from "~/utils/pendingUpload"

export const isSessionMediaUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  return (
    value.startsWith("blob:") ||
    value.startsWith("asset:") ||
    value.startsWith("file:") ||
    /^https?:\/\/asset\.localhost(?:\/|$)/i.test(value)
  )
}

/**
 * Create a network-safe slide copy. Device playback URLs and source Blobs are
 * replaced by cloud recovery URLs when available, or an empty string for
 * local-only media. Logical keys remain so each receiving window can resolve
 * its own platform URL.
 */
export const toTransportSafeSlide = async (slide: Slide): Promise<Slide> => {
  const safe: Slide = {
    ...slide,
    data:
      slide.data && typeof slide.data === "object"
        ? ({ ...(slide.data as any) } as Slide["data"])
        : slide.data,
    presentationObjects: slide.presentationObjects?.map((page) => ({
      ...page,
    })),
  }
  // Client-only upload state: it never goes to the REST API, the library or
  // the stage feed. The socket path puts it back (see toSocketSafeSlide).
  delete safe.pendingUpload
  const data = safe.data && typeof safe.data === "object" ? (safe.data as any) : null
  if (data) delete data.blob

  const pageKey = (page: number) => `${safe.id}-page-${page}`
  const localPages = (safe.presentationObjects || []).filter((page) =>
    isSessionMediaUrl(page.imageUrl)
  )
  const localData = !!data && isSessionMediaUrl(data.url)
  const localBackground = isSessionMediaUrl(safe.background)
  const backgroundKey = localBackground
    ? safe.backgroundImageKey ||
      safe.backgroundVideoKey ||
      (safe.type === slideTypes.presentation
        ? pageKey(
            safe.presentationObjects?.[safe.presentationPageIndex || 0]?.page ||
              1
          )
        : safe.type === slideTypes.media
        ? safe.id
        : undefined)
    : undefined

  // Every edit of a media or presentation slide passes through here. When its
  // URLs are already cloud URLs there is nothing to swap, so don't touch
  // IndexedDB at all.
  if (!localPages.length && !localData && !localBackground) return safe

  const db = useIndexedDB()
  const mediaKeys = [
    ...new Set([
      ...(safe.type === slideTypes.media ? [safe.id] : []),
      ...(safe.presentationObjects || []).map((page) => pageKey(page.page)),
      ...(safe.backgroundImageKey ? [safe.backgroundImageKey] : []),
      ...(safe.backgroundVideoKey ? [safe.backgroundVideoKey] : []),
    ]),
  ]
  const localKeys = [
    ...new Set([
      ...localPages.map((page) => pageKey(page.page)),
      ...(localData ? [safe.id] : []),
      ...(backgroundKey ? [backgroundKey] : []),
    ]),
  ]
  const [syncRecords, files] = await Promise.all([
    mediaKeys.length ? db.mediaCloudSync.bulkGet(mediaKeys) : [],
    db.localMediaFiles.bulkGet(localKeys),
  ])

  const mediaCloudSync = { ...(safe.mediaCloudSync || {}) }
  syncRecords.forEach((record) => {
    if (record) mediaCloudSync[record.key] = record
  })
  if (Object.keys(mediaCloudSync).length) safe.mediaCloudSync = mediaCloudSync

  // The file row is the usual home of the cloud URL, but a slide rehydrated
  // from the server may only remember it in `mediaCloudSync`. Falling through
  // to "" there would blank a page that is safely on the CDN.
  const fileUrls = new Map(
    localKeys.map((key, index) => [key, files[index]?.remoteUrl])
  )
  const remoteUrlFor = (key?: string | null) =>
    key ? fileUrls.get(key) || mediaCloudSync[key]?.remoteUrl || "" : ""

  if (localData) data.url = remoteUrlFor(safe.id)
  localPages.forEach((page) => {
    page.imageUrl = remoteUrlFor(pageKey(page.page))
  })
  if (localBackground) safe.background = remoteUrlFor(backgroundKey)

  return safe
}

/**
 * Puts this device's record of each file (in the cloud, or still only here) on
 * the slide. A slide saved to the server this way remembers, for every device
 * and after any reload, which of its files stayed behind. Used when a slide is
 * first saved, because by then its URLs are already swapped for cloud ones and
 * the usual path would skip the records.
 */
export const withCloudSyncRecords = async (slide: Slide): Promise<Slide> => {
  const keys = cloudKeysForSlide(slide)
  if (!keys.length) return slide
  const records = await useIndexedDB().mediaCloudSync.bulkGet(keys)
  const mediaCloudSync = { ...(slide.mediaCloudSync || {}) }
  records.forEach((record) => {
    if (record) mediaCloudSync[record.key] = record
  })
  return Object.keys(mediaCloudSync).length ? { ...slide, mediaCloudSync } : slide
}

/**
 * The copy of a slide that goes to teammates over the socket. The same as
 * {@link toTransportSafeSlide}, except it keeps `pendingUpload`, which is how a
 * teammate knows the slide is still uploading and must not be used yet.
 */
export const toSocketSafeSlide = async (slide: Slide): Promise<Slide> => {
  const safe = await toTransportSafeSlide(slide)
  // `null` travels too: it is how a teammate who missed the finish learns of it
  // from the next edit.
  if (slide.pendingUpload !== undefined) safe.pendingUpload = slide.pendingUpload
  return safe
}

export const toTransportSafePayload = async (payload: any): Promise<any> => {
  if (Array.isArray(payload)) {
    return await Promise.all(payload.map((item) => toTransportSafePayload(item)))
  }
  if (!payload || typeof payload !== "object") return payload

  if (
    typeof payload.id === "string" &&
    ("background" in payload ||
      "presentationObjects" in payload ||
      "data" in payload)
  ) {
    return await toSocketSafeSlide(payload as Slide)
  }

  const safe = { ...payload }
  if (Array.isArray(payload.slides)) {
    safe.slides = await Promise.all(
      payload.slides.map((slide: Slide) => toSocketSafeSlide(slide))
    )
  }
  if (payload.slide) {
    safe.slide = await toSocketSafeSlide(payload.slide)
  }
  return safe
}

export const toTransportSafeMediaSetting = async <T>(
  setting: T
): Promise<T> => {
  if (!setting || typeof setting !== "object") return setting
  const safe = { ...(setting as any) }
  if (isSessionMediaUrl(safe.background)) {
    const key = safe.backgroundImageKey || safe.backgroundVideoKey
    safe.background = key
      ? (await useIndexedDB().localMediaFiles.get(key))?.remoteUrl || ""
      : ""
  }
  return safe as T
}
