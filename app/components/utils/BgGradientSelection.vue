<template>
  <div
    class="bg-gradient-selection p-2 gap-2 grid"
    :class="{
      'grid-cols-6': count === 6,
      'grid-cols-12': count === 12,
      'grid-cols-7': !count,
    }"
  >
    <UButton
      v-for="gradient in count === 6
        ? backgroundGradients?.slice(0, 6)
        : backgroundGradients"
      :key="gradient"
      @click="$emit('select', { gradient })"
      class="w-[40px] h-[40px] p-0 text-black bg-cover transition-all overflow-hidden relative rounded-md"
      :class="{ 'w-[34px] h-[34px]': count === 6 }"
    >
      <div
        class="bg-gradient min-w-[40px] h-[40px] transition rounded-md opacity-100 hover:border-2 border-primary-500 bg-cover"
        :class="{
          'border-2': gradient === value,
          'min-w-[34px] h-[34px]': count === 6,
        }"
        :style="`background-image: ${gradient}`"
      ></div>
      <IconWrapper
        v-if="gradient === value"
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
  value?: string
  count?: number
}>()

// Each entry is a ready-to-use CSS gradient value. It is stored on
// `slide.background` and rendered via `background-image` (see useSlideBackground).
const backgroundGradients = [
  // Row 1 — warm/vivid diagonals
  "linear-gradient(135deg, #f97316 0%, #a855f7 50%, #3b82f6 100%)",
  "linear-gradient(135deg, #a3e635 0%, #65a30d 100%)",
  "linear-gradient(160deg, #7c3aed 0%, #2e1065 100%)",
  "linear-gradient(120deg, #64748b 0%, #cbd5e1 45%, #334155 100%)",
  "linear-gradient(135deg, #ca8a04 0%, #713f12 100%)",
  "linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)",
  "linear-gradient(160deg, #0f766e 0%, #1e3a5f 100%)",
  // Row 2 — moody / cool
  "linear-gradient(180deg, #134e4a 0%, #0f172a 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #64748b 100%)",
  "linear-gradient(135deg, #db2777 0%, #7c3aed 100%)",
  "linear-gradient(90deg, #ef4444 0%, #22c55e 100%)",
  "linear-gradient(135deg, #7f1d1d 0%, #1e40af 100%)",
  "linear-gradient(135deg, #f9a8d4 0%, #be185d 100%)",
  "linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 100%)",
  // Row 3 — bright pops
  "linear-gradient(135deg, #fb7185 0%, #9f1239 100%)",
  "linear-gradient(135deg, #86efac 0%, #14b8a6 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
  "linear-gradient(180deg, #1e3a8a 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #fbbf24 0%, #0d9488 100%)",
  "linear-gradient(180deg, #1e3a8a 0%, #14b8a6 100%)",
  "linear-gradient(135deg, #d946ef 0%, #7e22ce 100%)",
  // Row 4 — soft/simple
  "linear-gradient(135deg, #f472b6 0%, #9f1239 100%)",
  "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
]
</script>
