<template>
  <div class="bg-image-selection-ctn p-2">
    <div
      :class="{ 'gap-4 grid-cols-3 max-h-full': settingsPage }"
      class="bg-image-selection grid gap-2 grid-cols-3 max-h-[190px] overflow-y-auto overflow-x-hidden"
    >
      <UButton
        v-for="image in backgroundImages"
        :key="image"
        @click="$emit('select', { image })"
        class="p-0 text-black bg-cover transition-all overflow-hidden relative group"
        :class="[settingsPage ? 'w-[180px] h-[100px]' : 'w-[90px] h-[50px]']"
      >
        <div
          class="bg-image min-w-[180px] h-[100px] transition rounded-md opacity-100 hover:opacity-30 bg-cover"
          :class="{ 'opacity-30': image === value }"
          :style="`background-image: url(${image})`"
        ></div>
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
  <div class="button-ctn p-2 pt-0">
    <FileDropzone
      v-if="!settingsPage"
      size="sm"
      :maxFileSize="maxFileSize"
      @change="saveAndSelectImages($event)"
      class="max-w-[300px]"
      :class="{ 'max-w-full': settingsPage }"
      :loading="imageCompressionLoading"
    />
    <label v-else class="relative">
      <input
        type="file"
        name=""
        id=""
        class="absolute inset-0 opacity-0 cursor-pointer"
        accept="image/*"
        multiple
        @change="
          saveAndSelectImages(
            Array.from(($event.target as HTMLInputElement)?.files || [])
          )
        "
      />
      <UButton
        class="z-1 mt-2"
        block
        variant="outline"
        :icon="imageCompressionLoading ? 'i-bx-loader-alt' : 'i-bx-plus'"
        :loading="imageCompressionLoading"
        size="sm"
        >{{
          imageCompressionLoading
            ? `Adding ${currentImageIndex}/${totalImages}...`
            : "Add from device"
        }}</UButton
      >
    </label>
  </div>
</template>

<script setup lang="ts">
import { useOnline } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"
import type { Media } from "~/types"

defineProps<{
  value?: string
  settingsPage?: boolean
}>()

const emit = defineEmits(["select"])
const authStore = useAuthStore()
const { isFreePlan } = useSubscription()

const maxFileSize = computed(() => (isFreePlan ? 3 : 10))
const toast = useToast()
const db = useIndexedDB()
const imageCompressionLoading = ref(false)
const currentImageIndex = ref(0)
const totalImages = ref(0)
const deletingImageId = ref<string | null>(null)

const bgImageToBeSelected = ref<string | null>(null)
const backgroundImages = ref<string[]>([
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
])

const getAllLocallySavedImages = async () => {
  const db = useIndexedDB()
  const images = await db.cached.where({ content: "image" }).toArray()

  // Create Object URLs from locally saved images - process in batches
  const imageURLs: string[] = []

  // Process images in smaller chunks to avoid blocking
  const chunkSize = 20
  for (let i = 0; i < images.length; i += chunkSize) {
    const chunk = images.slice(i, i + chunkSize)
    chunk.forEach((image) => {
      const blobURL =
        typeof image.data === "string"
          ? image.data
          : URL.createObjectURL(image.data as unknown as Blob)

      imageURLs.push(blobURL)

      if (image.id === bgImageToBeSelected.value) {
        bgImageToBeSelected.value = blobURL
      }
    })

    // Allow UI to breathe between chunks
    if (i + chunkSize < images.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  backgroundImages.value = backgroundImages.value.concat(imageURLs)
}

const saveAndSelectImages = async (files: File[]) => {
  if (!files || files.length === 0) return

  const online = useOnline()
  const db = useIndexedDB()

  imageCompressionLoading.value = true
  totalImages.value = files.length

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      currentImageIndex.value = i + 1

      const compressedFile = await useCompressedImage(file)
      let uploadedFile = null
      const randomId = useID(6)

      // Save to S3
      if (online.value) {
        uploadedFile = await useUploadImage(compressedFile)
      }

      // Save to IndexedDB
      const tempMedia: Media = {
        id: `/custom-image-bg-${randomId}.${file.type?.split("/")?.[1]}`,
        data: uploadedFile ? uploadedFile?.file?.url : compressedFile,
        content: "image",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await db.cached
        .add(tempMedia)
        .catch((err) => console.error("Failed to save custom image:", err))

      // Select the last added image
      if (i === files.length - 1) {
        bgImageToBeSelected.value = tempMedia.id
      }
    }

    await getAllLocallySavedImages()
    if (bgImageToBeSelected.value) {
      emit("select", bgImageToBeSelected.value)
    }
  } finally {
    imageCompressionLoading.value = false
    currentImageIndex.value = 0
    totalImages.value = 0
  }
}

// Check if image is a custom uploaded image
const isCustomImage = (imageUrl: string) => {
  return !imageUrl.includes("images.unsplash.com")
}

// Delete custom background image
const handleDeleteImage = async (imageUrl: string) => {
  try {
    deletingImageId.value = imageURLs

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
</script>
