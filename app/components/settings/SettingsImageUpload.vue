<template>
  <div
    class="settings-image-upload"
    :class="{ 'settings-image-upload--vertical': vertical }"
  >
    <UAvatar
      :src="src || undefined"
      :text="fallbackText"
      size="3xl"
      class="shrink-0 bg-primary-50 dark:bg-[#222938]"
      :ui="{
        rounded: shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
        text: 'text-primary-600 dark:text-primary-300 font-semibold',
      }"
    />

    <div class="min-w-0" :class="{ 'w-full': vertical }">
      <div class="flex flex-wrap items-center gap-2">
        <CowButton
          variant="secondary"
          size="md"
          :loading="uploading"
          @click="fileInput?.click()"
        >
          {{ src ? "Change" : "Upload" }} {{ noun }}
        </CowButton>
        <CowButton
          v-if="src && removable"
          variant="secondary"
          size="md"
          :disabled="uploading"
          @click="$emit('remove')"
        >
          {{ removeLabel }}
        </CowButton>
      </div>
      <p
        class="mt-2 text-xs leading-relaxed"
        :class="
          error ? 'text-red-500' : 'text-gray-500 dark:text-[#9aa3b2]'
        "
      >
        {{ error || hintText }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="ACCEPTED_TYPES.join(',')"
      @change="onFileChosen"
    />
  </div>
</template>

<script setup lang="ts">
// A picture plus the buttons to change it, shared by the profile photo and the
// church logo. It only validates and hands the chosen file up; uploading and
// saving belong to the panel that owns the picture, so `uploading` is a prop.
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

const props = withDefaults(
  defineProps<{
    src?: string | null
    fallbackText?: string
    // What the picture is called in the buttons: "photo", "logo".
    noun?: string
    removeLabel?: string
    removable?: boolean
    uploading?: boolean
    shape?: "circle" | "square"
    hint?: string
    // Largest file accepted, in bytes.
    maxBytes?: number
    // Stacks the picture above its buttons, for a narrow side card.
    vertical?: boolean
  }>(),
  {
    noun: "photo",
    removeLabel: "Remove",
    removable: true,
    shape: "circle",
    maxBytes: 10 * 1024 * 1024,
  }
)

const emit = defineEmits<{
  (e: "upload", file: File): void
  (e: "remove"): void
}>()

const limitLabel = computed(() => {
  const mb = props.maxBytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
})
const hintText = computed(
  () => props.hint || `PNG, JPG or WebP, up to ${limitLabel.value}.`
)

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref("")

const onFileChosen = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so choosing the same file again still fires a change event.
  input.value = ""
  if (!file) return

  if (!ACCEPTED_TYPES.includes(file.type)) {
    error.value = "Choose a PNG, JPG or WebP image."
    return
  }
  if (file.size > props.maxBytes) {
    error.value = `That image is over ${limitLabel.value}. Choose a smaller one.`
    return
  }

  error.value = ""
  emit("upload", file)
}
</script>

<style scoped>
.settings-image-upload {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}

.settings-image-upload.settings-image-upload--vertical {
  flex-direction: column;
  text-align: center;
}

.settings-image-upload--vertical .flex-wrap {
  justify-content: center;
}
</style>
