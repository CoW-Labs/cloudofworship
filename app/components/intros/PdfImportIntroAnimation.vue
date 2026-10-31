<template>
  <!-- A PDF opens out into one slide per page. -->
  <div
    class="relative flex items-center justify-center overflow-hidden px-5 py-6"
    aria-hidden="true"
  >
    <div class="relative w-[60%]" style="aspect-ratio: 16 / 9">
      <div
        v-for="(page, i) in PAGES"
        :key="i"
        class="intro-pdf-page absolute inset-0 rounded-md shadow-md"
        :class="{ 'is-spread': spread }"
        :style="{
          background: page,
          '--spread-x': `${(i - 1) * 52}%`,
          '--stack-y': `${(1 - i) * 4}px`,
          zIndex: PAGES.length - i,
          transitionDelay: spread ? `${i * 120}ms` : '0ms',
        }"
      />
      <!-- The PDF badge on the top page, gone once the pages are slides. -->
      <span
        class="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#e5484d] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white transition-opacity duration-300"
        :class="spread ? 'opacity-0' : 'opacity-100'"
      >
        PDF
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PAIR_CARD_COLOUR } from "~/utils/slidePairs"

// Page colours, as a church's exported deck might have.
const PAGES = [PAIR_CARD_COLOUR, "#f6e7c8", "#1f2937"]

// Beats: the PDF as one stacked file, then its pages spread out as slides.
const { step } = useIntroLoop([1600, 3000], 1)
const spread = computed(() => step.value === 1)
</script>

<style scoped>
.intro-pdf-page {
  transform: translateY(var(--stack-y)) scale(0.62);
  transition: transform 0.7s cubic-bezier(0.65, 0, 0.35, 1);
}
.intro-pdf-page.is-spread {
  transform: translateX(var(--spread-x)) scale(0.48);
}
</style>
