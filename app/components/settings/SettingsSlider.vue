<template>
  <SettingsRow
    :label="label"
    :description="description"
    :disabled="disabled"
    stacked
  >
    <template #badge>
      <slot name="badge" />
    </template>

    <div class="flex items-center gap-3 w-full">
      <span class="settings-slider__bound">{{ formatted(min) }}</span>
      <CoWSlider
        :model-value="draft"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :aria-label="label"
        class="flex-1"
        @update:model-value="onInput"
        @change="onChange"
      />
      <span class="settings-slider__bound">{{ formatted(max) }}</span>
      <span class="settings-slider__value">{{ formatted(draft) }}</span>
    </div>
  </SettingsRow>
</template>

<script setup lang="ts">
// Slider row with min/max bounds and a live value readout.
//
// `draft` tracks the handle while it is being dragged so the readout stays
// responsive even for consumers that only persist on `change` (release) —
// the pattern the settings panels use to avoid writing to the store on every
// pointer move.
const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    modelValue?: number
    min?: number
    max?: number
    step?: number
    suffix?: string
    disabled?: boolean
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: 100,
    step: 1,
    suffix: "",
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void
  (e: "change", value: number): void
}>()

// Settings can come back from localStorage as strings, so coerce anything the
// caller hands us to a finite number before it reaches `.toFixed`/the slider.
// Values saved under an older, wider range also survive in stored settings, so
// clamp too — the native input pins its handle to min/max regardless, and an
// unclamped readout would disagree with where the handle actually sits.
const toNumber = (value: unknown): number => {
  const num = Number(value)
  if (!Number.isFinite(num)) return props.min
  return Math.min(props.max, Math.max(props.min, num))
}

const draft = ref<number>(toNumber(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    draft.value = toNumber(value)
  }
)

// Trim the float noise a 0.1-step range produces (1.2000000000000002 → 1.2).
const formatted = (value: number) =>
  `${Number(toNumber(value).toFixed(2))}${props.suffix}`

const onInput = (value: number) => {
  draft.value = value
  emit("update:modelValue", value)
}

const onChange = () => emit("change", draft.value)
</script>

<style scoped>
.settings-slider__bound {
  color: #64748b;
  font-size: 0.72rem;
  white-space: nowrap;
}

.settings-slider__value {
  min-width: 3.25rem;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  background-color: rgba(168, 85, 247, 0.12);
  color: #7e22ce;
  font-size: 0.72rem;
  font-weight: 650;
  text-align: center;
  white-space: nowrap;
}
</style>

<style>
html.dark .settings-slider__bound {
  color: #9aa3b2;
}

html.dark .settings-slider__value {
  background-color: rgba(168, 85, 247, 0.2);
  color: #e8d1f8;
}
</style>
