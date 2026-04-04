<template>
  <div class="import-slides-main mb-4">
    <h2 class="font-semibold text-md">Import Slides</h2>

    <div class="flex flex-col gap-3 mt-3">
      <!-- Info banner -->
      <div
        class="alert flex gap-2 p-4 rounded-md bg-primary-100 dark:bg-primary-900"
      >
        <IconWrapper
          name="i-bx-info-circle"
          size="4"
          class="text-primary-500 mt-0.5 shrink-0"
        />
        <div class="flex-1">
          <h4 class="text-md font-semibold">Import PowerPoint or PDF slides</h4>
          <p class="text-sm">
            Each page is converted into an image and bundled into a single
            presentation slide.
          </p>
          <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">
            Tip: You can export as PDF from Canva, PowerPoint, or Google Slides
            for best results.
          </p>
        </div>
      </div>

      <!-- PPT feature-flag notice (shown only when PPT flag is off) -->
      <div
        v-if="!isPptEnabled"
        class="flex gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300"
      >
        <IconWrapper
          name="i-bx-info-circle"
          size="4"
          class="text-amber-500 shrink-0 mt-0.5"
        />
        <span>
          PowerPoint upload is being refined and currently unavailable. Please
          export your file as PDF first — it works great and is available to
          everyone.
        </span>
      </div>

      <!-- Drop zone / file picker -->
      <label
        class="dropzone text-center py-8 px-6 min-h-[160px] flex flex-col justify-center items-center rounded-lg border-dashed border-2 cursor-pointer transition-colors"
        :class="
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900'
            : 'border-primary-200 dark:border-primary-700 hover:border-primary-400'
        "
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onFileDrop"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="acceptedFileTypes"
          class="hidden"
          @change="onFileChange"
        />

        <IconWrapper
          name="i-ph-file-ppt"
          size="12"
          class="py-6 mb-4 w-full"
          rounded-bg
        />

        <p class="font-medium text-md">
          <span>Drag &amp; Drop</span> or <span>Click to select</span>
        </p>
        <p class="text-sm mt-1 text-gray-500 dark:text-gray-400">
          {{ isPptEnabled ? ".ppt, .pptx or .pdf" : ".pdf" }}
          &nbsp;·&nbsp; max 5 MB
        </p>
      </label>

      <!-- Selected file chip -->
      <Transition name="fade-sm">
        <div
          v-if="selectedFile"
          class="flex items-center gap-2 px-3 py-2 rounded-md bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 text-sm"
        >
          <IconWrapper
            :name="isPdf(selectedFile) ? 'i-ph-file-pdf' : 'i-ph-file-ppt'"
            size="4"
            class="text-primary-500 shrink-0"
          />
          <span class="truncate flex-1 font-medium">{{
            selectedFile.name
          }}</span>
          <span class="text-gray-400 text-xs shrink-0">{{
            fileSizeLabel
          }}</span>
          <UButton
            icon="i-bx-x"
            size="2xs"
            color="gray"
            variant="ghost"
            class="shrink-0"
            :disabled="isConverting"
            @click.prevent="clearFile"
          />
        </div>
      </Transition>

      <!-- Conversion progress -->
      <Transition name="fade-sm">
        <div
          v-if="isConverting"
          class="flex items-center gap-3 px-3 py-3 rounded-md bg-primary-50 dark:bg-primary-900 text-sm"
        >
          <UIcon
            name="i-bx-loader-alt"
            class="animate-spin text-primary-500 text-lg shrink-0"
          />
          <span class="text-gray-600 dark:text-gray-300">{{
            statusMessage || "Processing…"
          }}</span>
        </div>
      </Transition>

      <!-- Error -->
      <Transition name="fade-sm">
        <div
          v-if="errorMessage"
          class="flex gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-sm text-red-700 dark:text-red-300"
        >
          <IconWrapper
            name="i-bx-error"
            size="4"
            class="text-red-500 shrink-0 mt-0.5"
          />
          <span>{{ errorMessage }}</span>
        </div>
      </Transition>

      <!-- Cloud sync note -->
      <div
        v-if="!isConverting && !errorMessage"
        class="flex gap-2 items-center text-xs text-gray-400 dark:text-gray-500 px-1"
      >
        <UIcon name="i-bx-cloud-upload" class="text-sm shrink-0" />
        <span
          >Presentation files are automatically saved to your church's
          cloud.</span
        >
      </div>

      <!-- CTA -->
      <UButton
        block
        trailing-icon="i-bx-chevron-right"
        size="lg"
        class="mt-2"
        :disabled="!selectedFile || isConverting"
        :loading="isConverting"
        @click="handleImport"
      >
        Import presentation slide
      </UButton>
    </div>

    <!-- Feature Introduction Modal -->
    <FeatureIntroductionModal
      ref="featureIntroModal"
      feature-key="presentation-import"
      title="🎉 Import Slides"
    >
      <div
        class="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
      >
        <p>
          You can now import presentation files directly into Cloud of Worship!
          Each page becomes an image slide you can present right away.
        </p>

        <div class="bg-primary-50 dark:bg-primary-900 rounded-md p-3">
          <p class="font-semibold text-primary-700 dark:text-primary-300 mb-1">
            We recommend the PDF route
          </p>
          <p>
            PDF imports are processed instantly on your device, meaning no
            uploads necessary, and faster load times. You can export as PDF from
            <span class="font-semibold">Canva, PowerPoint, Google Slides</span>,
            and most other presentation apps.
          </p>
        </div>
      </div>
    </FeatureIntroductionModal>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const emit = defineEmits<{ close: [] }>()

