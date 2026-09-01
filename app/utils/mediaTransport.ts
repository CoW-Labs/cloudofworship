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
  const db = useIndexedDB()
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

  const remoteUrlFor = async (key?: string | null) =>
    key ? (await db.localMediaFiles.get(key))?.remoteUrl || "" : ""

  const mediaKeys = [
    ...(safe.type === slideTypes.media ? [safe.id] : []),
    ...(safe.presentationObjects || []).map(
      (page) => `${safe.id}-page-${page.page}`
    ),
    ...(safe.backgroundImageKey ? [safe.backgroundImageKey] : []),
    ...(safe.backgroundVideoKey ? [safe.backgroundVideoKey] : []),
  ]
  if (mediaKeys.length) {
    const syncRecords = await db.mediaCloudSync.bulkGet([...new Set(mediaKeys)])
    const mediaCloudSync = { ...(safe.mediaCloudSync || {}) }
    syncRecords.forEach((record) => {
      if (record) mediaCloudSync[record.key] = record
    })
    if (Object.keys(mediaCloudSync).length) safe.mediaCloudSync = mediaCloudSync
  }

  if (safe.data && typeof safe.data === "object") {
    delete (safe.data as any).blob
    if (isSessionMediaUrl((safe.data as any).url)) {
      ;(safe.data as any).url = await remoteUrlFor(safe.id)
    }
  }

  if (safe.presentationObjects) {
    for (const page of safe.presentationObjects) {
      if (isSessionMediaUrl(page.imageUrl)) {
        page.imageUrl = await remoteUrlFor(
          `${safe.id}-page-${page.page}`
        )
      }
    }
  }

  if (isSessionMediaUrl(safe.background)) {
    const backgroundKey =
      safe.backgroundImageKey ||
      safe.backgroundVideoKey ||
      (safe.type === slideTypes.presentation
        ? `${safe.id}-page-${
            safe.presentationObjects?.[safe.presentationPageIndex || 0]?.page ||
            1
          }`
        : safe.type === slideTypes.media
        ? safe.id
        : undefined)
    safe.background = await remoteUrlFor(backgroundKey)
  }

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
