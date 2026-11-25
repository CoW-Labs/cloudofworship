<template>
  <!-- Drawn over a template's background on the projector only. Everything here
       moves with `transform` or `opacity`, so each frame stays on the graphics
       card; nothing animates a filter, a gradient or a shadow. Pieces are
       positioned on a 16:9 box that covers the slide the way the background
       picture does, so they line up with the art at any screen shape. -->
  <div
    ref="root"
    class="template-motion"
    aria-hidden="true"
    :data-kind="kind"
  >
    <div ref="stage" class="stage">
      <div class="art">
        <!-- AURORA: two glows wander behind the words -->
        <template v-if="kind === 'aurora'">
          <div class="l a-driftA" :style="blob('left:-18%;top:52%;width:62%', 'rgba(168,85,247,.7)', 'rgba(107,33,168,.2)')" />
          <div class="l a-driftB" :style="blob('right:-12%;top:-48%;width:52%', 'rgba(255,137,128,.42)', 'rgba(255,137,128,0)')" />
        </template>

        <!-- ORBIT: the circles of the series picture, each moving very slowly -->
        <template v-else-if="kind === 'orbit'">
          <div class="l" :style="ring(5, 106.67, 50)"><i class="fill a-drift" style="background: #8a41c9; opacity: 0.6; --t: 26s" /></div>
          <div class="l" :style="ring(80, 48.89, 77.5)"><i class="fill a-gentle line" style="--c: rgba(12, 15, 25, 0.1); --t: 16s" /></div>
          <div class="l" :style="ring(80, 48.89, 60)"><i class="fill a-spinBack dash" style="--c: rgba(12, 15, 25, 0.16); --t: 220s" /></div>
          <div class="l" :style="ring(80, 48.89, 42.5)"><i class="fill a-spin dash" style="--c: rgba(12, 15, 25, 0.22); --t: 160s" /></div>
          <div class="l" :style="ring(80, 48.89, 27.5)"><i class="fill a-gentle" style="background: #c084fc; --t: 12s" /></div>
        </template>

        <!-- RAYS: light turns slowly out of the corner sun -->
        <template v-else-if="kind === 'rays'">
          <div class="l" :style="ring(93.75, 95.6, 90)"><i class="fill a-spin rays" style="--t: 140s" /></div>
        </template>

        <!-- BREATHE: rings swell and settle on an eight second breath -->
        <template v-else-if="kind === 'breathe'">
          <div class="l" :style="ring(50, 50, 33.75)"><i class="fill a-breathe halo lilac" style="--o: 0.4" /></div>
          <div class="l" :style="ring(50, 50, 52.5)"><i class="fill a-breathe halo lilac" style="--o: 0.27; --d: -2.7s" /></div>
          <div class="l" :style="ring(50, 50, 73.75)"><i class="fill a-breathe halo lilac" style="--o: 0.18; --d: -5.3s" /></div>
        </template>

        <!-- CANDLE: a warm glow flickers while embers rise -->
        <template v-else-if="kind === 'candle'">
          <div class="l a-flicker" :style="blob('left:-12%;top:46%;width:124%', 'rgba(255,148,58,.42)', 'rgba(150,62,24,.14)')" />
        </template>

        <!-- RISE: two coloured glows sway while motes drift up -->
        <template v-else-if="kind === 'rise'">
          <div class="l a-sway" style="--t: 19s; left: -10%; top: 78%; width: 70%; height: 40%; border-radius: 50%; background: radial-gradient(closest-side, rgba(168, 85, 247, 0.34), transparent)" />
          <div class="l a-sway rev" style="--t: 25s; left: 34%; top: 82%; width: 76%; height: 44%; border-radius: 50%; background: radial-gradient(closest-side, rgba(96, 165, 250, 0.22), transparent)" />
        </template>

        <!-- PULSE: the circles in the corners and along the edge swell and settle -->
        <template v-else-if="kind === 'pulse'">
          <div class="l" :style="ring(7.5, 106.67, 50)"><i class="fill a-swell" style="background: #bfe6cb; --t: 11s" /></div>
          <div class="l" :style="ring(92.5, 11.11, 30)"><i class="fill a-swell" style="background: #cdeed8; --t: 8s; --d: -3s" /></div>
          <div class="l" :style="ring(97.5, 93.33, 20)"><i class="fill a-swell" style="background: #cdeed8; --t: 9.5s; --d: -6s" /></div>
        </template>

        <!-- PING: the panel's ring sends a ring outward when the verse changes -->
        <div v-else-if="kind === 'ping'" class="panel">
          <div class="l" :style="ring(8.75, 97.78, 37.5)">
            <i class="fill a-gentle ringline" style="--t: 14s" />
            <i ref="ping" class="fill ringline ping" />
          </div>
        </div>

        <!-- SETTLE: the sun and the corner circle drift inside two turning rings -->
        <template v-else-if="kind === 'settle'">
          <div class="l" :style="ring(11.25, 108.9, 52.5)"><i class="fill a-drift" style="background: #8a41c9; opacity: 0.6; --t: 28s" /></div>
          <div class="l" :style="ring(82.5, 20, 57.5)"><i class="fill a-bobSoft" style="background: #c084fc; opacity: 0.6" /></div>
          <div class="l" :style="ring(82.5, 20, 37.5)"><i class="fill a-spin dash" style="--c: rgba(12, 15, 25, 0.25); --t: 100s" /></div>
          <div class="l" :style="ring(82.5, 20, 70)"><i class="fill a-spinBack dash" style="--c: rgba(12, 15, 25, 0.14); --t: 150s" /></div>
        </template>

        <!-- DAYBREAK: one glow around the sun swells and settles, and the stars
             shift a little and come back. The rest of the picture stays put. -->
        <template v-else-if="kind === 'daybreak'">
          <div class="l" :style="ring(50, 80, 50)"><i class="fill a-swell" style="background: #ffe7a8; opacity: 0.16; --t: 9s" /></div>
          <div v-for="(s, i) in STARS" :key="i" class="l" :style="ring(s[0], s[1], 0.7)">
            <i class="fill a-glint" :style="`background:#fff;--t:${5 + i * 1.3}s;--d:${-i * 1.7}s;--x:${i % 2 ? -0.7 : 0.7}cqw;--y:${i % 3 ? 0.5 : -0.5}cqw`" />
          </div>
          <svg class="hills" viewBox="0 0 160 90" preserveAspectRatio="none">
            <path d="M0 74 Q40 62 80 72 T160 70 V90 H0Z" fill="#2a1143" />
            <path d="M0 80 Q50 70 100 80 T160 78 V90 H0Z" fill="#14091f" />
          </svg>
        </template>
      </div>

      <!-- Scattered pieces fill the whole slide, not the art box. -->
      <div v-if="pieces.length" class="field">
        <i
          v-for="(p, i) in pieces"
          :key="i"
          class="p"
          :class="pieceClass"
          :style="pieceStyle(p, i)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TemplateMotion } from "~/types"
