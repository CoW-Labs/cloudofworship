<template>
  <div
    ref="container"
    class="stage-auto-text flex h-full w-full items-center overflow-hidden"
  >
    <div
      ref="content"
      class="w-full whitespace-pre-wrap break-words font-semibold leading-[1.15]"
      :style="{ fontSize: `${fontSize}px` }"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Fits a block of text to the panel it sits in.
 *
 * Slide text on a stage screen has to be read from across a room, so it should
 * be as large as the box allows — a single verse and a full chorus need very
 * different sizes. Measuring beats estimating from character count here: the
 * panels are resizable (and the display can be any aspect ratio), so the fit is
 * binary-searched against the real rendered height.
 */
const props = withDefaults(
  defineProps<{
    text: string
    /** Smallest readable size before the text is simply allowed to clip. */
    min?: number
    max?: number
  }>(),
  { min: 14, max: 160 }
)

const container = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const fontSize = ref(props.min)

// Dimensions the current font size was solved against, so a ResizeObserver
// callback that reports no real change costs nothing.
let fittedFor = ""

const fit = () => {
  const box = container.value
  const el = content.value
  if (!box || !el) return

  const maxHeight = box.clientHeight
  const maxWidth = box.clientWidth
  if (!maxHeight || !maxWidth || !props.text) {
    fittedFor = ""
    fontSize.value = props.min
    return
  }

  const signature = `${maxWidth}x${maxHeight}|${props.min}-${props.max}|${props.text}`
  if (signature === fittedFor) return
  fittedFor = signature

  let low = props.min
  let high = props.max
  let best = props.min

  // ~10 halvings lands within a fraction of a pixel of the largest size that
  // still fits, and each step is a single style write plus one layout read.
  for (let i = 0; i < 10 && high - low > 0.5; i++) {
    const mid = (low + high) / 2
    el.style.fontSize = `${mid}px`
    const fits = el.scrollHeight <= maxHeight && el.scrollWidth <= maxWidth
    if (fits) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  // Write the winning size straight to the node as well as the binding: the
  // search already left an intermediate size on the element, and waiting for
  // Vue's next patch to correct it would show a frame of the wrong size.
  const resolved = Math.floor(best)
  el.style.fontSize = `${resolved}px`
  fontSize.value = resolved
}

// The search itself is ~10 forced synchronous reflows, so it must never run
// more than once per frame — dragging a window edge fires the ResizeObserver
// far faster than that.
let queued = false
const scheduleFit = () => {
  if (queued) return
  queued = true
  nextTick(() =>
    requestAnimationFrame(() => {
      queued = false
      fit()
    })
  )
}

/** Forces the next scheduled fit to re-measure even if nothing observable changed. */
const refit = () => {
  fittedFor = ""
  scheduleFit()
}

let observer: ResizeObserver | null = null

onMounted(() => {
  scheduleFit()
  if (typeof ResizeObserver !== "undefined" && container.value) {
    observer = new ResizeObserver(scheduleFit)
    observer.observe(container.value)
  }
  // Web fonts land after first paint and change the measurement. The box and
  // the text are unchanged, so this has to bypass the signature check.
  ;(document as any)?.fonts?.ready?.then?.(refit)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(() => [props.text, props.min, props.max], scheduleFit)
</script>
