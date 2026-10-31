<template>
  <!-- A drawn camera feed for intro animations: the preacher at the pulpit,
       on the same picture gradient the pair layout thumbnails use. -->
  <div class="intro-camera-feed absolute inset-0 overflow-hidden" :style="{ background: PICTURE }">
    <svg
      class="absolute inset-0 h-full w-full"
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="intro-feed-light" cx="50%" cy="38%" r="45%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="90" fill="url(#intro-feed-light)" />
      <g class="intro-camera-feed__preacher">
        <circle cx="80" cy="38" r="10" fill="#2a2433" />
        <path d="M54 92 C54 62 66 52 80 52 C94 52 106 62 106 92 Z" fill="#2a2433" />
      </g>
      <rect x="60" y="68" width="40" height="24" rx="2" :fill="PAIR_CARD_COLOUR" />
      <rect x="60" y="68" width="40" height="3" rx="1.5" fill="#6b3a8c" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { PAIR_CARD_COLOUR } from "~/utils/slidePairs"

const PICTURE = "linear-gradient(160deg, #9cc7e8 0%, #c9895f 55%, #5b6b7a 100%)"
</script>

<style scoped>
.intro-camera-feed__preacher {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: intro-preacher-sway 3.2s ease-in-out infinite;
}
@keyframes intro-preacher-sway {
  0%,
  100% {
    transform: rotate(-2deg) translateX(-1px);
  }
  50% {
    transform: rotate(2deg) translateX(1px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .intro-camera-feed__preacher {
    animation: none;
  }
}
</style>
