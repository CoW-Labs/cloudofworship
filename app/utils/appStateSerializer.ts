/**
 * Slides are persisted by SlideRepository. Keeping them in the Pinia snapshot
 * would serialize and write the whole corpus for every unrelated state change.
 * Deserialization remains plain JSON so an existing legacy snapshot can still
 * hydrate activeSlides once and be migrated to IndexedDB on app startup.
 */
export const appStateSerializer = {
  serialize: (state: unknown) =>
    JSON.stringify(state, (key, value) =>
      key === "activeSlides" ? undefined : value
    ),
  deserialize: (value: string) => JSON.parse(value),
}

export default appStateSerializer

