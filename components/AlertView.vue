<template>
  <!-- 1 char = 0.25s -->
  <Transition name="fade-sm">
    <div
      v-if="currentState?.activeAlert"
      class="marquee w-[100%] absolute font-bold flex come-up-1"
      :style="`background: ${currentState?.activeAlert.background}`"
      :class="[
        currentState?.activeAlert.style,
        {
          'h-[15px]': props.size === 'sm',
        },
      ]"
    >
      <IconWrapper
        :name="currentState?.activeAlert.icon"
        class="bg-primary-900 z-10"
        :class="props.size === 'sm' ? 'px-2' : 'px-[1.5vw]'"
        :size="props.size === 'sm' ? 2 : 8"
      />
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
  return `${currentState.value?.activeAlert.title.length}s`
})
</script>
