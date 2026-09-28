/** Identify one operator tab through socket reconnects and page reloads. */
export const getLiveSourceId = () => {
  const fresh =
    globalThis.crypto?.randomUUID?.() ||
    `source-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const key = "cow-live-source-id"
    const stored = sessionStorage.getItem(key)
    if (stored && stored.length <= 128) return stored
    sessionStorage.setItem(key, fresh)
  } catch {
    // Storage can be unavailable or disabled. The module-level caller still
    // keeps this fallback stable through transport reconnects.
  }
  return fresh
}
