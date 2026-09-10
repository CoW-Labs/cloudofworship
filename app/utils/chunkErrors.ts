/**
 * Shared state between the chunk-reload plugin and the error filters.
 *
 * After a deploy the previous build's hashed `_nuxt/*` files are gone, so a
 * tab served before the deploy fails its next lazy import. The plugin heals
 * that with one reload, but the same failure was still landing in error
 * tracking three ways — Vue's errorHandler, PostHog's own unhandledrejection
 * autocapture, and the preload event — as "Failed to fetch dynamically
 * imported module", one issue that grew with every deploy and said nothing
 * actionable. The plugin already records `chunk_load_recovered_by_reload` and
 * `chunk_load_unrecoverable`, which is the signal worth keeping.
 *
 * A chunk error is therefore reported as an exception only when recovery has
 * NOT claimed it: that is the case that needs a human.
 */

/** Browser-specific phrasings of "the chunk is gone". */
const CHUNK_LOAD_FRAGMENTS = [
  "Failed to fetch dynamically imported module", // Chromium
  "Importing a module script failed", // Safari
  "error loading dynamically imported module", // Firefox
  "Unable to preload CSS",
]

export const isChunkLoadError = (text: string | undefined | null) =>
  Boolean(text && CHUNK_LOAD_FRAGMENTS.some((f) => text.includes(f)))

type Recover = (message: string) => void

const state: { claimed: boolean; recover: Recover | null } = {
  claimed: false,
  recover: null,
}

/** Called by the plugin once it owns the recovery policy for this tab. */
export const registerChunkRecovery = (recover: Recover) => {
  state.recover = recover
}

/** The plugin has scheduled a reload, or is holding one until back online. */
export const markChunkRecoveryClaimed = () => {
  state.claimed = true
}

/**
 * Decide whether a thrown value / exception text is a chunk error that the
 * recovery plugin is handling. Errors that reach the Vue handler without
 * passing through Vite's preload helper are forwarded to recovery here, so
 * no chunk failure is dropped merely because of how it was imported.
 */
export const isHandledChunkLoadError = (text: string | undefined | null) => {
  if (!isChunkLoadError(text)) return false
  if (!state.claimed) state.recover?.(text as string)
  return state.claimed
}
