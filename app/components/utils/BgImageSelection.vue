<template>
  <div v-if="backgroundPanel" class="h-full w-full p-3">
    <div
      class="grid h-full grid-cols-3 gap-[8.5px] overflow-y-auto overflow-x-hidden"
    >
      <button
        v-for="image in backgroundImages"
        :key="image"
        type="button"
        class="group relative h-[68.125px] w-full shrink-0 overflow-hidden rounded-[4px] bg-cover transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E8D1F8]"
        :aria-label="
          image === value
            ? 'Selected background image'
            : 'Select background image'
        "
        :aria-pressed="image === value"
        @click="selectImage(image)"
      >
        <span
          class="block h-full w-full bg-cover bg-center"
          :style="{ backgroundImage: `url(${image})` }"
        ></span>
        <span
          v-if="image === value"
          class="pointer-events-none absolute inset-0 z-10 rounded-[4px] border-2 border-[#E8D1F8]"
        ></span>
      </button>
    </div>
  </div>

  <template v-else>
    <div>
      <div class="bg-image-selection-ctn p-2">
        <div
          class="bg-image-selection grid gap-2 max-h-[190px] overflow-y-auto overflow-x-hidden"
          :class="
            settingsPage ? 'gap-4 grid-cols-3 max-h-full pb-16' : 'grid-cols-3'
          "
        >
          <UButton
            v-for="image in backgroundImages"
            :key="image"
            @click="selectImage(image)"
            class="p-0 text-black bg-cover transition-all overflow-hidden relative group"
            :class="settingsPage ? 'w-[180px] h-[100px]' : 'w-full h-[60px]'"
          >
            <div
              class="bg-image w-full h-full transition rounded-md opacity-100 hover:opacity-30 bg-cover"
              :class="[
                settingsPage ? 'min-w-[180px] h-[100px]' : '',
                { 'opacity-30': image === value },
              ]"
              :style="`background-image: url(${image})`"
            ></div>
            <span
              v-if="image === value"
              class="pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-[#E8D1F8]"
            ></span>
            <IconWrapper
              v-if="image === value"
              name="i-bx-check"
              size="5"
              :rounded-bg="true"
              class="absolute text-primary-500 scale-50 bottom-2 right-2"
            />
            <!-- Delete button for custom images in settings page -->
            <!-- <UButton
          v-if="settingsPage && isCustomImage(image)"
          icon="i-tabler-trash"
          size="xs"
          variant="solid"
          class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-1.5"
          :loading="deletingImageId === image"
          @click.stop.prevent="handleDeleteImage(image)"
        /> -->
          </UButton>
        </div>
      </div>
      <div v-if="!hideUpload && !settingsPage" class="button-ctn p-2 pt-0">
        <FileDropzone
          size="sm"
          accept="image/*"
          :maxFileSize="maxFileSize"
          @change="saveAndSelectImages($event)"
          class="max-w-[320px]"
          :loading="imageCompressionLoading"
        />
      </div>
      <Teleport to="#settings-modal-device-action">
        <!-- Fixed to the settings modal, outside its scrolling content. -->
        <div
          v-if="!hideUpload && settingsPage"
          class="pointer-events-auto w-[190px] shadow-xl transition-all"
        >
          <input
            ref="imageFileInput"
            type="file"
            class="hidden"
            accept="image/*"
            multiple
            @change="onImageFileSelect"
          />
          <CowButton
            variant="primary"
            size="lg"
            block
            :icon="imageCompressionLoading ? 'i-bx-loader-alt' : 'i-bx-plus'"
            :loading="imageCompressionLoading"
            :disabled="imageCompressionLoading"
            @click="openImageFilePicker"
          >
            {{
              imageCompressionLoading
                ? `Adding ${currentImageIndex}/${totalImages}...`
                : "Add from device"
            }}
          </CowButton>
        </div>
      </Teleport>
    </div>
  </template>
</template>

