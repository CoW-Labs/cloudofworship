<template>
  <div class="bg-image-selection-ctn p-2">
    <div
      class="bg-image-selection gap-2 grid grid-cols-3 max-h-[190px] overflow-y-auto"
    >
      <UButton
        v-for="image in backgroundImages"
        :key="image"
        @click="$emit('select', image)"
        class="w-[70px] h-[70px] p-0 text-black bg-cover transition-all overflow-hidden relative"
      >
        <div
          class="bg-image min-w-[70px] h-[70px] transition rounded-md opacity-100 hover:opacity-30 bg-cover"
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
      </UButton>
    </div>
  </div>
  <div class="button-ctn p-2 pt-0">
    <FileDropzone
      size="sm"
      @change="saveAndSelectImage($event?.[0])"
      class="max-w-[230px]"
    />
    <!-- <label class="relative">
      <input
        type="file"
        name=""
        id=""
        class="absolute inset-0 opacity-0 cursor-pointer"
        accept="image/*"
        @change="saveAndSelectImage($event.target?.files?.[0])"
      />
      <UButton class="z-1" block variant="outline" icon="i-bx-plus" size="xs"
        >Add from device</UButton
      >
    </label> -->
  </div>
</template>

<script setup lang="ts">
import { useOnline } from "@vueuse/core"
import type { Media } from "~/types"

defineProps<{
  value: string
}>()

const emit = defineEmits(["select"])
const imageCompressionLoading = ref(false)

const bgImageToBeSelected = ref<string | null>(null)
const backgroundImages = ref<string[]>([
  "https://images.unsplash.com/photo-1511268011861-691ed210aae8?q=80&w=1740",
  "https://images.unsplash.com/photo-1545608444-f045a6db6133?w=1740",
  "https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?q=80&w=1740",
  "https://images.unsplash.com/photo-1511783111049-b4c32d7fa8fa?q=80&w=1740",
  "https://images.unsplash.com/photo-1482164565953-04b62dcac1cd?q=80&w=1740",
  "https://images.unsplash.com/photo-1513680904158-42938c809a42?q=80&w=1740",
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
])

const getAllLocallySavedImages = async () => {
  const db = useIndexedDB()
  const images = await db.cached.where({ content: "image" }).toArray()

  // console.log(images.reverse())

  // Create Object URLs from locally saved images
  const imageURLs: string[] = []
  images.forEach((image) => {
    const blobURL =
      typeof image.data === "string"
        ? image.data
        : URL.createObjectURL(image.data as unknown as Blob)

    imageURLs.push(blobURL)

    if (image.id === bgImageToBeSelected.value) {
      bgImageToBeSelected.value = blobURL
    }
  })
  backgroundImages.value = backgroundImages.value.concat(imageURLs)
}

const saveAndSelectImage = async (file: any) => {
  const online = useOnline()
  imageCompressionLoading.value = true
  const compressedFile = await useCompressedImage(file)
  let uploadedFile = null
  // console.log("file", file)
  const db = useIndexedDB()
  const randomId = useID(6)

  // Save to S3
  if (online.value) {
    uploadedFile = await useUploadImage(compressedFile)
    console.log("uploadedFile", uploadedFile)
  }

  // Save to IndexedDB
  const tempMedia: Media = {
    id: `/custom-image-bg-${randomId}.${file.type?.split("/")?.[1]}`,
    data: uploadedFile ? uploadedFile?.file?.url : compressedFile,
    content: "image",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  console.log("tempMedia", tempMedia)
  db.cached.add(tempMedia)
  bgImageToBeSelected.value = tempMedia.id
  await getAllLocallySavedImages()
  imageCompressionLoading.value = false
  emit("select", bgImageToBeSelected.value)
}

getAllLocallySavedImages()
</script>
