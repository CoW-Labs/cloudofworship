<template>
  <svg
    class="cow-splash"
    :style="{ '--cow-elapsed': `${bootElapsed}ms` }"
    viewBox="682 356.75 76 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Cloud of Worship"
  >
    <!--
      The cross lives in the mark's negative space: a stem in the gap between
      the two halves, and a bar in the gap beneath the caps. It draws itself
      first, then the four pieces slide in on top and mask it down to exactly
      that gap, so the cross glows through the finished logo.
    -->
    <g class="cross-glow" aria-hidden="true">
      <line class="stem" x1="719.855" y1="363" x2="719.855" y2="407.5" />
      <line class="arm" x1="719.855" y1="370.185" x2="707.5" y2="370.185" />
      <line class="arm" x1="719.855" y1="370.185" x2="732.5" y2="370.185" />
    </g>
    <g class="cross">
      <line class="stem" x1="719.855" y1="363" x2="719.855" y2="407.5" />
      <line class="arm arm-left" x1="719.855" y1="370.185" x2="707.5" y2="370.185" />
      <line class="arm arm-right" x1="719.855" y1="370.185" x2="732.5" y2="370.185" />
    </g>

    <path
      class="piece body-left"
      d="M713.593 372.024C716.044 372.024 718.031 374.03 718.031 376.503V406.013C718.031 408.486 716.044 410.491 713.593 410.491H696.043C694.855 409.765 693.737 408.858 692.692 407.768C689.566 404.504 688.002 400.515 688 395.802C688 391.761 689.14 388.162 691.419 385.002C693.698 381.842 696.679 379.822 700.364 378.941C701.018 376.372 702.025 374.067 703.383 372.024H713.593Z"
      fill="currentColor"
    />
    <path
      class="piece body-right"
      d="M736.647 372.024C739.126 375.671 740.366 379.893 740.364 384.69C743.71 385.105 746.486 386.647 748.693 389.315C750.9 391.984 752.003 395.105 752.001 398.677C752.001 402.562 750.728 405.865 748.184 408.585C747.496 409.32 746.768 409.955 746 410.491H726.116C723.665 410.491 721.678 408.486 721.678 406.013V376.503C721.678 374.03 723.665 372.024 726.116 372.024H736.647Z"
      fill="currentColor"
    />
    <path
      class="piece cap-left"
      d="M718.031 363.866C718.031 366.34 716.044 368.345 713.593 368.345H706.512C706.873 368.008 707.247 367.68 707.637 367.364C710.747 364.839 714.212 363.395 718.031 363.029V363.866Z"
      fill="currentColor"
    />
    <path
      class="piece cap-right"
      d="M721.678 363C726.21 363.348 730.157 365.13 733.521 368.345H726.116C723.665 368.345 721.678 366.34 721.678 363.866V363Z"
      fill="currentColor"
    />
  </svg>
</template>

<script setup lang="ts">
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
 *   1. the cross draws itself — stem downward, then both arms out from centre
 *   2. the four pieces of the mark slide inward and close around it
 *   3. a blurred copy of the cross fades in and pulses for the rest of the boot
 *
 * The glow is a separate, statically blurred copy whose opacity animates. The
 * blur radius itself never changes, so the browser rasterises it once instead
 * of repainting it every frame.
 */
/*
 * The two tones swap between themes: on dark the mark is white and the cross
 * carries the brand purple; on light the mark is purple and the cross takes
 * the progress bar's unfilled track colour, so it reads as a near-white cross
 * cut into the mark.
 */
.cow-splash {
  display: block;
  /* let the cross glow bleed past the viewBox */
  overflow: visible;
  --cow-logo: #a855f7;
  --cow-cross: #e6e8ef;
  --cow-elapsed: 0ms;
  color: var(--cow-logo);
}

.dark .cow-splash {
  --cow-logo: #ffffff;
  --cow-cross: #a855f7;
}

.cross,
.cross-glow {
  stroke: var(--cow-cross);
  stroke-linecap: butt;
}

/* stroke widths match the gaps in the mark exactly */
.stem {
  stroke-width: 3.647;
  stroke-dasharray: 45;
  stroke-dashoffset: 45;
  animation: cross-draw 0.4s cubic-bezier(0.4, 0, 0.2, 1)
    calc(0s - var(--cow-elapsed)) forwards;
}

.arm {
  stroke-width: 3.679;
  stroke-dasharray: 13;
  stroke-dashoffset: 13;
  animation: cross-draw 0.28s cubic-bezier(0.4, 0, 0.2, 1)
    calc(0.26s - var(--cow-elapsed)) forwards;
}

.cross-glow {
  opacity: 0;
  filter: blur(2px);
  animation: glow-in 0.6s ease-out calc(1.05s - var(--cow-elapsed)) forwards,
    glow-pulse 2.6s ease-in-out calc(1.65s - var(--cow-elapsed)) infinite;
}

.piece {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: piece-in 0.5s cubic-bezier(0.22, 1, 0.36, 1)
    calc(0.48s - var(--cow-elapsed)) forwards;
}

.body-left {
  --tx: -10px;
}

.body-right {
  --tx: 10px;
}

.cap-left {
  --tx: -7px;
  --ty: -7px;
  animation-delay: calc(0.58s - var(--cow-elapsed));
}

.cap-right {
  --tx: 7px;
  --ty: -7px;
  animation-delay: calc(0.64s - var(--cow-elapsed));
}

@keyframes cross-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes piece-in {
  0% {
    opacity: 0;
    transform: translate(var(--tx, 0px), var(--ty, 0px));
  }
  100% {
    opacity: 1;
    transform: translate(0px, 0px);
  }
}

@keyframes glow-in {
  to {
    opacity: 0.55;
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 0.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stem,
  .arm,
  .cross-glow,
  .piece {
    animation: none;
  }

  .stem,
  .arm {
    stroke-dashoffset: 0;
  }

  .cross-glow {
    opacity: 0.55;
  }

  .piece {
    opacity: 1;
  }
}
</style>
