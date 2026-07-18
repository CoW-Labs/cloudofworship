<template>
  <!-- 1 char = 0.25s -->
  <Transition name="fade-sm">
    <div
      v-if="currentState?.activeAlert"
      class="marquee w-[100%] absolute font-bold flex come-up-1 z-20"
      :style="`background: ${currentState?.activeAlert.background}`"
      :class="[
        currentState?.activeAlert.style,
        {
          'h-[15px]': props.size === 'sm',
        },
      ]"
    >
      <div
        class="bg-primary-900 z-10 self-stretch aspect-square shrink-0 flex items-center justify-center px-4"
      >
        <InfoIcon :class="props.size === 'sm' ? 'w-2 h-2' : 'w-8 h-8'" />
      </div>
      <div
        class="inner"
        :style="`animation-duration: ${animationDuration}`"
        :class="{
          'text-2xs': props.size === 'sm',
        }"
      >
        {{ currentState?.activeAlert?.title }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Alert } from "~/types"
const appStore = useAppStore()

const props = defineProps<{
  size?: string
}>()

const { currentState } = storeToRefs(appStore)
const animationDuration = computed(() => {
  // 1 char = 0.25s - Standard Calc
  // Speed multiplier: lower value = slower, higher value = faster
  const baseSpeed = currentState.value?.activeAlert?.title.length || 10
  const speedMultiplier = currentState.value?.activeAlert?.speed || 1
  // Invert speed: speed of 2 should be faster (shorter duration), speed of 0.5 should be slower (longer duration)
  return `${baseSpeed / speedMultiplier}s`
})
</script>
