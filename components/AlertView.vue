<template>
  <!-- 1 char = 0.25s -->
  <Transition name="fade-sm">
    <div
      v-if="activeAlert"
      class="marquee w-[100%] absolute font-bold flex come-up-1"
      :style="`background: ${activeAlert.background}`"
      :class="activeAlert.style"
    >
      <IconWrapper
        :name="activeAlert.icon"
        class="bg-primary-900 z-10 px-[1.5vw]"
        size="8"
      />
      <div class="inner" :style="`animation-duration: ${animationDuration}`">
        {{ activeAlert?.title }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Alert } from "~/types"
const appStore = useAppStore()

const { alerts, activeAlert } = storeToRefs(appStore)
const animationDuration = computed(() => {
  // 1 char = 0.25s - Standard Calc
  return `${activeAlert.value?.title.length}s`
})
</script>
