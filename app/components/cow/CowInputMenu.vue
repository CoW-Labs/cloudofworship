<template>
  <div class="cow-im">
    <div
      class="cow-im__field"
      :class="[
        { 'cow-im__field--error': !!error },
        { 'cow-im__field--floated': floated },
        { 'cow-im__field--focused': focused },
      ]"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <label class="cow-im__label" :class="{ 'cow-im__label--float': floated }">
        {{ label }}
      </label>

      <UInputMenu
        :model-value="selectedOption"
        :options="options"
        :placeholder="floated ? placeholder : undefined"
        variant="none"
        size="lg"
        class="cow-im__menu"
        :ui="menuUi"
        :ui-menu="menuPanelUi"
        v-bind="$attrs"
        @update:model-value="onSelect"
        @update:query="typedQuery = $event"
      >
        <!-- Slots are not forwarded automatically. `option-empty` is the one
             that matters here: it's what a caller shows when nothing matched. -->
        <template v-if="$slots['option-empty']" #option-empty="slotProps">
          <slot name="option-empty" v-bind="slotProps" />
        </template>
      </UInputMenu>
    </div>

    <div v-if="error" class="cow-im__error come-up-1">
      <span class="cow-im__error-text">
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
  }>(),
  {
    modelValue: "",
    options: () => [],
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

const focused = ref(false)

// UInputMenu tracks the typed query and the picked option separately, so we
// reconcile them here and hand callers a single string. Typed text wins while
// the user is typing; on selection the component blanks its own query, so the
// selection takes over on its own — no ordering guard needed.
const typedQuery = ref("")
const selectedOption = ref(props.modelValue)

const resolved = computed(() => typedQuery.value.trim() || selectedOption.value)

const onSelect = (option: string | null) => {
  selectedOption.value = option || ""
  typedQuery.value = ""
}

watch(resolved, (value) => {
  if (value !== props.modelValue) emit("update:modelValue", value)
})

// Adopt values set from outside (prefill, reset) and drop any stale typing.
watch(
  () => props.modelValue,
  (value) => {
    if (value === resolved.value) return
    selectedOption.value = value || ""
    typedQuery.value = ""
  }
)

const hasValue = computed(() => !!resolved.value.length)
const floated = computed(() => focused.value || hasValue.value)

const menuUi = {
  base: "relative block w-full text-left border-0",
  rounded: "rounded-none",
  ring: "ring-0",
  shadow: "",
  variant: {
    none: "bg-transparent dark:bg-transparent focus:ring-0 focus:shadow-none",
  },
  padding: {
    lg: "px-0 py-0",
  },
  // The field already provides its own right-hand padding, so the chevron sits
  // flush against the inner edge instead of the default inset.
  trailing: {
    padding: {
      lg: "pe-6",
    },
  },
  icon: {
    trailing: {
      padding: {
        lg: "px-0",
      },
    },
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
    empty: "text-sm text-gray-500 dark:text-gray-400 px-3 py-2.5",
  },
}
</script>

<style scoped>
.cow-im__field {
  position: relative;
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.05rem 1rem 0.85rem;
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.1);
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.cow-im__field.cow-im__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.22);
}

.cow-im__field.cow-im__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.cow-im__field.cow-im__field--error,
.cow-im__field.cow-im__field--error.cow-im__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

.cow-im__field :deep(input) {
  font-size: 15px;
  color: #0f172a;
  background-color: transparent !important;
}

.cow-im__label {
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

.cow-im__label--float {
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #475569;
  background-color: #ffffff;
}

.cow-im__field--error .cow-im__label {
  color: #ef4444;
}

.cow-im__error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.55rem;
  font-size: 0.8rem;
}

.cow-im__error-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #ef4444;
}
</style>

<style>
html.dark .cow-im__field {
  background-color: #131a27;
  box-shadow: none;
}

html.dark .cow-im__field.cow-im__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.22);
}

html.dark .cow-im__field.cow-im__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}

html.dark .cow-im__field.cow-im__field--error,
html.dark .cow-im__field.cow-im__field--error.cow-im__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

html.dark .cow-im__field input {
  color: #f8fafc;
}

html.dark .cow-im__label {
  color: #94a3b8;
}

html.dark .cow-im__label--float {
  color: #cbd5e1;
  background-color: #131a27;
}
</style>
