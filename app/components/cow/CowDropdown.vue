<template>
  <div class="cow-dd">
    <div
      class="cow-dd__field"
      :class="[
        { 'cow-dd__field--error': !!error },
        { 'cow-dd__field--floated': floated },
        { 'cow-dd__field--focused': focused },
      ]"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <label class="cow-dd__label" :class="{ 'cow-dd__label--float': floated }">
        {{ label }}
      </label>

      <USelectMenu
        :model-value="modelValue"
        :options="options"
        :searchable="searchable"
        variant="none"
        size="lg"
        class="cow-dd__menu"
        :ui="menuUi"
        :ui-menu="menuPanelUi"
        v-bind="$attrs"
        @update:model-value="emit('update:modelValue', $event)"
      >
        <template #label>
          <span v-if="hasValue" class="truncate">{{ modelValue }}</span>
          <span v-else>&nbsp;</span>
        </template>
      </USelectMenu>
    </div>

    <div v-if="error" class="cow-dd__error come-up-1">
      <span class="cow-dd__error-text">
        <InfoIcon class="w-4 h-4" />
        {{ error }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    options?: string[]
    placeholder?: string
    error?: string
    searchable?: boolean
  }>(),
  {
    modelValue: "",
    options: () => [],
    searchable: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const focused = ref(false)

const hasValue = computed(() => !!props.modelValue?.length)
const floated = computed(() => focused.value || hasValue.value)

const menuUi = {
  base: "relative block w-full text-left",
  rounded: "rounded-none",
  ring: "ring-0",
  shadow: "",
  variant: {
    none: "bg-transparent dark:bg-transparent focus:ring-0",
  },
  padding: {
    lg: "px-0 py-0",
  },
}

const menuPanelUi = {
  rounded: "rounded-xl",
  ring: "ring-1 ring-gray-100 dark:ring-gray-700/70",
  shadow: "shadow-lg",
  background: "bg-white dark:bg-[#131a27]",
  option: {
    rounded: "rounded-lg",
    padding: "px-3 py-2.5",
    active: "bg-gray-100 dark:bg-gray-800/60",
  },
}
</script>

<style scoped>
.cow-dd__field {
  position: relative;
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.05rem 1rem 0.85rem;
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.1);
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.cow-dd__field.cow-dd__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.22);
}

.cow-dd__field.cow-dd__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.cow-dd__field.cow-dd__field--error,
.cow-dd__field.cow-dd__field--error.cow-dd__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

.cow-dd__field :deep(button) {
  font-size: 15px;
  color: #0f172a;
  background-color: transparent !important;
}

.cow-dd__placeholder {
  color: #64748b;
}

.cow-dd__label {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.95rem;
  pointer-events: none;
  padding: 0 0.3rem;
  background-color: transparent;
  transition: all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
}

.cow-dd__label--float {
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #475569;
  background-color: #ffffff;
}

.cow-dd__field--error .cow-dd__label {
  color: #ef4444;
}

.cow-dd__error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.55rem;
  font-size: 0.8rem;
}

.cow-dd__error-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #ef4444;
}
</style>

<style>
html.dark .cow-dd__field {
  background-color: #131a27;
  box-shadow: none;
}

html.dark .cow-dd__field.cow-dd__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.22);
}

html.dark .cow-dd__field.cow-dd__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}

html.dark .cow-dd__field.cow-dd__field--error,
html.dark .cow-dd__field.cow-dd__field--error.cow-dd__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

html.dark .cow-dd__field button {
  color: #f8fafc;
}

html.dark .cow-dd__placeholder {
  color: #94a3b8;
}

html.dark .cow-dd__label {
  color: #94a3b8;
}

html.dark .cow-dd__label--float {
  color: #cbd5e1;
  background-color: #131a27;
}
</style>
