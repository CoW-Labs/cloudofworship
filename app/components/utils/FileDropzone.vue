<template>
  <label
    class="dropzone flex cursor-pointer flex-col items-center justify-center text-center"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    :class="
      backgroundPanel
        ? [
            'min-h-0 rounded-[8px] border border-dashed border-gray-300 bg-white p-0 text-gray-700 transition-colors dark:border-[#505866] dark:bg-transparent dark:text-[#F8F9FB]',
            isDragOver
              ? 'border-gray-500 bg-gray-100 dark:border-[#9BA3B2] dark:bg-white/[0.03]'
              : 'hover:border-gray-500 dark:hover:border-[#9BA3B2]',
          ]
        : [
            'min-h-[200px] rounded-lg border-2 border-dashed border-primary-200 p-6 py-8',
            {
              'border-primary-500 bg-primary-50 dark:bg-primary-900':
                isDragOver,
              'hover:border-primary-400 transition-colors': !isDragOver,
              'min-h-[100px] p-2': size === 'sm',
            },
          ]
    "
  >
    <input
      type="file"
      :accept="accept"
      :multiple="multiple"
      @change="onFileSelect"
      hidden
    />

    <template v-if="backgroundPanel">
      <UIcon
        :name="icon"
        class="mb-4 h-7 w-7 text-gray-400 dark:text-[#9BA3B2]"
      />
      <p class="max-w-[140px] text-[12px] font-normal leading-[17px]">
        <span
          v-for="line in backgroundDescriptionLines"
          :key="line"
          class="block"
        >
          {{ line }}
        </span>
      </p>
    </template>

    <template v-else>
      <IconWrapper
        :name="icon"
        :size="size === 'sm' ? '7' : '12'"
        :class="[
          size === 'sm' ? 'w-[100px] mb-4 py-4' : 'py-6 mb-8 w-full',
        ]"
        rounded-bg
      ></IconWrapper>
      <div class="texts">
        <p class="mb font-medium">
          <span class="text-md">Drag &amp; Drop</span> or
          <span class="text-md">Click to select</span>
        </p>
        <p
          v-if="size !== 'sm'"
          class="text-sm mb-6"
          :class="{ 'text-xs': size === 'sm' }"
        >
          {{ description }}
        </p>
      </div>
    </template>
  </label>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

const props = defineProps({
  size: {
    type: String,
    default: "lg",
  },
  maxFileSize: {
    type: Number,
    default: 3, // Images only (MB)
  },
  maxVideoFileSize: {
    type: Number,
    default: Infinity,
  },
  icon: {
    type: String,
    default: "i-bx-image",
  },
  accept: {
    type: String,
    default: "",
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  description: {
    type: String,
    default: "image, video or audio files.",
  },
  backgroundPanel: {
    type: Boolean,
    default: false,
  },
})
const backgroundDescriptionLines = computed(() => {
  const [firstLine, secondLine] = props.description.split(" or ")
  return secondLine ? [`${firstLine} or`, secondLine] : [props.description]
})
const toast = useToast()
const isDragOver = ref(false)
const emit = defineEmits(["change"])

const onDragOver = () => {
  isDragOver.value = true
}

const onDragLeave = () => {
  isDragOver.value = false
}

const onDrop = (event: DragEvent) => {
  isDragOver.value = false
  handleFiles(event.dataTransfer?.files || [])
}

const onFileSelect = (event: Event) => {
  handleFiles((event?.target as HTMLInputElement).files || [])
  ;(event.target as HTMLInputElement).value = ""
}

const handleFiles = (selectedFiles: FileList | File[]) => {
  // Emit only the newly-selected files; the parent owns the canonical list.
  // Holding state here caused removed files to reappear on the next drop, and
  // re-processing of already-handled files in single-shot consumers.
  const validFiles: File[] = []
  for (const file of Array.from(selectedFiles)) {
    if (isFileSizeExceeded(file)) {
      validFiles.push(file)
    }
  }
  if (validFiles.length > 0) {
    emit("change", validFiles)
  }
}

// Returns true when the file is within limits, false (with a toast) when it exceeds them
const isFileSizeExceeded = (file: File) => {
  if (
    file.type.startsWith("image") &&
    file.size > props.maxFileSize * 1024 * 1024
  ) {
    toast.add({
      title: `Image size exceeds ${props.maxFileSize}MB`,
      icon: "i-bx-info-circle",
      color: "red",
    })
    return false
  }
  if (
    file.type.startsWith("video") &&
    file.size > props.maxVideoFileSize * 1024 * 1024
  ) {
    toast.add({
      title: `Video size exceeds ${props.maxVideoFileSize}MB`,
      icon: "i-bx-info-circle",
      color: "red",
    })
    return false
  }
  return true
}

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items || []
  const filesFromClipboard = []

  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const file = item.getAsFile()
      if (file) {
        filesFromClipboard.push(file)
      }
    }
  }
  if (filesFromClipboard.length > 0) {
    toast.add({
      icon: "i-bx-check-circle",
      title: `Pasted ${filesFromClipboard.length} files`,
    })
    handleFiles(filesFromClipboard)
  }
}

onMounted(() => {
  window.addEventListener("paste", handlePaste as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener("paste", handlePaste as EventListener)
})
</script>

<style scoped>
.dropzone.is-dragover {
  background-color: #f0f0f0;
}
</style>
