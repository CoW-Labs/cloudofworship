<template>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-y-0 left-0 w-7 transition-opacity duration-150"
    :class="[start ? 'opacity-100' : 'opacity-0', edgeClass]"
    :style="{ background: `linear-gradient(to right, ${color}, transparent)` }"
  />
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-y-0 right-0 w-7 transition-opacity duration-150"
    :class="[end ? 'opacity-100' : 'opacity-0', edgeClass]"
    :style="{ background: `linear-gradient(to left, ${color}, transparent)` }"
  />
</template>

<script setup lang="ts">
/**
 * Edge fades for a horizontal scroll strip, drawn over its ends in the colour
 * of whatever sits behind the content there. Place it inside a positioned
 * wrapper around the scroller (not inside the scroller, or it scrolls away).
 * Pair with `useScrollEdgeFade`.
 */
withDefaults(
  defineProps<{
    start?: boolean
    end?: boolean
    /** Any CSS colour, typically a `var(--…)` so it follows the theme. */
    color: string
    /** Extra classes for both edges, e.g. to clear a scrollbar. */
    edgeClass?: string
  }>(),
  { start: false, end: false, edgeClass: "" }
)
</script>
