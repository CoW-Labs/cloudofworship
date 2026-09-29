<template>
  <div
    ref="root"
    class="intermission-view"
    :class="{ 'is-static': isStatic }"
    :style="{ backgroundColor: variant.palettes[0].bg }"
  >
    <canvas ref="canvas" class="intermission-canvas" aria-hidden="true" />
    <!-- One text layer per palette. During a palette drop the incoming layer
         is clipped to the same circle the canvas wipes with, so the text
         changes colour with the background instead of after it. -->
    <div
      v-for="(palette, i) in variant.palettes"
      :key="i"
      :ref="(el) => (layers[i] = el as HTMLElement | null)"
      class="intermission-text"
      :class="{ 'with-background': textBackgroundOn }"
      :style="{
        '--ix-ink': palette.ink,
        '--ix-plate': palette.plate,
        '--ix-chip-bg': palette.chipBg,
        '--ix-chip-ink': palette.chipInk,
      }"
    >
      <div class="intermission-heading">
        <span class="intermission-heading-inner">{{ heading }}</span>
      </div>
      <div v-if="subtitle" class="intermission-sub">
        <span class="intermission-chip">{{ subtitle }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IntermissionSlideData, Slide } from "~/types"
import {
  STATIC_FRAME_T,
  TEXT_MOTION,
  getIntermissionVariant,
  renderIntermissionFrame,
  scrimAmount,
  textMotion,
  textPulse,
  wipeRadius,
  type FrameState,
  type WipeState,
} from "~/utils/intermission/engine"
import {
  intermissionExitKey,
  intermissionModeKey,
  type IntermissionExitSignal,
  type IntermissionRenderMode,
} from "~/utils/intermission/context"

const props = defineProps<{
  slide: Slide
  /** Overrides the injected mode, e.g. to animate one hovered thumbnail. */
  mode?: IntermissionRenderMode
}>()

const injectedMode = inject(intermissionModeKey, "static")
const exitSignal = inject(
  intermissionExitKey,
  ref<IntermissionExitSignal | null>(null)
)
const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
const mode = computed(() =>
  reduceMotion ? "static" : props.mode ?? toValue(injectedMode)
)
const isStatic = computed(() => mode.value === "static")

const data = computed(
  () => props.slide?.data as IntermissionSlideData | undefined
)
const variant = computed(() => getIntermissionVariant(data.value?.variant))
const heading = computed(() => data.value?.heading ?? "")
const subtitle = computed(() => data.value?.subtitle?.trim() ?? "")
const textBackgroundOn = computed(() => {
  const choice = data.value?.textBackground ?? "auto"
  return choice === "on" || (choice === "auto" && variant.value.textBackground)
})

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const layers: (HTMLElement | null)[] = []

let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let density = 1
let raf = 0
let lastFrameAt = 0

// Adaptive resolution. Machines that can't keep up (often a laptop with no
// GPU canvas acceleration) draw the canvas at a lower resolution instead of
// dropping frames. Text is DOM, so it stays sharp at every step.
const QUALITY_STEPS = [1, 0.75, 0.5]
const QUALITY_WINDOW = 30 // frames per judgement
let quality = 0 // index into QUALITY_STEPS
let qualityCeiling = 0 // best step this machine has held; never retried above
let windowFrames: number[] = []
let windowCount = 0
let smoothWindows = 0
let lastStepUpWindow = -Infinity
let refreshMs = 1000 / 60

