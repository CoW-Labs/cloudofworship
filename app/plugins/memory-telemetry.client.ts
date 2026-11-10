import { useAppStore } from "~/store/app"

/**
 * Reports how much JavaScript heap the operator console and the projector are
 * holding, a few times an hour, so a "this machine felt heavy" report can be
 * checked against numbers from the field instead of a single screenshot.
 *
 * It is built to cost nothing on a live service:
 *
 *  - One synchronous property read and one small event every 15 minutes. No
 *    snapshot, no serialising of state, nothing that walks the heap.
 *  - Only while the tab is visible, so a backgrounded tab does no work at all.
 *  - Only for the two windows worth watching: the operator console ("/") and
 *    the projector ("/live"). The projector runs for a whole service without
 *    anyone touching it, which is exactly where a slow leak would hide.
 *  - Chromium only (Chrome, Edge, and the Windows desktop app's WebView2).
 *    Safari, Firefox and the macOS desktop app do not expose heap sizes, so
 *    they send nothing.
 *
 * The heap figure is the JS heap only. Decoded images, video and camera frames
 * live outside it, in the GPU and renderer processes, so a window can look
 * light here and still be large in Task Manager. The value is also rounded by
 * the browser, which is fine for spotting a climb over a session.
 *
 * Properties are numbers and enums only: nothing about what is on a slide.
 */

const FIRST_SAMPLE_DELAY_MS = 5 * 60_000
const SAMPLE_INTERVAL_MS = 15 * 60_000

const MB = 1024 * 1024

type MemoryWindow = "operator" | "live"

interface ChromiumMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

const readHeap = (): ChromiumMemory | null => {
  const memory = (performance as Performance & { memory?: ChromiumMemory })
    .memory
  if (!memory || !memory.usedJSHeapSize) return null
  return memory
}

const currentWindow = (): MemoryWindow | null => {
  const path = window.location.pathname
  if (path === "/") return "operator"
  if (path.startsWith("/live")) return "live"
  return null
}

export default defineNuxtPlugin((nuxtApp) => {
  // Nothing to report from a browser that does not expose the heap.
  if (!readHeap()) return

  const sample = () => {
    if (document.visibilityState !== "visible") return
    const windowName = currentWindow()
    const heap = readHeap()
    if (!windowName || !heap) return

    // `$posthog` is provided by a later plugin and is absent on localhost, so
    // it is looked up per sample rather than at setup.
    const posthog = (nuxtApp as any).$posthog
    if (!posthog?.capture) return

    // Resolved on demand, never at plugin setup: creating the store before
    // `pinia-shared-state` registers its Pinia plugin would stop the operator
    // and projection windows sharing state.
    const state = useAppStore().currentState
    const slides = state.activeSlides ?? []
    const liveSlide = state.liveSlideId
      ? slides.find((slide) => slide.id === state.liveSlideId)
      : null

    posthog.capture("MEMORY_SAMPLED", {
      window: windowName,
      used_heap_mb: Math.round(heap.usedJSHeapSize / MB),
      total_heap_mb: Math.round(heap.totalJSHeapSize / MB),
      heap_limit_mb: Math.round(heap.jsHeapSizeLimit / MB),
      // Minutes since this window loaded, not since the church signed in.
      minutes_open: Math.round(performance.now() / 60_000),
      slide_count: slides.length,
      live_slide_type: liveSlide?.type ?? null,
    })
  }

  const first = setTimeout(sample, FIRST_SAMPLE_DELAY_MS)
  const interval = setInterval(sample, SAMPLE_INTERVAL_MS)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearTimeout(first)
      clearInterval(interval)
    })
  }
})
