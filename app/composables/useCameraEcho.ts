import type { Ref } from "vue"
import { createEchoRenderer, type EchoOptions, type EchoRenderer } from "~/utils/cameraEcho"

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/**
 * Draws the echo effect from `video` into `canvas` once per camera frame.
 *
 * `drawing` turns true once a frame is on the canvas, so the caller can hold
 * the canvas hidden until then and keep showing the plain video wherever WebGL
 * is missing or the context is lost. The video keeps playing underneath: a
 * hidden video is not composited, and the per-frame callback stops firing.
 */
export default function useCameraEcho(
  video: Ref<HTMLVideoElement | null>,
  canvas: Ref<HTMLCanvasElement | null>,
  options: Ref<EchoOptions & { enabled: boolean }>
) {
  const drawing = ref(false)

  let renderer: EchoRenderer | null = null
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
    renderCanvas = null
    drawing.value = false
  }

  const ensureRenderer = (target: HTMLCanvasElement) => {
    if (renderer && renderCanvas === target) return renderer
    teardown()
    renderCanvas = target
    target.addEventListener("webglcontextlost", onContextLost)
    target.addEventListener("webglcontextrestored", onContextRestored)
    renderer = createEchoRenderer(target)
    return renderer
  }

  const tick = () => {
    frameHandle = null
    rafHandle = null
    const element = video.value
    if (!renderer || !element) return
    const drew = renderer.draw(element, options.value)
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
    if (!options.value.enabled || !element || !target) {
      teardown()
      return
    }
    if (!ensureRenderer(target)) {
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

  watch([video, canvas, () => options.value.enabled], () => restart(), {
    flush: "post",
  })

  onMounted(restart)

  onBeforeUnmount(() => {
    video.value?.removeEventListener("playing", onPlaying)
    teardown()
  })

  return { drawing }
}
