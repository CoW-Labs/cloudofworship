<template>
  <template v-for="i in count" :key="i">
    <div
      v-if="variant === 'row'"
      class="flex items-start gap-3 px-3 py-2.5 min-h-[54px] border-t first:border-t-0 border-white/80 dark:border-[#171d2b]"
    >
      <USkeleton class="w-5 h-5 rounded-full shrink-0 cow-skeleton" :ui="skeletonUi" />
      <div class="texts min-w-0 flex-1">
        <USkeleton class="h-3.5 w-1/3 rounded cow-skeleton" :ui="skeletonUi" />
        <USkeleton class="h-3 w-4/5 rounded mt-2 cow-skeleton" :ui="skeletonUi" />
      </div>
    </div>

    <USkeleton
      v-else
      class="w-[100%] mt-2 cow-skeleton"
      :ui="skeletonUi"
      :style="{ height: `${height}px` }"
    />
  </template>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "row" | "block"
    count?: number
    height?: number
  }>(),
  {
    variant: "row",
    count: 15,
    height: 80,
  }
)

const skeletonUi = {
  base: "relative overflow-hidden animate-pulse",
  background: "bg-gray-300 dark:bg-gray-600/80",
  rounded: "rounded-md",
}
</script>

<style scoped>
.cow-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  animation: cow-skeleton-shimmer 1.3s ease-in-out infinite;
}

html.dark .cow-skeleton::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.22),
    transparent
  );
}

@keyframes cow-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