<script setup lang="ts">
import { useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"

defineProps<{
  value?: string
  settingsPage?: boolean
  hideUpload?: boolean
  backgroundPanel?: boolean
}>()

const emit = defineEmits(["select", "loading-change"])
const appStore = useAppStore()

const maxFileSize = computed(() => Infinity)
const toast = useToast()
const localMedia = useLocalMediaStorage()
const imageCompressionLoading = ref(false)
const imageFileInput = ref<HTMLInputElement | null>(null)
const currentImageIndex = ref(0)
const totalImages = ref(0)
const deletingImageId = ref<string | null>(null)

const bgImageToBeSelected = ref<string | null>(null)
const localImageObjectUrls = new Set<string>()
const transientPreviewUrls = new Set<string>()
const imageKeysByUrl = new Map<string, string>()
const defaultBackgroundImages = [
  "https://images.unsplash.com/photo-1553901753-215db344677a?q=80&w=1740",
  "https://images.unsplash.com/photo-1506056820413-f8fa4de15de6?q=80&w=1740",
  "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1740",
  "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1740",
  "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1740",
  "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1740",
  "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?q=80&w=1740",
  "https://images.unsplash.com/photo-1593485589800-579b43749b15?q=80&w=1740",
  "https://images.unsplash.com/photo-1478147427282-58a87a120781?q=80&w=1740",
  "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?q=80&w=1740",
  "https://images.unsplash.com/photo-1491396023581-4344e51fec5c?q=80&w=1740",
  "https://images.unsplash.com/photo-1518289646039-3e6c87a5aaf6?q=80&w=1740",
  "https://images.unsplash.com/photo-1503455637927-730bce8583c0?q=80&w=1740",
  "https://images.unsplash.com/photo-1579267205095-6b30ba87edba?q=80&w=1740",
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=1740",
  "https://images.unsplash.com/photo-1523821741446-edb2b68bb7a0?q=80&w=1740",
  "https://images.unsplash.com/photo-1597773150796-e5c14ebecbf5?q=80&w=1740",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1740",
  "https://images.unsplash.com/photo-1511268011861-691ed210aae8?q=80&w=1740",
  "https://images.unsplash.com/photo-1545608444-f045a6db6133?w=1740",
  "https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?q=80&w=1740",
  "https://images.unsplash.com/photo-1511783111049-b4c32d7fa8fa?q=80&w=1740",
  "https://images.unsplash.com/photo-1482164565953-04b62dcac1cd?q=80&w=1740",
  "https://images.unsplash.com/photo-1513680904158-42938c809a42?q=80&w=1740",
  // EASTER IMAGES
  "https://images.unsplash.com/photo-1649894708597-93851f061545?q=80&w=1740",
  "https://images.unsplash.com/photo-1616548321600-aaab929899b5?q=80&w=1740",
  "https://images.unsplash.com/photo-1711560728293-14b647bd3a12?q=80&w=1740",
  // ---
]
const backgroundImages = ref<string[]>([...defaultBackgroundImages])

const openImageFilePicker = () => {
  imageFileInput.value?.click()
}

const selectImage = async (image: string) => {
  const existingKey = imageKeysByUrl.get(image)
  if (existingKey) {
    emit("select", { image, key: existingKey })
    return
  }

  const presetIndex = defaultBackgroundImages.indexOf(image)
  if (presetIndex < 0) {
    emit("select", { image })
    return
  }

  const key = `/preset-image-bg-${presetIndex + 1}`
  try {
    const localUrl = await localMedia.ensureLocal(key, {
      url: image,
      category: "preset",
      kind: "image",
      groupId: key,
      recoverable: true,
    })
    if (!localUrl) throw new Error("The preset image could not be saved.")
    imageKeysByUrl.set(localUrl, key)
    emit("select", { image: localUrl, key })
  } catch (error) {
    console.error("Failed to prepare preset image:", error)
    toast.add({
      title: "Background is not available offline yet",
      description: "Connect to the internet and try selecting it again.",
      icon: "i-bx-error",
      color: "red",
    })
  }
}

const onImageFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ""
  void saveAndSelectImages(files)
}

const revokeLocalImageObjectUrls = () => {
  const usedBackgrounds = new Set(
    appStore.currentState.activeSlides.map((slide) => slide.background)
  )
  localImageObjectUrls.forEach((url) => {
    if (!usedBackgrounds.has(url)) {
      localMedia.releasePlaybackUrl(url)
    }
  })
  localImageObjectUrls.clear()
}

const revokeTransientPreviewUrls = () => {
  transientPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
  transientPreviewUrls.clear()
}

