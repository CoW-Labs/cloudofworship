<template>
  <!-- The editor's panel ground with the tiles on a card, as the Adjust
       panel and the background video picker are. -->
  <div
    class="camera-effect-picker flex w-[372px] flex-col gap-2 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200/70 dark:bg-[#131724] dark:ring-white/[0.06]"
  >
    <h3
      class="px-0.5 text-[12px] font-normal leading-[17px] text-gray-800 dark:text-[#F8F9FB]"
    >
      Camera effect
    </h3>
    <div
      class="grid grid-cols-3 gap-[8.5px] rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
    >
      <button
        v-for="effect in cameraEffects"
        :key="effect.value"
        type="button"
        class="group flex flex-col gap-1.5 text-left focus-visible:outline-none"
        :aria-pressed="modelValue === effect.value"
        @click="$emit('select', effect.value)"
      >
        <span
          class="tile relative block h-[68px] w-full overflow-hidden rounded-[4px] bg-[#0b0d16] transition-opacity group-hover:opacity-90 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-[-2px] group-focus-visible:outline-[#E8D1F8]"
          :class="`tile--${effect.value}`"
        >
          <svg
            viewBox="0 0 120 68"
            class="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <radialGradient :id="`stage-${effect.value}`" cx="0.45" cy="0.2" r="0.9">
                <stop offset="0" stop-color="#2a2350" />
                <stop offset="1" stop-color="#05060d" />
              </radialGradient>
              <g :id="`person-${effect.value}`">
                <circle cx="44" cy="25" r="7" />
                <path d="M30 68 C30 46 36 36 44 36 C52 36 58 46 58 68 Z" />
              </g>
            </defs>
            <rect width="120" height="68" :fill="`url(#stage-${effect.value})`" />

            <!-- Main character echo: fading copies with a red/cyan edge. -->
            <g v-if="effect.value === 'main-character-echo'" class="copies">
              <g class="copy copy--far" opacity="0.3">
                <use :href="`#person-${effect.value}`" x="45" fill="#ff4d5e" transform="translate(-1 0)" />
                <use :href="`#person-${effect.value}`" x="45" fill="#4de3ff" transform="translate(1 0)" />
                <use :href="`#person-${effect.value}`" x="45" fill="#ebe6f0" />
              </g>
              <g class="copy copy--near" opacity="0.55">
                <use :href="`#person-${effect.value}`" x="25" fill="#ff4d5e" transform="translate(-1 0)" />
                <use :href="`#person-${effect.value}`" x="25" fill="#4de3ff" transform="translate(1 0)" />
                <use :href="`#person-${effect.value}`" x="25" fill="#ebe6f0" />
              </g>
            </g>

            <use :href="`#person-${effect.value}`" fill="#ebe6f0" />

            <!-- Light leak: a burnt film frame screened over the picture. -->
            <g v-if="effect.value === 'light-leak'" class="leak" style="mix-blend-mode: screen">
              <rect class="leak-frame" x="18" y="-46" width="120" height="68" rx="6" fill="#ff9a3c" stroke="#c81e0a" stroke-width="6" />
              <rect x="34" y="0" width="0.8" height="68" fill="#ffe08a" opacity="0.8" />
              <rect x="88" y="0" width="0.6" height="68" fill="#ffe08a" opacity="0.6" />
              <rect x="97" y="10" width="0.6" height="40" fill="#ffe08a" opacity="0.7" />
            </g>
          </svg>
          <span
            v-if="modelValue === effect.value"
            class="pointer-events-none absolute inset-0 z-10 rounded-[4px] border-2 border-[#E8D1F8]"
          ></span>
        </span>
        <span
          class="truncate text-[12px] leading-[17px]"
          :class="
            modelValue === effect.value
              ? 'text-gray-900 dark:text-[#F8F9FB]'
              : 'text-gray-500 dark:text-[#9BA3B2]'
          "
        >
          {{ effect.label }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CameraEffect } from "~/types"
import { cameraEffects } from "~/utils/camera"

/**
 * Picks a camera slide's effect from a grid of tiles, laid out like the
 * background video picker. Each tile sketches its effect, and plays it on
 * hover as a video tile plays its clip.
 */
defineProps<{
  modelValue: CameraEffect
}>()

defineEmits<{
  select: [effect: CameraEffect]
}>()
</script>

<style scoped>
.copy {
  transition: transform 0.35s ease;
}
.group:hover .copy--near,
.group:focus-visible .copy--near {
  transform: translateX(4px);
}
.group:hover .copy--far,
.group:focus-visible .copy--far {
  transform: translateX(9px);
}

.leak-frame {
  transform: translateY(18px);
}
.group:hover .leak-frame,
.group:focus-visible .leak-frame {
  animation: leak-roll 1.1s steps(9) infinite;
}
@keyframes leak-roll {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(118px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .copy {
    transition: none;
  }
  .group:hover .leak-frame,
  .group:focus-visible .leak-frame {
    animation: none;
  }
}
</style>