const judgeFrame = (dt: number) => {
  // A tab coming back from the background, not a slow frame.
  if (dt <= 0 || dt > 500) return
  refreshMs = Math.max(6, Math.min(refreshMs, dt))
  windowFrames.push(dt)
  if (windowFrames.length < QUALITY_WINDOW) return
  // Hold 60fps on the projector (a 120Hz display need not reach 120) and
  // the 30fps cap in previews.
  const target =
    mode.value === "preview" ? 1000 / 30 : Math.max(refreshMs, 1000 / 60)
  const slowShare =
    windowFrames.filter((t) => t > target * 1.5).length / windowFrames.length
  windowFrames = []
  windowCount++
  if (slowShare > 0.25 && quality < QUALITY_STEPS.length - 1) {
    // Stepping up and failing straight away means this machine can't hold
    // that level: stop trying it, so quality settles instead of bouncing.
    if (windowCount - lastStepUpWindow <= 2) qualityCeiling = quality + 1
    quality++
    smoothWindows = 0
    resize()
  } else if (slowShare < 0.05) {
    // About five smooth seconds before trying the next step up.
    if (++smoothWindows >= 10 && quality > qualityCeiling) {
      quality--
      smoothWindows = 0
      lastStepUpWindow = windowCount
      resize()
    }
  } else smoothWindows = 0
}
let visible = true
// The slide's own clock. Text enter/exit times are on the same clock.
let startedAt = performance.now()
let textIn = 0
let textOut: number | null = null
const elapsed = () => (performance.now() - startedAt) / 1000

const applyText = (T: number, S: FrameState, wipe: WipeState) => {
  const head = textMotion(T, textIn, textOut, 0)
  const sub = textMotion(T, textIn, textOut, TEXT_MOTION.subLag)
  const { punch, bob } = textPulse(S, wipe)
  const maxBlur = width * TEXT_MOTION.blur
  const clip = wipe.wp > 0 ? `circle(${wipeRadius(wipe.wp, S)}px at 50% 50%)` : ""

  layers.forEach((layer, i) => {
    if (!layer) return
    const headEl = layer.children[0] as HTMLElement | undefined
    const subEl = layer.children[1] as HTMLElement | undefined
    if (headEl) {
      headEl.style.opacity = String(head.o)
      headEl.style.filter =
        head.b > 0.002 ? `blur(${(head.b * maxBlur).toFixed(1)}px)` : "none"
      headEl.style.transform = `translateY(${bob}cqw) scale(${
        head.s * (1 + punch)
      })`
    }
    if (subEl) {
      subEl.style.opacity = String(sub.o)
      subEl.style.filter =
        sub.b > 0.002 ? `blur(${(sub.b * maxBlur * 0.7).toFixed(1)}px)` : "none"
      subEl.style.transform = `scale(${sub.s})`
    }
    const isBase = i === wipe.base
    const isTop = wipe.wp > 0 && i === wipe.top
    layer.style.visibility = isBase || isTop ? "visible" : "hidden"
    layer.style.zIndex = isTop ? "2" : "1"
    layer.style.clipPath = isTop ? clip : "none"
  })
}

const draw = (T: number) => {
  if (!ctx || !width || !height) return
  ctx.setTransform(density, 0, 0, density, 0, 0)
  if (isStatic.value) {
    renderIntermissionFrame(ctx, width, height, T, variant.value, 1)
    return
  }
  const scrim = scrimAmount(T, textIn, textOut)
  const { S, wipe } = renderIntermissionFrame(
    ctx,
    width,
    height,
    T,
    variant.value,
    scrim
  )
  applyText(T, S, wipe)
}

const frame = (ts: number) => {
  raf = requestAnimationFrame(frame)
  // Previews share the operator window with everything else; 30fps is plenty.
  if (mode.value === "preview" && ts - lastFrameAt < 1000 / 30 - 2) return
  judgeFrame(ts - lastFrameAt)
  lastFrameAt = ts
  draw(elapsed())
}

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
const start = () => {
  if (raf || isStatic.value || !visible) return
  // A pause (scrolled away, hidden) is not a slow frame.
  windowFrames = []
  lastFrameAt = 0
  raf = requestAnimationFrame(frame)
}

const resize = () => {
  const el = root.value
  const cv = canvas.value
  if (!el || !cv) return
  width = el.clientWidth
  height = el.clientHeight
  // The projector gets 1x: a 16:9 output is 1080p or less, and 2x would
  // quadruple the fill work for no visible gain.
  const baseDensity =
    mode.value === "live" ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
  const scale = variant.value.renderScale ?? 1
  density = isStatic.value
    ? baseDensity * scale
    : baseDensity * scale * QUALITY_STEPS[quality]!
  el.dataset.quality = String(QUALITY_STEPS[quality])
  cv.width = Math.max(1, Math.round(width * density))
  cv.height = Math.max(1, Math.round(height * density))
  if (isStatic.value) draw(STATIC_FRAME_T)
  else if (!raf) draw(elapsed())
}

