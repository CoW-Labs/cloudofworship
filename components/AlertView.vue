<template>
  <!-- 1 char = 0.25s -->
  <Transition name="fade-sm">
    <div
      v-if="alert"
      class="marquee w-[100%] absolute font-bold flex come-up-1"
      :style="`background: ${alert.background}`"
      :class="alert.style"
    >
      <IconWrapper
        :name="alert.icon"
        class="bg-primary-900 z-10 px-[1.5vw]"
        size="8"
      />
      <div class="inner" :style="`animation-duration: ${animationDuration}`">
        {{ alert?.title }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()

const { alert } = storeToRefs(appStore)
const animationDuration = computed(() => {
  // 1 char = 0.25s - Standard Calc
  return `${alert.value?.title.length}s`
})
</script>
