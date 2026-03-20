<template>
  <div class="audio-waveform flex items-center justify-center gap-0.5" :class="{ active }">
    <div
      v-for="i in bars"
      :key="i"
      class="waveform-bar rounded-full transition-all"
      :class="active ? 'bg-red-500 dark:bg-red-400' : 'bg-gray-300 dark:bg-gray-600'"
      :style="{
        animationDelay: `${(i - 1) * 0.1}s`,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  active?: boolean
  bars?: number
}

withDefaults(defineProps<Props>(), {
  active: false,
  bars: 5,
})
</script>

<style scoped>
.audio-waveform {
  height: 18px;
  min-width: 40px;
}

.waveform-bar {
  width: 3px;
  height: 4px;
  transition: all 0.2s ease;
}

.audio-waveform.active .waveform-bar {
  animation: wave 1.2s ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    height: 30%;
    opacity: 0.6;
  }
  50% {
    height: 100%;
    opacity: 1;
  }
}
</style>
