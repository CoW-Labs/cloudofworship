<template>
  <div
    class="dropzone text-center py-8 p-6 min-h-[200px] flex flex-col justify-center items-center rounded-lg border-dashed border-2 border-primary-200"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    :class="{ 'border-primary-500': isDragOver }"
  >
    <input type="file" ref="fileInput" @change="onFileSelect" multiple hidden />

    <IconWrapper
      name="i-bx-image"
      size="12"
      class="py-6 mb-8 w-full"
      rounded-bg
    ></IconWrapper>
    <div class="texts">
      <p class="mb font-medium">
        <span class="text-lg">Drag & Drop</span> or
        <span class="text-lg">Copy & Paste</span>
      </p>
      <p class="text-sm mb-6">image, video or audio files.</p>
    </div>

    <!-- <UButton icon="i-bx-plus" @click.prevent="openFileDialog"
      >Select Files</UButton
    > -->
  </div>
</template>

<script setup>
import { ref, reactive } from "vue"

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
  for (let i = 0; i < selectedFiles.length; i++) {
    files.push(selectedFiles[i])
  }
  emit("change", files)
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
  toast.add({
    icon: "i-bx-check-circle",
    title: `Pasted ${filesFromClipboard.length} files`,
  })
  handleFiles(filesFromClipboard)
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
