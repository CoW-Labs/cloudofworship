<template>
  <section class="settings-group">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0">
        <h3
          class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {{ title }}
          <slot name="badge" />
        </h3>
        <p
          v-if="note"
          class="mt-1 text-xs leading-relaxed text-gray-500 dark:text-[#9aa3b2]"
        >
          {{ note }}
        </p>
      </div>
      <div class="shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
// Section header + stacked rows, the standard shape of every panel inside the
// settings modal. Rows are supplied by the consumer (SettingsRow,
// SettingsSlider, or bespoke cards) and always sit in a gap-2 column so panels
// share one rhythm.
defineProps<{
  title: string
  note?: string
}>()
</script>