import { motionPieces, surgePeak } from "~/utils/templates/motion"

const props = defineProps<{
  kind: TemplateMotion
  /** Goes up whenever the slide's words change, to react to the change. */
  pulse?: number
  /** When that last happened (performance.now), so a fresh slide reacts too. */
  pulseAt?: number
}>()

const root = ref<HTMLElement>()
const stage = ref<HTMLElement>()

// ── Pieces ──────────────────────────────────────────────────────────────────
const CONFETTI = ["#ff8980", "#a855f7", "#ffc94d", "#60a5fa", "#8a41c9", "#34d399"]

const pieces = computed(() => {
  switch (props.kind) {
    case "aurora":
      return motionPieces(9, 101, [0.5, 1.4], [3, 7])
    case "candle":
      return motionPieces(10, 202, [0.7, 1.6], [9, 18])
    case "rise":
      return motionPieces(12, 303, [0.5, 1], [9, 18])
    case "confetti":
      return motionPieces(18, 404, [1.3, 2.8], [6, 11])
    default:
      return []
  }
})

const pieceClass = computed(() =>
  props.kind === "aurora"
    ? "star"
    : props.kind === "confetti"
      ? "fall"
      : "rise"
)

const pieceStyle = (
  p: ReturnType<typeof motionPieces>[number],
  i: number
) => {
  const base = `left:${p.left}%;width:${p.size}cqw;--t:${p.duration}s;--d:${p.delay}s;--dx:${p.drift}cqw;--r:${p.spin}deg;`
  if (props.kind === "aurora")
    return `${base}top:${(p.left * 0.9).toFixed(1)}%;height:${p.size}cqw;border-radius:50%;background:#fff;`
  if (props.kind === "confetti")
    return `${base}top:-6cqh;height:${(p.size * 0.5).toFixed(2)}cqw;background:${CONFETTI[i % CONFETTI.length]};`
  return `${base}bottom:-3cqh;height:${p.size}cqw;border-radius:50%;background:${props.kind === "candle" ? "#ffb066" : "#d8c2ff"};`
}

