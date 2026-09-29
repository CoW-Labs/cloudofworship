import type { InjectionKey, MaybeRef, Ref } from "vue"

/**
 * How an intermission slide renders where it is mounted:
 * - "live": the projector window. Full frame rate, drawn at 1x density.
 * - "preview": operator-side previews (editor, live output panel). Capped at
 *   30fps and paused while scrolled out of view.
 * - "static": thumbnails and anywhere that does not opt in. One settled frame.
 */
export type IntermissionRenderMode = "live" | "preview" | "static"

export const intermissionModeKey: InjectionKey<
  MaybeRef<IntermissionRenderMode>
> = Symbol("intermission-mode")

/**
 * Tells a live intermission to play its exit (`exiting: true`) or, when the
 * operator goes back to it mid-exit, to bring its text back. A fresh object
 * each time, so the same slide can exit again later.
 */
export interface IntermissionExitSignal {
  id: string
  exiting: boolean
}
export const intermissionExitKey: InjectionKey<
  Ref<IntermissionExitSignal | null>
> = Symbol("intermission-exit")

/** How long the live output holds an outgoing intermission for its exit. */
export const INTERMISSION_EXIT_MS = 650
