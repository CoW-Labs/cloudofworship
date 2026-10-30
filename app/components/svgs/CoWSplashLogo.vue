<template>
  <svg
    class="cow-splash"
    :style="{ '--cow-elapsed': `${bootElapsed}ms` }"
    viewBox="-5.845 3.686 74.04 58.45"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Cloud of Worship"
  >
    <!--
      The mark starts as one whole cloud. A cut draws down and across it, then
      widens past the gaps between the four pieces, so what is left is the
      logo with the cross showing the background through it. The cut is
      clipped to the cloud's outline, so every end of the cross finishes on
      the cloud's edge.
    -->
    <defs>
      <clipPath :id="`${uid}-cloud`">
        <path :d="CLOUD" />
      </clipPath>
      <radialGradient :id="`${uid}-glow`">
        <stop offset="0" class="glow-stop" />
        <stop offset="1" class="glow-stop glow-edge" />
      </radialGradient>
    </defs>

    <circle class="glow" cx="31.044" cy="24.8" r="30" :fill="`url(#${uid}-glow)`" />
    <g class="cloud">
      <path class="whole" :d="CLOUD" fill="currentColor" />
      <g class="cut" :clip-path="`url(#${uid}-cloud)`">
        <line class="stem" x1="31.044" y1="8" x2="31.044" y2="58" />
        <line class="arm" x1="31.044" y1="16.776" x2="8" y2="16.776" />
        <line class="arm" x1="31.044" y1="16.776" x2="54" y2="16.776" />
      </g>
      <!-- the same glow again, seen through the cross -->
      <circle
        class="glow"
        cx="31.044"
        cy="24.8"
        r="30"
        :fill="`url(#${uid}-glow)`"
        :clip-path="`url(#${uid}-cloud)`"
      />

      <path
        class="piece"
        d="M24.9414 18.5693C27.3305 18.5693 29.2676 20.5241 29.2676 22.9346V51.6934C29.2676 54.1038 27.3304 56.0576 24.9414 56.0576H7.83887C6.68045 55.3499 5.59165 54.4654 4.57324 53.4023C1.5265 50.2221 0.00189004 46.3349 0 41.7412C9.03507e-05 37.804 1.11045 34.2959 3.33105 31.2168C5.55181 28.1376 8.45784 26.1687 12.0488 25.3105C12.6857 22.8066 13.6666 20.5597 14.9902 18.5693H24.9414Z"
        fill="currentColor"
      />
      <path
        class="piece"
        d="M47.4082 18.5693C49.8241 22.1233 51.0327 26.2379 51.0312 30.9141C54.2914 31.318 56.9967 32.8203 59.1475 35.4209C61.2982 38.0215 62.3729 41.062 62.3711 44.543C62.3711 48.329 61.1311 51.548 58.6514 54.1992C57.9809 54.916 57.2708 55.5348 56.5225 56.0576H37.1465C34.7575 56.0576 32.8203 54.1038 32.8203 51.6934V22.9346C32.8203 20.5241 34.7575 18.5694 37.1465 18.5693H47.4082Z"
        fill="currentColor"
      />
      <path
        class="piece"
        d="M29.2676 10.6191C29.2676 13.0296 27.3305 14.9834 24.9414 14.9834H18.0391C18.3915 14.655 18.7572 14.3365 19.1367 14.0283C22.168 11.5671 25.5449 10.1587 29.2676 9.80273V10.6191Z"
        fill="currentColor"
      />
      <path
        class="piece"
        d="M32.8203 9.77539C37.237 10.1148 41.0837 11.8505 44.3623 14.9834H37.1465C34.7575 14.9834 32.8203 13.0296 32.8203 10.6191V9.77539Z"
        fill="currentColor"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
/*
 * The outer contour of the four pieces, with the three spots where the gaps
 * meet the edge bridged. All three sit on the top bump, a circle of radius
 * about 20.03, so arcs on that circle close them with no kink.
 */
const CLOUD =
  "M47.4082 18.5693C49.8241 22.1233 51.0327 26.2379 51.0312 30.9141C54.2914 31.318 56.9967 32.8203 59.1475 35.4209C61.2982 38.0215 62.3729 41.062 62.3711 44.543C62.3711 48.329 61.1311 51.548 58.6514 54.1992C57.9809 54.916 57.2708 55.5348 56.5225 56.0576H7.83887C6.68045 55.3499 5.59165 54.4654 4.57324 53.4023C1.5265 50.2221 0.00189004 46.3349 0 41.7412C0 37.804 1.11045 34.2959 3.33105 31.2168C5.55181 28.1376 8.45784 26.1687 12.0488 25.3105C12.6857 22.8066 13.6666 20.5597 14.9902 18.5693A20.03 20.03 0 0 1 18.0391 14.9834C18.3915 14.655 18.7572 14.3365 19.1367 14.0283C22.168 11.5671 25.5449 10.1587 29.2676 9.80273A20.03 20.03 0 0 1 32.8203 9.77539C37.237 10.1148 41.0837 11.8505 44.3623 14.9834A20.03 20.03 0 0 1 47.4082 18.5693Z"

