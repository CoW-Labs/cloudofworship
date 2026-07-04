<template>
  <div class="cow-textarea" :class="attrs.class">
    <div
      class="cow-textarea__field"
      :class="[
        { 'cow-textarea__field--error': !!error },
        { 'cow-textarea__field--floated': floated },
        { 'cow-textarea__field--focused': focused },
      ]"
    >
      <label
        class="cow-textarea__label"
        :class="{ 'cow-textarea__label--float': floated }"
      >
        {{ label }}
      </label>

      <textarea
        ref="textareaEl"
        :value="modelValue"
        :rows="rows"
        class="cow-textarea__control"
        v-bind="inputAttrs"
        @input="onInput"
        @focus="focused = true"
        @blur="onBlur"
      />
    </div>

    <div v-if="error" class="cow-textarea__error come-up-1">
      <span class="cow-textarea__error-text">
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
    error?: string
    rows?: number
    autoresize?: boolean
  }>(),
  {
    modelValue: "",
    rows: 6,
    autoresize: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "blur"): void
}>()

const attrs = useAttrs()
const focused = ref(false)
const textareaEl = ref<HTMLTextAreaElement>()

const floated = computed(() => focused.value || !!props.modelValue)

const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const resize = () => {
  if (!props.autoresize || !textareaEl.value) return
  textareaEl.value.style.height = "auto"
  textareaEl.value.style.height = `${textareaEl.value.scrollHeight}px`
}

const onInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value)
  resize()
}

const onBlur = () => {
  focused.value = false
  emit("blur")
}

onMounted(resize)
watch(() => props.modelValue, () => nextTick(resize))
</script>

<style scoped>
.cow-textarea__field {
  position: relative;
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.05rem 1rem 0.85rem;
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.1);
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.cow-textarea__field.cow-textarea__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.22);
}

.cow-textarea__control {
  display: block;
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  color: #0f172a !important;
  font-size: 15px;
  font-family: inherit;
  background-color: transparent !important;
}

.cow-textarea__control:disabled {
  opacity: 0.6;
}

.cow-textarea__control::placeholder {
  color: transparent;
}

.cow-textarea__field.cow-textarea__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.cow-textarea__field.cow-textarea__field--error,
.cow-textarea__field.cow-textarea__field--error.cow-textarea__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

.cow-textarea__label {
  position: absolute;
  left: 1rem;
  top: 1.05rem;
  color: #64748b;
  font-size: 0.95rem;
  pointer-events: none;
  padding: 0 0.3rem;
  background-color: transparent;
  transition: all 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.cow-textarea__label--float {
  top: 0;
  left: 0.75rem;
  transform: translateY(-50%);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  color: #475569;
  background-color: #ffffff;
}

.cow-textarea__field--error .cow-textarea__label {
  color: #ef4444;
}

.cow-textarea__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.55rem;
  font-size: 0.8rem;
}

.cow-textarea__error-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #ef4444;
}
</style>

<style>
html.dark .cow-textarea__field {
  background-color: #131a27;
  box-shadow: none;
}

html.dark .cow-textarea__field.cow-textarea__field--floated {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.22);
}

html.dark .cow-textarea__control {
  color: #f8fafc !important;
}

html.dark .cow-textarea__field.cow-textarea__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}

html.dark .cow-textarea__field.cow-textarea__field--error,
html.dark
  .cow-textarea__field.cow-textarea__field--error.cow-textarea__field--focused {
  box-shadow: inset 0 0 0 1.75px rgba(239, 68, 68, 0.9);
}

html.dark .cow-textarea__label {
  color: #94a3b8;
}

html.dark .cow-textarea__label--float {
  color: #cbd5e1;
  background-color: #131a27;
}
</style>
