<template>
  <div
    :class="
      roundedBg
        ? `icon-bg bg-primary-50 dark:bg-primary-900 rounded-full flex items-center justify-center p-2 max-h-${
            size + 4
          } icon`
        : 'flex'
    "
  >
    <UIcon
      :name="name"
      :class="`w-${size} h-${size} max-w-${size} max-h-${size} ${
        animate ? 'animate-ping' : ''
      } ${darkText ? 'dark:text-primary-950' : ''}`"
      dynamic
    />
  </div>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: String,
    default: "6",
  },
  name: String,
  roundedBg: Boolean,
  animate: Boolean,
  darkText: Boolean,
})
</script>