// ── Shapes ──
/** Where the stars sit in the sunrise picture, in percent of the art box. */
const STARS: [number, number][] = [[11.25, 15.56], [27.5, 8.89], [75, 13.33], [91.25, 26.67], [60, 6.67]]
/** A circle centred at (cx, cy) percent of the art box, `d` percent of its width. */
const ring = (cx: number, cy: number, d: number) =>
  `width:${d}%;aspect-ratio:1;left:${(cx - d / 2).toFixed(2)}%;top:${(cy - (d / 2) * (16 / 9)).toFixed(2)}%;`

const blob = (place: string, from: string, to: string) =>
  `${place};aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,${from},${to} 55%,transparent);`

// ── Slide change: surge, then settle, with a small nudge ────────────────────
let frame = 0

const surge = () => {
  const loops = (root.value?.getAnimations({ subtree: true }) ?? []).filter(
    (a): a is CSSAnimation => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation
  )
  if (!loops.length) return
  const peaks = loops.map((a) => ({
    a,
    peak: surgePeak(Number(a.effect?.getTiming().duration) || 10000),
  }))
  const length = 1100
  const start = performance.now()
  cancelAnimationFrame(frame)
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / length)
    const ease = (1 - t) ** 3 // fast at first, then easing back to normal
    for (const o of peaks) o.a.updatePlaybackRate(1 + (o.peak - 1) * ease)
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

const ping = ref<HTMLElement>()
const sendPing = () =>
  ping.value?.animate?.(
    [
      { transform: "scale(1)", opacity: 0.9 },
      { transform: "scale(1.5)", opacity: 0 },
    ],
    { duration: 1500, easing: "cubic-bezier(.2,.7,.2,1)" }
  )

const nudge = () =>
  stage.value?.animate?.(
    [
      { transform: "scale(1) rotate(0deg)" },
      { transform: "scale(1.045) rotate(.6deg)", offset: 0.3 },
      { transform: "scale(1) rotate(0deg)" },
    ],
    { duration: 1000, easing: "cubic-bezier(.2,.7,.2,1)" }
  )

const react = () => {
  if (props.kind === "ping") return sendPing()
  surge()
  nudge()
}

onMounted(() => {
  // Put every loop on the page's clock, so one slide's motion carries on from
  // the last instead of starting over.
  for (const a of root.value?.getAnimations({ subtree: true }) ?? []) {
    if (typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation) a.startTime = 0
  }
  if (props.pulseAt && performance.now() - props.pulseAt < 600) react()
})

