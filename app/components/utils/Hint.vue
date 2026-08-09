<template>
  <div class="hint rounded-xl bg-gray-100 px-4 py-3 dark:bg-[#2B3140]">
    <slot name="icon">
      <LightbulbIcon class="h-8 w-8 text-gray-900 dark:text-[#F8F9FB]" />
    </slot>
    <p
      v-if="title"
      class="mt-2 text-[12px] font-semibold leading-[17px] text-gray-900 dark:text-[#F8F9FB]"
    >
      {{ title }}
    </p>
    <div
      class="text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
      :class="title ? 'mt-0.5' : 'mt-2'"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// An inline tip: lightbulb over the body copy. `title` is optional — without it
// this is exactly the design, and the icon alone carries the "hint" meaning.
defineProps<{
  title?: string
}>()
</script>
