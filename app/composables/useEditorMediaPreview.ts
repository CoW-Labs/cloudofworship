import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"
import { isExternalVideoData } from "~/utils/externalVideo"

/**
 * Previewing a video in the editor pane before it goes live.
 *
 * One video plays at a time and only the projector plays a live one:
 * - A slide that is on screen is never previewed. Its play, pause and seek go
 *   to the projector as before (see SlideContentToolbar), and the Live Output
 *   thumbnail mirrors it.
 * - A preview is silent. The operator's speakers are usually the house's, and
 *   a clip tested while another is live must not be heard over it.
 * - Only one slide previews at a time: starting another stops the first.
 * - Going live stops the preview (see `useEditorMediaPreviewGuard`).
 *
 * The state is one tiny object with no timers or media listeners of its own, so
 * a preview costs one decoder while it plays and nothing while it is idle.
 * Nothing here touches the slide or the store, so a preview is never synced to
 * teammates or saved.
 */

type PreviewState = {
  slideId: string | null
  playing: boolean
  /** Play has been pressed for this slide, so a YouTube/Vimeo player is mounted. */
  engaged: boolean
  /** A jump requested by the toolbar; `at` makes a repeat of the same time land. */
  seek: { to: number; at: number } | null
}

const state = reactive<PreviewState>({
  slideId: null,
  playing: false,
  engaged: false,
  seek: null,
})

/** A video file or a YouTube/Vimeo link the editor can play. Audio is not. */
export const canPreviewMedia = (slide?: Slide | null): boolean =>
  slide?.type === slideTypes.media &&
  (isExternalVideoData(slide.data) ||
    slide.backgroundType === backgroundTypes.video)

const stop = () => {
  state.slideId = null
  state.playing = false
  state.engaged = false
  state.seek = null
}

export const useEditorMediaPreview = (slideId: () => string | undefined) => {
  const appStore = useAppStore()
  const isLive = () => appStore.isSlideLive(slideId())

  const playing = computed(
    () => state.playing && !!slideId() && state.slideId === slideId()
  )
  /**
   * Set once play has been pressed for the slide. A YouTube/Vimeo player is
   * mounted only from then on, so an idle slide loads nothing from the network.
   */
  const started = computed(
    () => state.engaged && !!slideId() && state.slideId === slideId()
  )
  const seek = computed(() =>
    !!slideId() && state.slideId === slideId() ? state.seek : null
  )

  const begin = () => {
    const id = slideId()
    if (!id || isLive()) return false
    if (state.slideId !== id) stop()
    state.slideId = id
    return true
  }

  return {
    playing,
    started,
    seek,
    play() {
      if (!begin()) return
      state.engaged = true
      state.playing = true
    },
    pause() {
      if (started.value) state.playing = false
    },
    toggle() {
      if (playing.value) {
        state.playing = false
      } else if (begin()) {
        state.engaged = true
        state.playing = true
      }
    },
    seekTo(seconds: number) {
      if (begin()) state.seek = { to: Math.max(0, seconds), at: Date.now() }
    },
    /** The player reached the end or was paused by something else. */
    report(isPlaying: boolean) {
      if (started.value) state.playing = isPlaying
    },
    stop,
  }
}

/**
 * Editor side: ends the preview when its slide goes live or stops being the
 * open slide. A watch on two cheap getters, so nothing runs per frame.
 */
export const useEditorMediaPreviewGuard = (slideId: () => string | undefined) => {
  const appStore = useAppStore()
  watch(
    () => [slideId(), appStore.isSlideLive(slideId())] as const,
    ([id, live]) => {
      if (state.slideId && (live || state.slideId !== id)) stop()
    },
    { flush: "sync" }
  )
  onBeforeUnmount(stop)
}
