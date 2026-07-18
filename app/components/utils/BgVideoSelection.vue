<template>
  <div v-if="backgroundPanel" class="h-full w-full p-3">
    <div
      class="grid h-full grid-cols-3 gap-[8.5px] overflow-y-auto overflow-x-hidden"
    >
      <button
        v-for="video in backgroundVideos"
        :key="video?.id"
        type="button"
        class="group relative h-[68.125px] w-full shrink-0 overflow-hidden rounded-[4px] bg-black transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E8D1F8]"
        :aria-label="video?.url === value ? 'Selected background video' : 'Select background video'"
        :aria-pressed="video?.url === value"
        @click="$emit('select', { video: video?.url, key: video?.id })"
      >
        <video
          class="h-full w-full object-cover"
          :src="video?.url"
          muted
          autoplay
          playsinline
          preload="metadata"
          crossorigin="anonymous"
        ></video>
        <span
          v-if="video?.url === value"
          class="pointer-events-none absolute inset-0 z-10 rounded-[4px] border-2 border-[#E8D1F8]"
        ></span>
      </button>
    </div>
  </div>

  <div v-else class="bg-image-selection-ctn p-2">
    <div
      :class="{ 'gap-4 grid-cols-3 max-h-full': settingsPage }"
      class="bg-image-selection grid gap-2 grid-cols-3 max-h-[200px] overflow-y-auto overflow-x-hidden"
    >
      <UButton
        v-for="video in backgroundVideos"
        :key="video?.id"
        @click="$emit('select', { video: video?.url, key: video?.id })"
        class="p-0 text-black bg-cover transition-all overflow-hidden relative group"
        :class="settingsPage ? 'w-[180px] h-[100px]' : 'w-full h-[60px]'"
      >
        <video
          class="bg-image w-[100%] h-[100%] transition rounded-md opacity-100 hover:opacity-30 object-cover"
          :class="{ 'opacity-30': video?.url === value }"
          :src="video?.url"
          muted
          autoplay
          crossorigin="anonymous"
        ></video>
        <span
          v-if="video?.url === value"
          class="pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-[#E8D1F8]"
        ></span>
        <IconWrapper
          v-if="video?.url === value"
          name="i-bx-check"
          size="5"
          :rounded-bg="true"
          class="absolute text-primary-500 scale-50 bottom-2 right-2"
        />
        <!-- Delete button for custom videos in settings page -->
        <!-- <UButton
          v-if="settingsPage && isCustomVideo(video?.id)"
          icon="i-tabler-trash"
          size="xs"
          color="red"
          variant="solid"
          class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-1.5"
          :loading="deletingVideoId === video?.id"
          @click.stop.prevent="handleDeleteVideo(video)"
        /> -->
      </UButton>
    </div>
    <div v-if="!hideUpload" class="button-ctn pt-2">
      <FileDropzone
        v-if="!settingsPage"
        size="sm"
        icon="i-bx-film"
        accept="video/*"
        :maxFileSize="maxFileSize"
        @change="saveAndSelectVideos($event)"
        :loading="videoUploadLoading"
      />
      <label class="relative" v-else>
        <input
          type="file"
          name=""
          id=""
          class="absolute inset-0 opacity-0 cursor-pointer"
          accept="video/*"
          multiple
          @change="
            saveAndSelectVideos(
              Array.from(($event.target as HTMLInputElement)?.files || [])
            )
          "
        />
        <UButton
          class="z-1 mt-2"
          block
          variant="outline"
          :icon="videoUploadLoading ? 'i-bx-loader-alt' : 'i-bx-plus'"
          :loading="videoUploadLoading"
          size="sm"
          >{{
            videoUploadLoading
              ? `Adding ${currentVideoIndex}/${totalVideos}...`
              : "Add from device"
          }}</UButton
        >
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Media, BackgroundVideo } from "~/types"

const appStore = useAppStore()
const authStore = useAuthStore()
const { isFreePlan } = useSubscription()

const maxFileSize = computed(() => (isFreePlan ? 3 : 10))
const toast = useToast()
const db = useIndexedDB()

defineProps<{
  value?: string
  settingsPage?: boolean
  hideUpload?: boolean
  backgroundPanel?: boolean
}>()

