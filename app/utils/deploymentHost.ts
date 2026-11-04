// Hosts we serve the app from: production, staging, our preview deploys, the
// desktop webview and local development. Anything else is someone else's
// deployment of this code, which the license (PolyForm Shield) only allows
// when it doesn't compete with Cloud of Worship.
const OWN_HOST_PATTERNS: RegExp[] = [
  /(^|\.)cloudofworship\.com$/,
  /(^|\.)cloudofworship\.pages\.dev$/,
  /^cloudofworship\.nuxt\.dev$/,
  /^cloudofworship-staging\.vercel\.app$/,
  /-felixfavours-projects\.vercel\.app$/,
  /^cloudofworship-com\.translate\.goog$/,
  /^tauri\.localhost$/,
  /(^|\.)localhost$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^\[?::1\]?$/,
]

// Identifies builds made from this repository in analytics.
export const BUILD_LINEAGE = "cw-41f7c2d9e08b"

/** True when the app is running on a host we don't operate. */
export const isForeignHost = (hostname: string): boolean => {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!host) return false
  return !OWN_HOST_PATTERNS.some(pattern => pattern.test(host))
}
