/**
 * Slides are persisted by SlideRepository. Keeping them in the Pinia snapshot
 * would serialize and write the whole corpus for every unrelated state change.
 * Deserialization remains plain JSON so an existing legacy snapshot can still
 * hydrate activeSlides once and be migrated to IndexedDB on app startup.
 */
// Keys no longer part of AppState. Dropped when read and when written, so an
// old snapshot stops carrying them after its next save.
const RETIRED_KEYS = new Set(["failedUploadRequests"])

export const appStateSerializer = {
  serialize: (state: unknown) =>
    JSON.stringify(state, (key, value) =>
      key === "activeSlides" || RETIRED_KEYS.has(key) ? undefined : value
    ),
  deserialize: (value: string) =>
    JSON.parse(value, (key, value) =>
      RETIRED_KEYS.has(key) ? undefined : value
    ),
}

export default appStateSerializer

