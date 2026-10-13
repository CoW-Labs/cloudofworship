// Once church media moves off AWS (the API's STORAGE_ENDPOINT), slides still
// carry the CloudFront / S3 URLs they were saved with. Object keys are identical
// on the new store, so a download tries the new origin first and only falls back
// to the saved URL when the new store does not have the object yet. The API
// announces the routing in `/app-config/info`; until it does, nothing is
// rewritten.

/** localStorage key `useAppInfo` mirrors `/app-config/info` into. */
export const APP_INFO_CACHE_KEY = "cow-app-info"

type MediaRouting = { mediaOrigin: string; legacyMediaOrigins: string[] }

// `undefined` until first read, so windows that never fetch app info (the live
// window) still pick the routing up from the shared cache.
let routing: MediaRouting | null | undefined

const toOrigin = (value: unknown) => {
  if (typeof value !== "string") return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export const setMediaRouting = (
  info?: { mediaOrigin?: unknown; legacyMediaOrigins?: unknown } | null
) => {
  const mediaOrigin = toOrigin(info?.mediaOrigin)
  const legacyMediaOrigins = Array.isArray(info?.legacyMediaOrigins)
    ? info.legacyMediaOrigins.map(toOrigin).filter((o): o is string => !!o)
    : []
  routing =
    mediaOrigin && legacyMediaOrigins.length
      ? { mediaOrigin, legacyMediaOrigins }
      : null
}

const currentRouting = () => {
  if (routing === undefined) {
    try {
      const cached = localStorage.getItem(APP_INFO_CACHE_KEY)
      setMediaRouting(cached ? JSON.parse(cached) : null)
    } catch {
      routing = null
    }
  }
  return routing
}

/**
 * URLs to try for a piece of hosted media, best first. Always ends with the URL
 * as saved, so callers that fall back down the list never lose the original.
 */
export const mediaUrlCandidates = (url: string): string[] => {
  const active = currentRouting()
  if (!active) return [url]

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return [url]
  }
  if (
    parsed.origin === active.mediaOrigin ||
    !active.legacyMediaOrigins.includes(parsed.origin)
  ) {
    return [url]
  }
  return [`${active.mediaOrigin}${parsed.pathname}${parsed.search}`, url]
}

/** The first URL to load hosted media from, for callers that can only try one. */
export const preferredMediaUrl = (url: string) =>
  mediaUrlCandidates(url)[0] ?? url
