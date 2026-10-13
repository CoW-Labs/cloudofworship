import posthog from "posthog-js"
import type { FeatureFlagKey } from "~/composables/useFeatureFlags"
import { preferredMediaUrl } from "~/utils/mediaRouting"

// Large static assets (Bible translations, preset background videos) are
// hosted on CloudFront. A copy of most of them also ships in `public/`, served
// by the app's own host (or from disk in Tauri). The bundled copies are used
// unless the `aws-outage-assets` flag is explicitly off, so downloads keep
// working while AWS is down. Anything without a bundled copy is read from the
// new media store first once the API announces one (see utils/mediaRouting),
// then CloudFront. Temporary: remove with the flag once the outage is over.
const CDN_BASE = "https://d37gopmfkl2m2z.cloudfront.net/open"
const OUTAGE_FLAG: FeatureFlagKey = "aws-outage-assets"
const FLAG_WAIT_MS = 3000

const BUNDLED_BIBLE_VERSIONS = new Set([
  "kjv",
  "niv",
  "nkjv",
  "amp",
  "nlt",
  "cev",
  "nasb",
  "asv",
  "hcsb",
  "rvr09",
  "ybcv",
  "biu",
  "srk",
  "pcm",
  "al",
])
const BUNDLED_BG_VIDEO_IDS = new Set([1, 2, 3, 4, 5, 6])

// Downloads start at app load, often before PostHog has its flags, so this
// waits briefly for them. With no answer it keeps the bundled copies: falling
// back to CloudFront would hand a blocked or slow PostHog a dead host.
const shouldUseBundledAssets = async (): Promise<boolean> => {
  if (!posthog.__loaded) return true
  return new Promise((resolve) => {
    let settled = false
    let stopListening: (() => void) | undefined
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopListening?.()
      // Only an explicit "off" goes back to the CDN
      resolve(posthog.isFeatureEnabled(OUTAGE_FLAG) !== false)
    }
    const timer = setTimeout(settle, FLAG_WAIT_MS)
    // PostHog calls back at once when flags are already loaded
    stopListening = posthog.onFeatureFlags(settle)
    if (settled) stopListening()
  })
}

export const bibleVersionAssetUrl = async (versionId: string) => {
  const id = versionId.toLowerCase()
  return BUNDLED_BIBLE_VERSIONS.has(id) && (await shouldUseBundledAssets())
    ? `/${id}.json`
    : preferredMediaUrl(`${CDN_BASE}/bible-versions/${id}.json`)
}

export const backgroundVideoAssetUrl = async (id: number) =>
  BUNDLED_BG_VIDEO_IDS.has(id) && (await shouldUseBundledAssets())
    ? `/video-bg-${id}.mp4`
    : preferredMediaUrl(`${CDN_BASE}/bg-videos/video-bg-${id}.mp4?v=v1`)
