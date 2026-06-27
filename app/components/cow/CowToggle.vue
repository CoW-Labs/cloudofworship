<template>
  <label class="cow-toggle" :class="{ 'cow-toggle--disabled': disabled }">
    <span class="cow-toggle__label">{{ label }}</span>

    <span class="cow-toggle__control">
      <input
        class="cow-toggle__input"
        type="checkbox"
        :name="name"
        :checked="modelValue"
        :disabled="disabled"
        :aria-label="`${label}: ${statusLabel}`"
        @change="onChange"
      />
      <span class="cow-toggle__switch" :title="statusLabel">
        <span class="cow-toggle__thumb" />
      </span>
    </span>
  </label>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    label: string
    name?: string
    trueLabel?: string
    falseLabel?: string
    disabled?: boolean
  }>(),
  {
    modelValue: true,
    name: "cow-toggle",
    trueLabel: "Yes",
    falseLabel: "No",
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
}>()

const statusLabel = computed(() =>
  props.modelValue ? props.trueLabel : props.falseLabel
)

const onChange = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.cow-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  background-color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1), 0 4px 0 0 #e2e8f0,
    0 10px 16px -10px rgba(15, 23, 42, 0.22);
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease,
    transform 0.08s ease;
}

.cow-toggle:hover {
  background-color: #f8fafc;
}

.cow-toggle:active:not(.cow-toggle--disabled) {
  transform: translateY(2px);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1), 0 2px 0 0 #e2e8f0,
    0 6px 12px -10px rgba(15, 23, 42, 0.22);
}

.cow-toggle--disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.cow-toggle__label {
  color: #334155;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.35;
}

.cow-toggle__control {
  display: inline-flex;
  flex-shrink: 0;
}

.cow-toggle__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.cow-toggle__switch {
  position: relative;
  display: inline-flex;
  width: 3.15rem;
  height: 1.7rem;
  border-radius: 999px;
  background-color: #d1d5db;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12), 0 3px 0 0 #cbd5e1,
    0 8px 12px -10px rgba(15, 23, 42, 0.35);
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.cow-toggle__thumb {
  position: absolute;
  top: 0.19rem;
  left: 0.2rem;
  width: 1.32rem;
  height: 1.32rem;
  border-radius: 999px;
  background-color: #ffffff;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.2);
  transition: transform 0.18s ease;
}

.cow-toggle__input:checked + .cow-toggle__switch {
  background-color: #a855f7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 3px 0 0 #7e22ce,
    0 10px 16px -10px rgba(126, 34, 206, 0.9);
}

.cow-toggle__input:checked + .cow-toggle__switch .cow-toggle__thumb {
  transform: translateX(1.43rem);
}

.cow-toggle__input:focus-visible + .cow-toggle__switch {
  outline: 2px solid #0f172a;
  outline-offset: 3px;
}
</style>

<style>
html.dark .cow-toggle {
  background-color: #1c2433;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 4px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6);
}

html.dark .cow-toggle:hover {
  background-color: #232c3d;
}

html.dark .cow-toggle:active:not(.cow-toggle--disabled) {
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 2px 0 0 #0d1320,
    0 8px 12px -10px rgba(0, 0, 0, 0.6);
}

html.dark .cow-toggle__label {
  color: #f8fafc;
}

html.dark .cow-toggle__switch {
  background-color: #475569;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3), 0 3px 0 0 #273244,
    0 8px 12px -10px rgba(0, 0, 0, 0.65);
}

html.dark .cow-toggle__input:focus-visible + .cow-toggle__switch {
  outline-color: #f8fafc;
}
</style>
