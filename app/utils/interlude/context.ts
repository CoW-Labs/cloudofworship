import type { InjectionKey, MaybeRef, Ref } from "vue"

/**
 * How an interlude slide renders where it is mounted:
 * - "live": the projector window. Full frame rate, drawn at 1x density.
 * - "preview": operator-side previews (editor, live output panel). Capped at
 *   30fps and paused while scrolled out of view.
 * - "static": thumbnails and anywhere that does not opt in. One settled frame.
 */
export type InterludeRenderMode = "live" | "preview" | "static"

export const interludeModeKey: InjectionKey<
  MaybeRef<InterludeRenderMode>
> = Symbol("interlude-mode")

/**
 * Tells a live interlude to play its exit (`exiting: true`) or, when the
 * operator goes back to it mid-exit, to bring its text back. A fresh object
 * each time, so the same slide can exit again later.
 */
export interface InterludeExitSignal {
  id: string
  exiting: boolean
}
export const interludeExitKey: InjectionKey<
  Ref<InterludeExitSignal | null>
> = Symbol("interlude-exit")

/** How long the live output holds an outgoing interlude for its exit. */
export const INTERLUDE_EXIT_MS = 650