const getAllLocallySavedImages = async () => {
  const images = (await localMedia.listRecords()).filter(
    (record) =>
      record.kind === "image" &&
      (record.category === "background" || record.category === "preset")
  )

  revokeLocalImageObjectUrls()
  imageKeysByUrl.clear()

  revokeLocalImageObjectUrls()

  // Create Object URLs from locally saved images - process in batches
  const imageURLs: string[] = []

  // Process images in smaller chunks to avoid blocking
  const chunkSize = 20
  for (let i = 0; i < images.length; i += chunkSize) {
    const chunk = images.slice(i, i + chunkSize)
    for (const image of chunk) {
      const localUrl = await localMedia.getPlaybackUrl(image.key)
      if (!localUrl) continue
      if (localUrl.startsWith("blob:")) localImageObjectUrls.add(localUrl)
      imageKeysByUrl.set(localUrl, image.key)
      imageURLs.push(localUrl)

      if (image.key === bgImageToBeSelected.value) {
        bgImageToBeSelected.value = localUrl
      }
    }

    // Allow UI to breathe between chunks
    if (i + chunkSize < images.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  backgroundImages.value = Array.from(
    new Set([...defaultBackgroundImages, ...imageURLs])
  )
}

const saveAndSelectImages = async (files: File[]) => {
  if (!files || files.length === 0) return

  const online = useOnline()
  imageCompressionLoading.value = true
  emit("loading-change", true)
  totalImages.value = files.length

  const previewUrls = files.map((file) => {
    const previewUrl = URL.createObjectURL(file)
    transientPreviewUrls.add(previewUrl)
    return previewUrl
  })

  backgroundImages.value = Array.from(
    new Set([
      ...defaultBackgroundImages,
      ...previewUrls,
      ...backgroundImages.value,
    ])
  )

  const immediatePreviewUrl = previewUrls[previewUrls.length - 1]
  if (immediatePreviewUrl) {
    emit("select", { image: immediatePreviewUrl })
  }

  // Keep the UI responsive by persisting and uploading in the background.
  // The final selection is re-emitted once durable local storage has the asset.
  ;(async () => {
    let savedSuccessfully = false
    try {
      for (const [i, file] of files.entries()) {
        currentImageIndex.value = i + 1

        const compressedBlob = await useCompressedImage(file)
        const compressedFile =
          compressedBlob instanceof File
            ? compressedBlob
            : new File([compressedBlob], file.name, {
                type: compressedBlob.type || file.type,
                lastModified: file.lastModified,
              })
        const randomId = useID(6)

        const mediaKey = `/custom-image-bg-${randomId}.${
          file.type?.split("/")?.[1]
        }`
        await localMedia.saveBlob({
          key: mediaKey,
          groupId: mediaKey,
          category: "background",
          kind: "image",
          blob: compressedFile,
          mimeType: compressedFile.type,
          originalName: file.name,
          recoverable: false,
          userInitiated: true,
        })

        // Cloud recovery starts only after the local copy has been verified.
        if (online.value) {
          try {
            const uploadedFile = await useUploadImage(compressedFile)
            await useIndexedDB().localMediaFiles.update(mediaKey, {
              remoteUrl: uploadedFile.file.url,
              recoverable: true,
              updatedAt: new Date().toISOString(),
            })
          } catch (error) {
            console.warn("Background image cloud upload failed:", error)
          }
        }

        // Select the last added image once the stable asset is available.
        if (i === files.length - 1) {
          bgImageToBeSelected.value = mediaKey
        }
      }

      await getAllLocallySavedImages()
      if (bgImageToBeSelected.value) {
        emit("select", {
          image: bgImageToBeSelected.value,
          key: imageKeysByUrl.get(bgImageToBeSelected.value),
        })
      }
      savedSuccessfully = true
    } catch (error) {
      console.error("Failed to save custom image:", error)
      toast.add({
        title: "Local media storage is unavailable",
        description:
          "This browser cannot durably save the background. The preview will only last for this session.",
        icon: "i-bx-error",
        color: "red",
      })
    } finally {
      imageCompressionLoading.value = false
      emit("loading-change", false)
      currentImageIndex.value = 0
      totalImages.value = 0
      if (savedSuccessfully) {
        revokeTransientPreviewUrls()
      }
    }
  })()
}

// Check if image is a custom uploaded image
const isCustomImage = (imageUrl: string) => {
  return !imageUrl.includes("images.unsplash.com")
}

// Delete custom background image
const handleDeleteImage = async (imageUrl: string) => {
  try {
    deletingImageId.value = imageUrl

    // Refresh images after deletion
    await getAllLocallySavedImages()
  } catch (error: any) {
    console.error("Error deleting background image:", error)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to delete background image",
      description: error.message,
      color: "red",
    })
  } finally {
    deletingImageId.value = null
  }
}

getAllLocallySavedImages()

onBeforeUnmount(() => {
  revokeLocalImageObjectUrls()
  revokeTransientPreviewUrls()
})
</script>
