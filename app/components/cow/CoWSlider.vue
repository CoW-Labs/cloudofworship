<template>
  <input
    class="cow-slider"
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :style="`--cow-slider-progress: ${progress}%`"
    @input="onInput"
  />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void
}>()

const progress = computed(() => {
  const range = props.max - props.min
  if (range <= 0) return 0

  const value = Math.min(props.max, Math.max(props.min, props.modelValue))
  return ((value - props.min) / range) * 100
})

const onInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).valueAsNumber)
}
</script>

<style scoped>
.cow-slider {
  --cow-slider-active: #a855f7;
  --cow-slider-track: #e2e8f0;
  --cow-slider-thumb: #ffffff;

  display: block;
  width: 100%;
  height: 12px;
  margin: 0;
  appearance: none;
  cursor: pointer;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--cow-slider-active) 0%,
    var(--cow-slider-active) var(--cow-slider-progress),
    var(--cow-slider-track) var(--cow-slider-progress),
    var(--cow-slider-track) 100%
  );
}

.cow-slider::-webkit-slider-runnable-track {
  height: 12px;
  border-radius: 999px;
  background: transparent;
}

.cow-slider::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -1px;
  appearance: none;
  border: 1px solid rgb(15 23 42 / 10%);
  border-radius: 999px;
  background: var(--cow-slider-thumb);
  box-shadow: 0 1px 3px rgb(15 23 42 / 20%);
}

.cow-slider::-moz-range-track {
  height: 12px;
  border-radius: 999px;
  background: transparent;
}

.cow-slider::-moz-range-progress {
  background: transparent;
}

.cow-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 1px solid rgb(15 23 42 / 10%);
  border-radius: 999px;
  background: var(--cow-slider-thumb);
  box-shadow: 0 1px 3px rgb(15 23 42 / 20%);
}

.cow-slider:focus-visible {
  outline: 2px solid #a855f7;
  outline-offset: 2px;
}

.cow-slider:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>

<style>
html.dark .cow-slider {
  --cow-slider-track: rgb(255 255 255 / 7%);
  --cow-slider-thumb: #f8f9fb;

  border-color: rgb(255 255 255 / 7%);
}

html.dark .cow-slider:focus-visible {
  outline-color: #e8d1f8;
}
</style>
