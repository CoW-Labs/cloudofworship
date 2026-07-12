<template>
  <div class="cow-input" :class="attrs.class">
    <div
      class="cow-input__field"
      :class="[
        { 'cow-input__field--error': !!error },
        { 'cow-input__field--floated': floated },
        { 'cow-input__field--focused': focused },
      ]"
    >
      <label
        class="cow-input__label"
        :class="{ 'cow-input__label--float': floated }"
      >
        {{ label }}
      </label>

      <input
        :value="modelValue"
        :type="inputType"
        class="cow-input__control"
        v-bind="inputAttrs"
        @input="onInput"
        @focus="focused = true"
        @blur="onBlur"
      />

      <button
        v-if="type === 'password'"
        type="button"
        class="cow-input__toggle"
        tabindex="-1"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
        @click="showPassword = !showPassword"
      >
        <EyeIcon :off="!showPassword" class="w-5 h-5" />
      </button>
    </div>

    <div v-if="error" class="cow-input__error come-up-1">
      <span class="cow-input__error-text">
        <InfoIcon class="w-4 h-4" />
        {{ error }}
      </span>
      <slot name="hint" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: string
    error?: string
  }>(),
  {
    modelValue: "",
    type: "text",
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "blur"): void
}>()

const attrs = useAttrs()
const focused = ref(false)
const showPassword = ref(false)

const floated = computed(() => focused.value || !!props.modelValue)
const inputType = computed(() => {
  if (props.type === "password") return showPassword.value ? "text" : "password"
  return props.type
})

const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const onInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value)
}

const onBlur = () => {
  focused.value = false
  emit("blur")
}
</script>

<style scoped>
.cow-input__field {
  position: relative;
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.05rem 1rem 0.85rem;
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.1);
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.cow-input__field.cow-input__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.22);
}

.cow-input__control {
  display: block;
  width: 100%;
  border: none;
  outline: none;
  color: #0f172a !important;
  font-size: 15px;
  padding-right: 2rem;
  background-color: transparent !important;
}

.cow-input__control:disabled {
  opacity: 0.6;
}

.cow-input__control::placeholder {
  color: transparent;
}

.cow-input__field.cow-input__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.cow-input__field.cow-input__field--error,
.cow-input__field.cow-input__field--error.cow-input__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
  background-color: #fef2f2;
}

.cow-input__field--error .cow-input__label--float {
  background-color: #fef2f2;
}

.cow-input__label {
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
}

.cow-input__label--float {
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #475569;
  background-color: #ffffff;
}

.cow-input__field--error .cow-input__label {
  color: #ef4444;
}

.cow-input__toggle {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border-radius: 0.6rem;
  color: #64748b;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.cow-input__toggle:hover {
  color: #0f172a;
  background-color: rgba(15, 23, 42, 0.06);
}

.cow-input__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.55rem;
  font-size: 0.8rem;
}

.cow-input__error-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #ef4444;
}
</style>

<style>
html.dark .cow-input__field {
  background-color: #131a27;
  box-shadow: none;
}

html.dark .cow-input__field.cow-input__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.22);
}

html.dark .cow-input__control {
  color: #f8fafc !important;
}

html.dark .cow-input__field.cow-input__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}

html.dark .cow-input__field.cow-input__field--error,
html.dark .cow-input__field.cow-input__field--error.cow-input__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
  background-color: #2a1416;
}

html.dark .cow-input__field--error .cow-input__label--float {
  background-color: #2a1416;
}

html.dark .cow-input__label {
  color: #94a3b8;
}

html.dark .cow-input__label--float {
  color: #cbd5e1;
  background-color: #131a27;
}

html.dark .cow-input__toggle {
  color: #cbd5e1;
}

html.dark .cow-input__toggle:hover {
  color: #fff;
  background-color: rgba(148, 163, 184, 0.14);
}
</style>