// The operator layout and the livestream page can both mount a splash, so
// the clip and gradient ids must not collide.
const uid = `cow-splash-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

/*
 * The pre-hydration boot screen (spa-loading-template.html) plays this exact
 * sequence and stamps window.__cowBootAt. Offsetting every delay by how long
 * ago that was lets this component pick the animation up where the template
 * left off, instead of snapping back to frame zero when Nuxt mounts.
 */
const bootElapsed = (() => {
  if (!import.meta.client) return 0
  const bootAt = (window as any).__cowBootAt
  if (typeof bootAt !== "number") return 0
  // Past the end of the sequence everything is at rest, so clamping keeps a
  // later re-show (stale timestamp) from doing anything strange.
  return Math.min(Math.max(Date.now() - bootAt, 0), 2000)
})()
</script>

<style scoped>
/*
 * Splash sequence:
 *   1. the whole cloud fades up
 *   2. a hairline cut draws down it, then across it
 *   3. the cut widens into the cross, carving the four pieces apart
 *   4. a purple glow comes up behind the mark and pulses for the rest of the
 *      boot, seen around the cloud and through the cross
 *
 * The cut is stroked in the page background, so it reads as a hole. Its
 * final width (13) is the gap plus a corner radius on each side, which
 * uncovers the rounded corners of the pieces underneath.
 */
.cow-splash {
  display: block;
  /* let the glow bleed past the viewBox */
  overflow: visible;
  --cow-logo: #a855f7;
  --cow-bg: #ffffff;
  --cow-glow: #a855f7;
  --cow-glow-strength: 0.28;
  --cow-elapsed: 0ms;
  color: var(--cow-logo);
}

.dark .cow-splash {
  --cow-logo: #ffffff;
  --cow-bg: #131724;
  --cow-glow-strength: 0.5;
}

.glow-stop {
  stop-color: var(--cow-glow);
  stop-opacity: var(--cow-glow-strength);
}

.glow-edge {
  stop-opacity: 0;
}

/* fade the cloud as one layer, so the pieces never show through it */
.cloud {
  opacity: 0;
  animation: cloud-in 0.45s cubic-bezier(0.22, 1, 0.36, 1)
    calc(0s - var(--cow-elapsed)) forwards;
}

.cut {
  stroke: var(--cow-bg);
  stroke-linecap: butt;
}

.stem {
  stroke-width: 0.7;
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
  animation: cut-draw 0.4s cubic-bezier(0.5, 0, 0.2, 1)
      calc(0.35s - var(--cow-elapsed)) forwards,
    cut-open 0.6s cubic-bezier(0.3, 0, 0.2, 1)
      calc(0.85s - var(--cow-elapsed)) forwards;
}

.arm {
  stroke-width: 0.7;
  stroke-dasharray: 23;
  stroke-dashoffset: 23;
  animation: cut-draw 0.26s cubic-bezier(0.3, 0, 0.2, 1)
      calc(0.62s - var(--cow-elapsed)) forwards,
    cut-open 0.6s cubic-bezier(0.3, 0, 0.2, 1)
      calc(0.85s - var(--cow-elapsed)) forwards;
}

.glow {
  opacity: 0;
  animation: glow-in 0.6s ease-out calc(1.3s - var(--cow-elapsed)) forwards,
    glow-pulse 2.6s ease-in-out calc(1.9s - var(--cow-elapsed)) infinite;
}

@keyframes cloud-in {
  to {
    opacity: 1;
  }
}

@keyframes cut-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes cut-open {
  0% {
    stroke-width: 0.7;
  }
  40% {
    stroke-width: 3.6;
  }
  100% {
    stroke-width: 13;
  }
}

@keyframes glow-in {
  to {
    opacity: 0.7;
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cloud,
  .stem,
  .arm,
  .glow {
    animation: none;
  }

  .cloud {
    opacity: 1;
  }

  .stem,
  .arm {
    stroke-dashoffset: 0;
    stroke-width: 13;
  }

  .glow {
    opacity: 0.7;
  }
}
</style>
