<template>
  <div
    class="bg-image-selection p-2 gap-2 grid grid-cols-4"
    :class="{ 'grid-cols-6': count === 6 }"
  >
    <UButton
      v-for="color in count === 6
        ? backgroundColors?.slice(0, 6)
        : backgroundColors"
      :key="color"
      @click="$emit('select', color)"
      class="w-[40px] h-[40px] p-0 text-black bg-cover transition-all overflow-hidden relative rounded-md"
      :class="{ 'w-[34px] h-[34px]': count === 6 }"
    >
      <div
        class="bg-image min-w-[40px] h-[40px] transition rounded-md opacity-100 hover:border-2 border-primary-500 bg-cover"
        :class="{
          'border-2': color === value,
          'min-w-[34px] h-[34px]': count === 6,
        }"
        :style="`background-color: ${color}`"
      ></div>
      <IconWrapper
        v-if="color === value"
        name="i-bx-check"
        size="5"
        :rounded-bg="true"
        class="absolute text-primary-500 scale-50 bottom-2 right-2"
        :class="{ 'bottom-0 right-0': count === 6 }"
      />
    </UButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
  count: number
}>()
const backgroundColors = [
  "#a855f7", // Purple
  "#3498db", // Blue
  "#d35400", // Dark Orange
  "#1abc9c", // Turquoise
  "#e74c3c", // Red
  "#34495e", // Dark Gray
  "#2ecc71", // Green
  "#e67e22", // Orange
  "#16a085", // Dark Green
  "#f1c40f", // Yellow
  "#e74c3c", // Dark Red
  "#2c3e50", // Gray
  "#2980b9", // Light Blue
  "#27ae60", // Dark Green
  "#8e44ad", // Dark Purple
  "#d35400", // Dark Orange
  "#f39c12", // Orange Yellow
]
</script>