// Static frames rely on the stylesheet; drop what the animation left inline.
const clearTextStyles = () => {
  // Only the properties applyText sets: the layers also carry Vue-bound
  // palette variables that must stay.
  layers.forEach((layer) => {
    if (!layer) return
    for (const prop of ["visibility", "z-index", "clip-path"])
      layer.style.removeProperty(prop)
    Array.from(layer.children).forEach((el) => {
      for (const prop of ["opacity", "filter", "transform"])
        (el as HTMLElement).style.removeProperty(prop)
    })
  })
}

const restart = () => {
  startedAt = performance.now()
  textIn = 0
  textOut = null
  if (isStatic.value) draw(STATIC_FRAME_T)
}

// A new variant replays its intro so the operator sees what they picked.
watch(
  () => data.value?.variant,
  () => {
    // Variants can draw at different resolutions (renderScale).
    resize()
    restart()
  }
)
// Going from a still frame to animated plays the intro from the start.
watch(mode, (next, prev) => {
  stop()
  if (next === "static") clearTextStyles()
  else if (prev === "static") {
    startedAt = performance.now()
    textIn = 0
    textOut = null
  }
  resize()
  start()
})
watch(exitSignal, (signal) => {
  if (!signal || signal.id !== props.slide?.id) return
  if (signal.exiting && textOut === null) textOut = elapsed()
  else if (!signal.exiting && textOut !== null) {
    textIn = elapsed() - TEXT_MOTION.inAt + 0.05
    textOut = null
  }
})

let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

onMounted(() => {
  ctx = canvas.value?.getContext("2d") ?? null
  resizeObserver = new ResizeObserver(resize)
  if (root.value) resizeObserver.observe(root.value)
  resize()
  if (mode.value === "preview" && root.value) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      if (visible) start()
      else stop()
    })
    intersectionObserver.observe(root.value)
  }
  start()
})

onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
})
</script>

<style scoped>
.intermission-view {
  position: absolute;
  inset: 0;
  overflow: hidden;
  container-type: inline-size;
  isolation: isolate;
  /* Global slide text settings (outline, alignment, case) inherit into
     descendants; the intermission sets its own type. */
  text-align: center;
  text-shadow: none;
  text-transform: none;
}
.intermission-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.intermission-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.4cqw;
  padding: 0 7cqw;
  pointer-events: none;
}
.intermission-heading,
.intermission-sub {
  opacity: 0;
  will-change: transform, filter, opacity;
}
.intermission-heading {
  color: var(--ix-ink);
  font-family: "Unbounded", "Geist", ui-sans-serif, system-ui, sans-serif;
  font-weight: 800;
  font-size: 7.2cqw;
  line-height: 1.02;
  letter-spacing: -0.035em;
  text-wrap: balance;
  transform-origin: 50% 55%;
}
.intermission-heading-inner {
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  padding: 0 0.12em;
}
.with-background .intermission-heading-inner {
  background: var(--ix-plate);
}
.intermission-sub {
  font-family: "Geist", ui-sans-serif, system-ui, sans-serif;
  font-weight: 600;
  font-size: 2.2cqw;
  line-height: 1;
  letter-spacing: 0.01em;
}
.intermission-chip {
  display: inline-block;
  background: var(--ix-chip-bg);
  color: var(--ix-chip-ink);
  padding: 0.6em 1.15em;
  border-radius: 999px;
}

/* Thumbnails and reduced motion: one settled frame, first palette only. */
.is-static .intermission-heading,
.is-static .intermission-sub {
  opacity: 1;
  will-change: auto;
}
.is-static .intermission-text + .intermission-text {
  display: none;
}
</style>
