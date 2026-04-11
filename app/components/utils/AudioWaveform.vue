<template>
  <!-- Mic volume progress bar (fills based on loudness) -->
  <div
    class="absolute inset-0 -top-2 overflow-hidden bg-primary-200 dark:bg-primary-700/50 w-full max-h-[4px]"
  >
    <div
      class="absolute inset-y-0 left-0 bg-red-500 dark:bg-red-400 transition-[width] duration-75 ease-out"
      :style="{ width: `${micLevel}%` }"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  active?: boolean
  bars?: number
  micLevel?: number
}

withDefaults(defineProps<Props>(), {
  active: false,
  bars: 5,
  micLevel: 0,
})
</script>
