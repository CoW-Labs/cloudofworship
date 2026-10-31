<template>
  <!-- Click the camera slide and the Live Output cuts to the feed. -->
  <div class="relative flex items-center gap-4 overflow-hidden px-5 pt-1" aria-hidden="true">
    <!-- The camera slide, styled like its schedule placeholder. -->
    <div
      class="relative w-[30%] shrink-0 overflow-hidden rounded-lg ring-2 transition-[box-shadow] duration-300"
      :class="
        live
          ? 'ring-[#f04438]'
          : step === 1
            ? 'ring-primary-300 dark:ring-[#E8D1F8]'
            : 'ring-transparent'
      "
      style="aspect-ratio: 16 / 9"
    >
      <div
        class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950"
      >
        <CameraIcon class="h-6 w-6 text-white/60" />
      </div>
      <IntroPointer
        class="left-[45%] top-[45%]"
        :state="step === 1 ? 'over' : step === 2 ? 'press' : 'hidden'"
      />
    </div>

    <IntroLiveOutput class="flex-1">
      <div
        class="absolute inset-0 transition-opacity duration-500"
        :class="live ? 'opacity-0' : 'opacity-100'"
        :style="{ background: PAIR_CARD_COLOUR }"
      />
      <div
        class="absolute inset-0 transition-opacity duration-500"
        :class="live ? 'opacity-100' : 'opacity-0'"
      >
        <IntroCameraFeed />
      </div>
    </IntroLiveOutput>
  </div>
</template>

<script setup lang="ts">
import CameraIcon from "~/components/svgs/CameraIcon.vue"
import { PAIR_CARD_COLOUR } from "~/utils/slidePairs"

// Beats: another slide on air, pointer reaches the camera, click (camera cuts
// in), camera holds on air.
const { step } = useIntroLoop([1500, 900, 500, 3000], 3)
const live = computed(() => step.value >= 2)
</script>
