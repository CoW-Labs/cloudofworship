/**
 * Large or window-local keys that must be removed before pinia-shared-state
 * serializes an outgoing snapshot. Its `share.omit` option only controls what
 * a receiver applies, so it cannot provide this performance boundary itself.
 */
export const NEVER_BROADCAST = ["pastStates", "futureStates", "activeSlides"]

/**
 * Serializer for PiniaSharedState. Slides live in IndexedDB and secondary
 * windows receive compact revision notifications, so sending activeSlides in
 * every Pinia mutation would duplicate the largest part of application state.
 */
export const sharedStateSerializer = {
  serialize: (state: any) =>
    JSON.stringify(state, (key, value) =>
      NEVER_BROADCAST.includes(key) ? undefined : value
    ),
  deserialize: (value: string) => JSON.parse(value),
}
