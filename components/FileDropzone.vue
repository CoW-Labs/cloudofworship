<template>
  <div
    class="dropzone text-center py-8 p-6 min-h-[200px] flex flex-col justify-center items-center rounded-lg border-dashed border-2 border-primary-200 cursor-pointer"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    :class="{
      'border-primary-500': isDragOver,
      'p-2 min-h-[100px]': size === 'sm',
    }"
  >
    <input type="file" ref="fileInput" @change="onFileSelect" multiple hidden />

    <IconWrapper
      :name="icon"
      :size="size === 'sm' ? '7' : '12'"
      :class="[size === 'sm' ? 'w-[100px] mb-4 py-4' : 'py-6 mb-8 w-full']"
      rounded-bg
    ></IconWrapper>
    <div class="texts">
      <p class="mb font-medium">
        <span class="text-md">Drag & Drop</span> or
        <span class="text-md">Copy & Paste</span>
      </p>
      <p
        v-if="size !== 'sm'"
        class="text-sm mb-6"
        :class="{ 'text-xs': size === 'sm' }"
      >
        image, video or audio files.
      </p>
    </div>

    <!-- <UButton icon="i-bx-plus" @click.prevent="openFileDialog"
      >Select Files</UButton
    > -->
  </div>
</template>

<script setup>
import { ref, reactive } from "vue"

const props = defineProps({
  size: {
    type: String,
    default: "lg",
  },
  maxFileSize: {
    type: Number,
    default: 3, // Currently only for images
  },
  icon: {
    type: String,
    default: "i-bx-image",
  },
})
const toast = useToast()
const fileInput = ref(null)
const isDragOver = ref(false)
const files = reactive([])
const emit = defineEmits(["change"])

const onDragOver = () => {
  isDragOver.value = true
}

const onDragLeave = () => {
  isDragOver.value = false
}

const onDrop = (event) => {
  isDragOver.value = false
  handleFiles(event.dataTransfer.files)
}

const onFileSelect = (event) => {
  handleFiles(event.target.files)
}

const openFileDialog = () => {
  fileInput.value.click()
}

const handleFiles = (selectedFiles) => {
  // console.log("selectedFiles", selectedFiles)
  if (props.size === "sm" && props.icon === "i-bx-image") {
    if (!selectedFiles?.[0]?.type.startsWith("image")) {
      return toast.add({
        title: "Please select only images",
        icon: "i-bx-info-circle",
        color: "red",
      })
    }
  }
  if (props.size === "sm" && props.icon === "i-bx-film") {
    if (!selectedFiles?.[0]?.type.startsWith("video")) {
      return toast.add({
        title: "Please select only videos",
        icon: "i-bx-info-circle",
        color: "red",
      })
    }
  }
  for (let i = 0; i < selectedFiles.length; i++) {
    if (isFileSizeExceeded(selectedFiles[i])) {
      files.push(selectedFiles[i])
    }
  }
  emit("change", files)
}

// Currently only for images
const isFileSizeExceeded = (file) => {
  if (
    file.size > props.maxFileSize * 1024 * 1024 &&
    file.type.startsWith("image")
  ) {
    toast.add({
      title: `File size exceeds ${props.maxFileSize}MB`,
      icon: "i-bx-info-circle",
      color: "red",
    })
    return false
  }
  return true
}

const handlePaste = (event) => {
  const items = event.clipboardData.items
  const filesFromClipboard = []

  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file") {
      const file = items[i].getAsFile()
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
  window.addEventListener("paste", handlePaste)
})

onBeforeUnmount(() => {
  window.removeEventListener("paste", handlePaste)
})
</script>

<style scoped>
.dropzone.is-dragover {
  background-color: #f0f0f0;
}
</style>
