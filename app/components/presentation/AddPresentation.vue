<template>
  <div class="import-slides-main flex h-full min-h-0 flex-col">
    <div
      class="relative flex min-h-0 flex-1 flex-col rounded-xl bg-white p-1.5 dark:bg-[#222938]"
    >
      <!-- Scrolls under the floating CTA below. -->
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div class="flex flex-col gap-3">
          <!-- PPT feature-flag notice -->
          <div
            v-if="fileType === 'ppt' && !isPptEnabled"
            class="flex gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300"
          >
            <InfoIcon class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              PowerPoint upload is being refined and currently unavailable.
              Please export your file as PDF instead, it works great and is
              available to everyone.
            </span>
          </div>

          <!-- Drop zone / file picker -->
          <FileDropzone
            upload-layout="column"
            title="Upload a File or Drag & Drop here"
            :caption="dropzoneCaption"
            :accept="acceptedFileTypes"
            :multiple="false"
            @change="onDropzoneChange"
          />

          <!-- Selected file chip -->
          <Transition name="fade-sm">
            <div
              v-if="selectedFile"
              class="flex items-center gap-2 px-3 py-2 rounded-md bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-700 text-sm"
            >
              <IconWrapper
                :name="fileType === 'pdf' ? 'i-ph-file-pdf' : 'i-ph-file-ppt'"
                size="4"
                class="text-primary-500 shrink-0"
              />
              <span class="truncate flex-1 font-medium">{{
                selectedFile.name
              }}</span>
              <span class="text-gray-400 text-xs shrink-0">{{
                fileSizeLabel
              }}</span>
              <CowButton
                variant="secondary"
                size="2xs"
                class="shrink-0"
                :disabled="isConverting"
                @click.prevent="clearFile"
              >
                <template #leading><CloseIcon class="w-4 h-4" /></template>
              </CowButton>
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
        </div>

        <!-- RECENT SLIDES — decks imported on this device -->
        <div v-if="recentPresentations.length" class="recent-ctn mt-6">
          <p class="text-[13px] text-gray-500 dark:text-[#9BA3B2]">
            Recent Slides
          </p>
          <!-- Negative margin cancels the panel padding so the rule is full-bleed -->
          <div
            class="-mx-1.5 mt-3 border-b border-gray-200 dark:border-white/5"
          ></div>

          <button
            v-for="presentation in recentPresentations"
            :key="presentation.groupId"
            type="button"
            class="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 border-b border-gray-200 px-1.5 py-3 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-60 dark:border-white/5 dark:hover:bg-white/[0.03]"
            :disabled="reimportingId === presentation.groupId"
            @click="reimportPresentation(presentation)"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5edfb] text-[15px] font-semibold uppercase text-[#4C87FF] dark:bg-[#253558]"
            >
              <UIcon
                v-if="reimportingId === presentation.groupId"
                name="i-bx-loader-alt"
                class="animate-spin text-lg"
              />
              <template v-else>{{ presentation.name.charAt(0) }}</template>
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13px] text-gray-900 dark:text-[#F8F9FB]"
                >{{ presentation.name }}</span
              >
              <span
                class="block text-[12px] text-gray-500 dark:text-[#9BA3B2]"
                >{{ addedLabel(presentation.createdAt) }}</span
              >
            </span>
          </button>
        </div>
      </div>

      <!-- FLOATING CTA — content scrolls underneath it -->
      <Transition name="fade-sm">
        <div
          v-if="selectedFile"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-transparent p-3 pt-10 dark:from-[#222938] dark:via-[#222938]"
        >
          <CowButton
            variant="primary"
            class="pointer-events-auto"
            block
            size="lg"
            :disabled="isConverting"
            :loading="isConverting"
            @click="handleImport"
          >
            Create slides
          </CowButton>
        </div>
      </Transition>
    </div>

    <!-- Feature Introduction Modal -->
    <FeatureIntroductionModal
      ref="featureIntroModal"
      :feature-key="
        fileType === 'ppt'
          ? 'presentation-import-ppt'
          : 'presentation-import-pdf'
      "
      title="🎉 Import Slides"
    >
      <div
        class="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
      >
        <p v-if="fileType === 'pdf'">
          Import PDF files directly into Cloud of Worship. Each page becomes an
          image slide you can present right away, no uploads required, processed
          instantly on your device.
        </p>
        <p v-else>
          Import PowerPoint files directly into Cloud of Worship. Each slide
          becomes an image you can present right away.
        </p>

        <div
          v-if="fileType === 'pdf'"
          class="bg-primary-50 dark:bg-primary-900 rounded-md p-3"
        >
          <p class="font-semibold text-primary-700 dark:text-primary-300 mb-1">
            Works with any presentation app
          </p>
          <p>
            You can export as PDF from
            <span class="font-semibold">Canva, PowerPoint, Google Slides</span>,
            and most other presentation apps.
          </p>
        </div>

        <div v-else class="bg-primary-50 dark:bg-primary-900 rounded-md p-3">
          <p class="font-semibold text-primary-700 dark:text-primary-300 mb-1">
            Best results with .pptx
          </p>
          <p>
            Save your file as <span class="font-semibold">.pptx</span> from
            PowerPoint or Google Slides for the smoothest import experience.
          </p>
        </div>
      </div>
    </FeatureIntroductionModal>
  </div>
</template>

<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import { useTimeAgo } from "@vueuse/core"
import type { RecentPresentation } from "~/composables/useRecentPresentations"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const props = withDefaults(defineProps<{ fileType?: "ppt" | "pdf" }>(), {
  fileType: "pdf",
})

const emit = defineEmits<{ close: [] }>()

const { checkFlag } = useFeatureFlags()

const selectedFile = ref<File | null>(null)
const isConverting = ref(false)
const reimportingId = ref<string | null>(null)
const statusMessage = ref("")
const errorMessage = ref("")
const featureIntroModal = ref<{
  show: () => boolean
  hasBeenSeen: () => boolean
} | null>(null)

const isPptEnabled = computed(() => checkFlag("ppt-conversion"))

const acceptedFileTypes = computed(() => {
  if (props.fileType === "ppt" && isPptEnabled.value) {
    return ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
  if (props.fileType === "ppt") {
    // Flag off, accept nothing so the OS picker shows no valid files.
    return ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
  return ".pdf,application/pdf"
})

const dropzoneCaption = computed(() =>
  props.fileType === "ppt" ? "ppt, pptx · Max 5MB" : "pdf · Max 5MB"
)

const isPpt = (file: File) =>
  file.type === "application/vnd.ms-powerpoint" ||
  file.type ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"

/** Does the file match this screen's `accept` list, by MIME or by extension? */
const isAcceptedType = (file: File) => {
  const patterns = acceptedFileTypes.value.split(",")
  const name = file.name.toLowerCase()
  return patterns.some((pattern) =>
    pattern.startsWith(".") ? name.endsWith(pattern) : file.type === pattern
  )
}

const fileSizeLabel = computed(() => {
  if (!selectedFile.value) return ""
  const kb = selectedFile.value.size / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
})

const clearFile = () => {
  selectedFile.value = null
  errorMessage.value = ""
  statusMessage.value = ""
}

// FileDropzone only size-gates images and videos, and its paste listener is
// window-wide, so every acceptance rule for presentations lives here.
const onDropzoneChange = (files: FileList | File[]) => {
  const file = Array.from(files || [])[0]
  if (file) setFile(file)
}

const setFile = (file: File) => {
  errorMessage.value = ""
  statusMessage.value = ""

  if (!isAcceptedType(file)) {
    errorMessage.value =
      props.fileType === "ppt"
        ? "That file isn't a PowerPoint presentation. Choose a .ppt or .pptx file."
        : "That file isn't a PDF. Choose a .pdf file."
    return
  }

  if (isPpt(file) && !isPptEnabled.value) {
    errorMessage.value =
      "PowerPoint upload is currently unavailable. Please export your file as PDF and try again."
    return
  }

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
    statusMessage.value =
      props.fileType === "pdf"
        ? "Reading PDF…"
        : "Converting PowerPoint to PDF…"

    const presentationObjects = await usePowerpointToImage(selectedFile.value)

    statusMessage.value = `Rendered ${presentationObjects.length} page(s). Creating slide…`
    useGlobalEmit(appWideActions.newPresentation, {
      fileName: selectedFile.value.name,
      presentationObjects,
      fromImport: true,
    })

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

// ── Recent slides — decks already imported on this device ──────────────────
const {
  presentations: recentPresentations,
  load: loadRecentPresentations,
  toPresentationObjects,
} = useRecentPresentations()

const addedLabel = (createdAt: string) =>
  `Added ${useTimeAgo(new Date(createdAt)).value}`

const reimportPresentation = async (presentation: RecentPresentation) => {
  if (reimportingId.value) return
  reimportingId.value = presentation.groupId
  errorMessage.value = ""

  try {
    const presentationObjects = await toPresentationObjects(presentation)
    if (!presentationObjects) {
      errorMessage.value =
        "This presentation is no longer stored on this device. Import the file again."
      // Drop the dead entry so it can't be tapped a second time.
      await loadRecentPresentations()
      return
    }

    useGlobalEmit(appWideActions.newPresentation, {
      fileName: presentation.name,
      presentationObjects,
      fromImport: true,
    })
    emit("close")
  } catch (err: any) {
    console.error("Re-import presentation error:", err)
    errorMessage.value = err?.message || "Could not reopen this presentation."
  } finally {
    reimportingId.value = null
  }
}

onMounted(() => {
  featureIntroModal.value?.show()
  void loadRecentPresentations()
})
</script>