const appStore = useAppStore()
const { createPresentationSlide } = useSlideCreation()
const { checkFlag } = useFeatureFlags()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isConverting = ref(false)
const statusMessage = ref("")
const errorMessage = ref("")
const featureIntroModal = ref<{
  show: () => boolean
  hasBeenSeen: () => boolean
} | null>(null)

/** Whether the PPT-conversion feature flag is enabled */
const isPptEnabled = computed(() => checkFlag("ppt-conversion"))

/** File types accepted by the file input */
const acceptedFileTypes = computed(() => {
  if (isPptEnabled.value) {
    return ".ppt,.pptx,.pdf,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
  return ".pdf,application/pdf"
})

const isPdf = (file: File) => file.type === "application/pdf"

const isPpt = (file: File) =>
  file.type === "application/vnd.ms-powerpoint" ||
  file.type ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"

const fileSizeLabel = computed(() => {
  if (!selectedFile.value) return ""
  const kb = selectedFile.value.size / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
})

const clearFile = () => {
  selectedFile.value = null
  errorMessage.value = ""
  statusMessage.value = ""
  if (fileInput.value) fileInput.value.value = ""
}

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) setFile(file)
}

const onFileDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) setFile(file)
}

const setFile = (file: File) => {
  errorMessage.value = ""
  statusMessage.value = ""

  // Block PPT files when the feature flag is off
  if (isPpt(file) && !isPptEnabled.value) {
    errorMessage.value =
      "PowerPoint upload is currently unavailable. Please export your file as PDF and try again."
    return
  }

  // Enforce 5 MB limit
  if (file.size > MAX_FILE_SIZE) {
    errorMessage.value = "File size exceeds the 5 MB limit."
    return
  }

  selectedFile.value = file
}

const handleImport = async () => {
  if (!selectedFile.value) return

  isConverting.value = true
  errorMessage.value = ""

  try {
    statusMessage.value = isPdf(selectedFile.value)
      ? "Reading PDF…"
      : "Converting PowerPoint to PDF…"

    const presentationObjects = await usePowerpointToImage(selectedFile.value)

    statusMessage.value = `Rendered ${presentationObjects.length} page(s). Creating slide…`
    const newSlide = createPresentationSlide(
      selectedFile.value.name,
      presentationObjects
    )

    appStore.appendActiveSlide(newSlide)

    emit("close")
  } catch (err: any) {
    console.error("Import slides error:", err)
    errorMessage.value =
      err?.message || "Something went wrong during conversion."
  } finally {
    isConverting.value = false
    statusMessage.value = ""
  }
}

// Show feature introduction modal on first visit
onMounted(() => {
  featureIntroModal.value?.show()
})
</script>
