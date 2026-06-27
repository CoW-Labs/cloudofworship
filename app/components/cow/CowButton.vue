<template>
  <UButton
    :color="color"
    variant="solid"
    :block="block"
    :loading="loading"
    :disabled="disabled"
    :type="type"
    :size="size"
    :ui="buttonUi"
    class="cow-button"
    :class="`cow-button--${variant}`"
    v-bind="$attrs"
  >
    <slot />
  </UButton>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary"
    block?: boolean
    loading?: boolean
    disabled?: boolean
    type?: "button" | "submit" | "reset"
    size?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl"
  }>(),
  {
    variant: "primary",
    type: "button",
    size: "lg",
  }
)

const color = computed(() => (props.variant === "primary" ? "primary" : "gray"))

const buttonUi = {
  rounded: "rounded-full",
  font: "font-semibold",
  base: "justify-center gap-2.5 disabled:cursor-not-allowed",
  size: {
    lg: "text-[15px]",
  },
  padding: {
    lg: "px-5 py-3.5",
  },
}
</script>

<style scoped>
.cow-button {
  position: relative;
  transition: transform 0.08s ease, box-shadow 0.08s ease,
    background-color 0.2s ease;
  will-change: transform;
}

/* Primary — purple with a darker bottom ledge that compresses on press */
.cow-button--primary {
  color: #fff !important;
  background-color: #a855f7 !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 5px 0 0 #7e22ce,
    0 12px 18px -8px rgba(126, 34, 206, 0.9);
}

.cow-button--primary:hover {
  background-color: #9f4ff5 !important;
}

.cow-button--primary:active:not(:disabled) {
  transform: translateY(4px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 0 0 #7e22ce,
    0 4px 8px -6px rgba(126, 34, 206, 0.6);
}

/* Secondary — neutral surface with a subtle ledge, light + dark */
.cow-button--secondary {
  color: #0f172a !important;
  background-color: #ffffff !important;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 4px 0 0 #e2e8f0,
    0 10px 16px -10px rgba(15, 23, 42, 0.25);
}

.cow-button--secondary:hover {
  background-color: #f8fafc !important;
}

.cow-button--secondary:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 1px 0 0 #e2e8f0;
}

.cow-button:disabled {
  transform: none !important;
}
</style>

<style>
html.dark .cow-button--secondary {
  color: #f8fafc !important;
  background-color: #1c2433 !important;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 4px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6);
}

html.dark .cow-button--secondary:hover {
  background-color: #232c3d !important;
}

html.dark .cow-button--secondary:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 1px 0 0 #0d1320;
}
</style>
