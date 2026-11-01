import type { Ref } from "vue"
import type { CameraEchoSettings, LightLeakSettings } from "~/types"
import { createEchoRenderer, type EchoRenderer } from "~/utils/cameraEcho"
import {
  createLightLeakRenderer,
  type LightLeakRenderer,
} from "~/utils/cameraLightLeak"
import {
  latestPersonMask,
  personSegmenterState,
  refreshPersonMask,
} from "~/utils/personSegmenter"

/** The effect to draw and its settings. */
export type CameraEffectDraw =
  | { kind: "main-character-echo"; settings: CameraEchoSettings }
  | { kind: "light-leak"; settings: LightLeakSettings }

export interface CameraEffectOptions {
  /** The effect, or null for none. */
  effect: CameraEffectDraw | null
  /** Whether the feed is flipped by CSS. */
  mirrored: boolean
  /**
   * The shortest gap between person detections for this feed, in ms. The
   * projector wants smooth outlines; an operator's thumbnail can lag a little.
   */
  detectionIntervalMs: number
}

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/**
 * Draws the camera slide's effect from `video` into `canvas` once per camera
 * frame. For an echo that copies people it asks the person detector for a
 * fresh outline as it goes (the detector skips the request when it is busy or
 * the last outline is recent enough).
 *
 * `drawing` is true while the canvas holds the current frame, so the caller
 * can hide the canvas otherwise and show the plain video: before the first
 * frame, wherever WebGL is missing or the context is lost, and while the
 * effect has nothing to add (between light leak bursts). The video keeps
 * playing underneath: a
 * hidden video is not composited, and the per-frame callback stops firing.
 *
 * A renderer gives its WebGL context back when it is done, which leaves its
 * canvas unable to draw again, so the caller gives each effect its own canvas
 * (a `:key` on the effect).
 */
export default function useCameraEffect(
  video: Ref<HTMLVideoElement | null>,
  canvas: Ref<HTMLCanvasElement | null>,
  options: Ref<CameraEffectOptions>
) {
  const drawing = ref(false)

  let renderer: EchoRenderer | LightLeakRenderer | null = null
  let rendererKind: CameraEffectDraw["kind"] | null = null
  let renderCanvas: HTMLCanvasElement | null = null
  let frameHandle: number | null = null
  let rafHandle: number | null = null
  let loopVideo: FrameCallbackVideo | null = null

  const cancelLoop = () => {
    if (frameHandle !== null) loopVideo?.cancelVideoFrameCallback?.(frameHandle)
    if (rafHandle !== null) cancelAnimationFrame(rafHandle)
    frameHandle = null
    rafHandle = null
    loopVideo = null
  }

  const onContextLost = (event: Event) => {
    // Asks the browser to hand the context back, then shows the plain feed
    // until it does.
    event.preventDefault()
    cancelLoop()
    renderer = null
    drawing.value = false
  }
  const onContextRestored = () => restart()

  const teardown = () => {
    cancelLoop()
    if (renderCanvas) {
      renderCanvas.removeEventListener("webglcontextlost", onContextLost)
      renderCanvas.removeEventListener("webglcontextrestored", onContextRestored)
    }
    renderer?.dispose()
    renderer = null
    rendererKind = null
    renderCanvas = null
    drawing.value = false
  }

  const ensureRenderer = (
    target: HTMLCanvasElement,
    kind: CameraEffectDraw["kind"]
  ) => {
    if (renderer && renderCanvas === target && rendererKind === kind) {
      return renderer
    }
    teardown()
    renderCanvas = target
    rendererKind = kind
    target.addEventListener("webglcontextlost", onContextLost)
    target.addEventListener("webglcontextrestored", onContextRestored)
    renderer =
      kind === "light-leak"
        ? createLightLeakRenderer(target)
        : createEchoRenderer(target)
    return renderer
  }

  const drawEcho = (
    element: HTMLVideoElement,
    settings: CameraEchoSettings
  ) => {
    const { mirrored, detectionIntervalMs } = options.value
    let drawSettings = settings
    let mask = null
    if (settings.subject === "people") {
      if (personSegmenterState.value === "failed") {
        // Without detection (no WebGL for TensorFlow.js, or the model would
        // not load) the whole picture is copied, rather than no effect at all.
        drawSettings = { ...settings, subject: "whole" }
      } else {
        // Feeds of one camera share its stream, and so its outline.
        const stream = element.srcObject as MediaStream | null
        const key = stream?.id ?? element.currentSrc
        mask = latestPersonMask(key)
        void refreshPersonMask(element, key, detectionIntervalMs)
      }
    }
    return (renderer as EchoRenderer).draw(element, {
      settings: drawSettings,
      mirrored,
      mask,
    })
  }

  const tick = () => {
    frameHandle = null
    rafHandle = null
    const element = video.value
    const { effect } = options.value
    if (!renderer || !element || !effect || effect.kind !== rendererKind) return
    const drew =
      effect.kind === "light-leak"
        ? (renderer as LightLeakRenderer).draw(element, {
            settings: effect.settings,
          })
        : drawEcho(element, effect.settings)
    if (drew !== drawing.value) drawing.value = drew
    schedule(element)
  }

  // One draw per camera frame where the browser can say when one arrives
  // (Chrome, Edge, Safari 15.4+, Firefox 132+); otherwise once per display
  // refresh, which repeats each frame on a 60Hz screen.
  const schedule = (element: FrameCallbackVideo) => {
    loopVideo = element
    if (element.requestVideoFrameCallback) {
      frameHandle = element.requestVideoFrameCallback(tick)
    } else {
      rafHandle = requestAnimationFrame(tick)
    }
  }

  const restart = () => {
    cancelLoop()
    const element = video.value
    const target = canvas.value
    const effect = options.value.effect
    if (!effect || !element || !target) {
      teardown()
      return
    }
    if (!ensureRenderer(target, effect.kind)) {
      drawing.value = false
      return
    }
    tick()
  }

  // A new stream on the same element can drop pending frame callbacks, so the
  // loop restarts whenever the video starts playing again.
  const onPlaying = () => restart()
  watch(
    video,
    (element, previous) => {
      previous?.removeEventListener("playing", onPlaying)
      element?.addEventListener("playing", onPlaying)
    },
    { immediate: true }
  )

  watch(
    [video, canvas, () => options.value.effect?.kind ?? null],
    () => restart(),
    { flush: "post" }
  )

  onMounted(restart)

  onBeforeUnmount(() => {
    video.value?.removeEventListener("playing", onPlaying)
    teardown()
  })

  return { drawing }
}
