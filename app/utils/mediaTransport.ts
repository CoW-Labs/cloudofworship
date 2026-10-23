import useIndexedDB from "~/composables/useIndexedDB"
import type { Slide } from "~/types"
import { slideTypes } from "~/utils/constants"

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
    return await toTransportSafeSlide(payload as Slide)
  }

  const safe = { ...payload }
  if (Array.isArray(payload.slides)) {
    safe.slides = await Promise.all(
      payload.slides.map((slide: Slide) => toTransportSafeSlide(slide))
    )
  }
  if (payload.slide) {
    safe.slide = await toTransportSafeSlide(payload.slide)
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
