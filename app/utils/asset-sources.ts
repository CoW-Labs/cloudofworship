import posthog from "posthog-js"
import type { FeatureFlagKey } from "~/composables/useFeatureFlags"

// Large static assets (Bible translations, preset background videos) are
// hosted on CloudFront. A copy of most of them also ships in `public/`, served
// by the app's own host (or from disk in Tauri). While the `aws-outage-assets`
// flag is on, the bundled copies are used instead, so downloads keep working
// when CloudFront is down. Anything without a bundled copy still comes from
// CloudFront. Temporary: remove with the flag once the outage is over.
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
// waits briefly for them. With no answer it falls back to CloudFront.
const shouldUseBundledAssets = async (): Promise<boolean> => {
  if (!posthog.__loaded) {
    // PostHog is not initialised in local dev, where the flag reads as on
    // (the same rule as useFeatureFlags)
    return window.location.hostname === "localhost"
  }
  return new Promise((resolve) => {
    let settled = false
    let stopListening: (() => void) | undefined
    const settle = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopListening?.()
      resolve(posthog.isFeatureEnabled(OUTAGE_FLAG) === true)
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
    : `${CDN_BASE}/bible-versions/${id}.json`
}

export const backgroundVideoAssetUrl = async (id: number) =>
  BUNDLED_BG_VIDEO_IDS.has(id) && (await shouldUseBundledAssets())
    ? `/video-bg-${id}.mp4`
    : `${CDN_BASE}/bg-videos/video-bg-${id}.mp4?v=v1`