watch(
  () => props.pulse,
  (next, prev) => {
    if (next && next !== prev) react()
  }
)

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<style scoped>
.template-motion {
  position: absolute;
  inset: 0;
  pointer-events: none;
  container-type: size;
  contain: paint;
  overflow: hidden;
}
.stage {
  position: absolute;
  inset: 0;
}
/* The 16:9 box the background picture covers. */
.art {
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100cqw, 177.7778cqh);
  height: max(100cqh, 56.25cqw);
  transform: translate(-50%, -50%);
}
.field {
  position: absolute;
  inset: 0;
}
.l {
  position: absolute;
}
.fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.p {
  position: absolute;
  will-change: transform;
}
.dash {
  border: max(1px, 0.31cqw) dashed var(--c, rgba(12, 15, 25, 0.28));
}
.line {
  border: max(1px, 0.31cqw) solid var(--c, rgba(12, 15, 25, 0.1));
}
.hills {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.halo {
  border: 1px solid rgba(12, 15, 25, 0.25);
}
.halo.lilac {
  border-color: rgba(192, 132, 252, var(--o, 0.4));
}
.panel {
  position: absolute;
  inset: 0;
  /* The purple panel is the left 60 of the picture's 160. */
  clip-path: inset(0 62.5% 0 0);
}
.ringline {
  border: max(1px, 0.31cqw) solid rgba(255, 255, 255, 0.3);
}
.ping {
  opacity: 0;
}
.rays {
  border-radius: 0;
  background: repeating-conic-gradient(
    rgba(138, 65, 201, 0.15) 0 5deg,
    transparent 5deg 15deg
  );
  mask-image: radial-gradient(closest-side, #000 10%, transparent 100%);
  -webkit-mask-image: radial-gradient(closest-side, #000 10%, transparent 100%);
  will-change: transform;
}

@keyframes driftA {
  from { transform: translate3d(-6%, 4%, 0) scale(1); }
  to { transform: translate3d(10%, -8%, 0) scale(1.18); }
}
@keyframes driftB {
  from { transform: translate3d(8%, -4%, 0) scale(1.1); }
  to { transform: translate3d(-10%, 8%, 0) scale(0.92); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.9; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes spinBack {
  to { transform: rotate(-360deg); }
}
@keyframes breathe {
  0%, 100% { transform: scale(0.94); opacity: 0.55; }
  50% { transform: scale(1.07); opacity: 1; }
}
@keyframes flicker {
  0% { opacity: 0.82; transform: scale(1); }
  18% { opacity: 1; transform: scale(1.04); }
  31% { opacity: 0.88; }
  52% { opacity: 0.98; transform: scale(1.02); }
  70% { opacity: 0.8; transform: scale(0.99); }
  100% { opacity: 0.9; transform: scale(1.03); }
}
@keyframes rise {
  0% { transform: translate3d(0, 0, 0); opacity: 0; }
  15% { opacity: 0.9; }
  100% { transform: translate3d(var(--dx, 0), -108cqh, 0); opacity: 0; }
}
@keyframes sway {
  from { transform: translate3d(-7%, 0, 0); }
  to { transform: translate3d(7%, 0, 0); }
}
@keyframes gentle {
  from { transform: scale(0.98); }
  to { transform: scale(1.04); }
}
@keyframes drift {
  from { transform: translate3d(-3%, -2%, 0); }
  to { transform: translate3d(3%, 2%, 0); }
}
@keyframes bobSoft {
  from { transform: translate3d(0, 3%, 0) scale(1); }
  to { transform: translate3d(0, -3%, 0) scale(1.03); }
}
@keyframes swell {
  from { transform: scale(0.94); }
  to { transform: scale(1.1); }
}
@keyframes glint {
  from { transform: translate3d(0, 0, 0); opacity: 0.75; }
  to { transform: translate3d(var(--x, 0.6cqw), var(--y, -0.5cqw), 0); opacity: 0.35; }
}
@keyframes bob {
  from { transform: translate3d(0, 7%, 0) scale(1); }
  to { transform: translate3d(0, -4%, 0) scale(1.05); }
}
@keyframes fall {
  from { transform: translate3d(0, 0, 0) rotate(0); }
  to { transform: translate3d(var(--dx, 0), 118cqh, 0) rotate(var(--r, 360deg)); }
}

.a-driftA { animation: driftA 22s ease-in-out infinite alternate; will-change: transform; }
.a-driftB { animation: driftB 28s ease-in-out infinite alternate; will-change: transform; }
.a-spin { animation: spin var(--t, 90s) linear infinite; }
.a-spinBack { animation: spinBack var(--t, 120s) linear infinite; }
.a-breathe { animation: breathe 8s ease-in-out var(--d, 0s) infinite; }
.a-flicker { animation: flicker 5.3s ease-in-out infinite alternate; will-change: transform, opacity; }
.a-sway { animation: sway var(--t, 18s) ease-in-out infinite alternate; will-change: transform; }
.a-sway.rev { animation-direction: alternate-reverse; }
.a-swell { animation: swell var(--t, 10s) ease-in-out var(--d, 0s) infinite alternate; will-change: transform; }
.a-glint { animation: glint var(--t, 6s) ease-in-out var(--d, 0s) infinite alternate; }
.a-bob { animation: bob 14s ease-in-out infinite alternate; will-change: transform; }
.a-gentle { animation: gentle var(--t, 12s) ease-in-out infinite alternate; }
.a-drift { animation: drift var(--t, 26s) ease-in-out infinite alternate; will-change: transform; }
.a-bobSoft { animation: bobSoft var(--t, 14s) ease-in-out infinite alternate; will-change: transform; }
.p.star { animation: twinkle var(--t, 4s) ease-in-out var(--d, 0s) infinite; will-change: auto; }
.p.rise { animation: rise var(--t, 12s) linear var(--d, 0s) infinite; }
.p.fall { animation: fall var(--t, 8s) linear var(--d, 0s) infinite; }

/* A person who asks for less motion gets none. */
@media (prefers-reduced-motion: reduce) {
  .template-motion *,
  .template-motion *::before {
    animation: none !important;
  }
}
</style>
