<template>
  <!-- The sermon comes in as text, the verse in it is highlighted, and one
       click puts it on the Live Output. -->
  <div class="relative flex items-center gap-4 overflow-hidden px-5 pt-1" aria-hidden="true">
    <div class="flex w-[42%] shrink-0 items-start gap-2 text-[13px] leading-snug text-gray-800 dark:text-[#cfd5e1]">
      <UIcon
        name="i-bx-microphone"
        class="intro-mic mt-0.5 h-4 w-4 shrink-0 text-primary-500"
      />
      <p class="intro-line" :class="{ 'is-in': step >= 1 }">
        Turn with me to
        <span
          class="relative inline-flex items-center gap-0.5 font-medium text-primary-600 underline decoration-primary-400 decoration-1 underline-offset-2 dark:text-primary-400 dark:decoration-primary-500"
        >
          <UIcon name="i-bx-bible" class="text-xs" />John 3:16
          <IntroPointer
            class="left-[45%] top-[40%]"
            :state="step === 2 ? 'over' : step === 3 ? 'press' : 'hidden'"
          />
        </span>
      </p>
    </div>

    <IntroLiveOutput class="flex-1">
      <div
        class="absolute inset-0 transition-opacity duration-500"
        :class="live ? 'opacity-0' : 'opacity-100'"
        :style="{ background: PAIR_CARD_COLOUR }"
      />
      <div
        class="absolute inset-0 flex items-center justify-center bg-[#111827] px-[8cqw] text-center text-white transition-opacity duration-500"
        :class="live ? 'opacity-100' : 'opacity-0'"
      >
        <p class="text-[6cqw] font-semibold leading-snug">
          For God so loved the world
        </p>
      </div>
    </IntroLiveOutput>
  </div>
</template>

<script setup lang="ts">
import { PAIR_CARD_COLOUR } from "~/utils/slidePairs"

// Beats: listening, the verse is heard and highlighted, pointer on it, click
// (the verse goes live), the verse holds on air.
const { step } = useIntroLoop([900, 1400, 800, 400, 2800], 4)
const live = computed(() => step.value >= 3)
</script>

<style scoped>
.intro-line {
  opacity: 0;
  filter: blur(3px);
  transition:
    opacity 0.4s ease-out,
    filter 0.4s ease-out;
}
.intro-line.is-in {
  opacity: 1;
  filter: none;
}
.intro-mic {
  animation: intro-mic-pulse 1.6s ease-in-out infinite;
}
@keyframes intro-mic-pulse {
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .intro-mic {
    animation: none;
  }
}
</style>