const emit = defineEmits(["select", "loading-change"])
const videoUploadLoading = ref(false)
const currentVideoIndex = ref(0)
const totalVideos = ref(0)
const deletingVideoId = ref<string | null>(null)

const bgVideoToBeSelected = ref<string | null>(null)
const localVideoObjectUrls = new Set<string>()
const defaultBackgroundVideos = [...appStore.currentState.backgroundVideos]
const backgroundVideos = ref<BackgroundVideo[]>([...defaultBackgroundVideos])

const revokeLocalVideoObjectUrls = () => {
  const usedBackgrounds = new Set(
    appStore.currentState.activeSlides.map((s) => s.background).filter(Boolean)
  )
  localVideoObjectUrls.forEach((url) => {
    if (!usedBackgrounds.has(url)) {
      URL.revokeObjectURL(url)
    }
  })
  localVideoObjectUrls.clear()
}

const getAllLocallySavedVideos = async () => {
  const db = useIndexedDB()
  const videos = await db.cached.where({ content: "video" }).toArray()
  const videoTypes = [
    ".mp4",
    ".webm",
    ".mov",
    ".wmv",
    ".avi",
    ".mkv",
    ".ogg",
    ".flv",
  ] as const

  revokeLocalVideoObjectUrls()

  // Create Object URLs from locally saved videos - process in batches
  const locallySavedVideos: BackgroundVideo[] = []

  // Process videos in smaller chunks to avoid blocking
  const chunkSize = 15
  for (let i = 0; i < videos.length; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize)
    chunk.forEach((video) => {
      if (!videoTypes.some((extension) => video.id.includes(extension))) {
        return
      }

      const blobURL = URL.createObjectURL(video.data as unknown as Blob)
      localVideoObjectUrls.add(blobURL)
      locallySavedVideos.push({ id: video.id, url: blobURL })
      if (video.id === bgVideoToBeSelected.value) {
        bgVideoToBeSelected.value = blobURL
      }
    })

    // Allow UI to breathe between chunks
    if (i + chunkSize < videos.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  const videosById = new Map<string, BackgroundVideo>()
  ;[...defaultBackgroundVideos, ...locallySavedVideos].forEach((video) => {
    if (!video?.id || videosById.has(video.id)) return
    videosById.set(video.id, video)
  })
  backgroundVideos.value = Array.from(videosById.values())
}

const saveAndSelectVideos = async (files: File[]) => {
  if (!files || files.length === 0) return

  const db = useIndexedDB()

  videoUploadLoading.value = true
  emit("loading-change", true)
  totalVideos.value = files.length
  let selectedVideoKey: string | null = null

  try {
    for (const [i, file] of files.entries()) {
      currentVideoIndex.value = i + 1

      const randomId = useID(6)
      const tempMedia: Media = {
        id: `/custom-video-bg-${randomId}.${file.type?.split("/")?.[1]}`,
        data: file,
        content: "video",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await db.cached
        .add(tempMedia)
        .catch((err) => console.error("Failed to save custom video:", err))

      // Select the last added video
      if (i === files.length - 1) {
        bgVideoToBeSelected.value = tempMedia.id
        selectedVideoKey = tempMedia.id
      }
    }

    await getAllLocallySavedVideos()
    if (bgVideoToBeSelected.value) {
      emit("select", {
        video: bgVideoToBeSelected.value,
        key: selectedVideoKey || bgVideoToBeSelected.value,
      })
    }
  } finally {
    videoUploadLoading.value = false
    emit("loading-change", false)
    currentVideoIndex.value = 0
    totalVideos.value = 0
  }
}

// Check if video is a custom uploaded video
const isCustomVideo = (videoId: string) => {
  return videoId?.includes("custom-video-bg-")
}

// Delete custom background video
const handleDeleteVideo = async (video: BackgroundVideo) => {
  try {
    deletingVideoId.value = video.id

    // Reload the backgrounds
    await getAllLocallySavedVideos()
  } catch (error: any) {
    console.error("Error deleting background video:", error)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to delete background video",
      description: error.message,
      color: "red",
    })
  } finally {
    deletingVideoId.value = null
  }
}

getAllLocallySavedVideos()

onBeforeUnmount(() => {
  revokeLocalVideoObjectUrls()
})
</script>
