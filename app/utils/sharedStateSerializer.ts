/**
 * Top-level state keys that no receiving window ever applies, because every
 * shared store that has them lists them in its own `share.omit`.
 *
 * pinia-shared-state only consults `omit` when *applying* an inbound message.
 * The sender still serializes the entire state on every change, so without
 * this the undo stack goes out over the wire too -- up to MAX_UNDO_HISTORY
 * snapshots, each expanding its own full copy of `activeSlides`. That is the
 * whole slide corpus broadcast dozens of times over, per change, for data the
 * other side discards on arrival.
 */
export const NEVER_BROADCAST = ["pastStates", "futureStates"]

/**
 * Serializer for PiniaSharedState. Drops {@link NEVER_BROADCAST} keys from the
 * outgoing payload and is otherwise plain JSON, so every field a receiving
 * window reads round-trips unchanged.
 */
export const sharedStateSerializer = {
  serialize: (state: any) =>
    JSON.stringify(state, (key, value) =>
      NEVER_BROADCAST.includes(key) ? undefined : value
    ),
  deserialize: (value: string) => JSON.parse(value),
}
