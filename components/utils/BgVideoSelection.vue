<template>
  <div class="bg-image-selection-ctn p-2">
    <div
      :class="{ 'gap-4 grid-cols-3 max-h-full': settingsPage }"
      class="bg-image-selection grid gap-2 grid-cols-3 max-h-[200px] overflow-y-auto overflow-x-hidden"
    >
      <UButton
        v-for="video in backgroundVideos"
        :key="video?.id"
        @click="$emit('select', { video: video?.url, key: video?.id })"
        class="p-0 text-black bg-cover transition-all overflow-hidden relative group"
        :class="[settingsPage ? 'w-[180px] h-[100px]' : 'w-[90px] h-[50px]']"
      >
        <video
          class="bg-image w-[100%] h-[100%] transition rounded-md opacity-100 hover:opacity-30 object-cover"
          :class="{ 'opacity-30': video?.url === value }"
          :src="video?.url"
          muted
          autoplay
          crossorigin="anonymous"
        ></video>
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
    <div class="button-ctn pt-2">
      <FileDropzone
        v-if="!settingsPage"
        size="sm"
        icon="i-bx-film"
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
          @change="saveAndSelectVideos(Array.from($event.target?.files || []))"
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
const toast = useToast()
const db = useIndexedDB()

defineProps<{
  value?: string
  settingsPage?: boolean
}>()

const emit = defineEmits(["select"])
const videoUploadLoading = ref(false)
const currentVideoIndex = ref(0)
const totalVideos = ref(0)
const deletingVideoId = ref<string | null>(null)

const bgVideoToBeSelected = ref<string | null>(null)
const backgroundVideos = ref<BackgroundVideo[]>(
  appStore.currentState.backgroundVideos
)

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
  ]

  // Create Object URLs from locally saved videos - process in batches
  const locallySavedVideos: BackgroundVideo[] = []

  // Process videos in smaller chunks to avoid blocking
  const chunkSize = 15
  for (let i = 0; i < videos.length; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize)
    chunk.forEach((video) => {
      const blobURL = URL.createObjectURL(video.data as unknown as Blob)
      if (
        video.id?.includes(videoTypes[0]) ||
        video.id?.includes(videoTypes[1]) ||
        video.id?.includes(videoTypes[2]) ||
        video.id?.includes(videoTypes[3]) ||
        video.id?.includes(videoTypes[4]) ||
        video.id?.includes(videoTypes[5])
      ) {
        locallySavedVideos.push({ id: video.id, url: blobURL })
        if (video.id === bgVideoToBeSelected.value) {
          bgVideoToBeSelected.value = blobURL
        }
      } else {
        return // Ignore non-video files
      }
    })

    // Allow UI to breathe between chunks
    if (i + chunkSize < videos.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  locallySavedVideos.forEach((video) => {
    if (backgroundVideos.value.find((bgVideo) => bgVideo.id === video.id)) {
      return
    }
    backgroundVideos.value.push(video)
  })
}

const saveAndSelectVideos = async (files: File[]) => {
  if (!files || files.length === 0) return

  const db = useIndexedDB()

  videoUploadLoading.value = true
  totalVideos.value = files.length

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
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
      }
    }

    await getAllLocallySavedVideos()
    if (bgVideoToBeSelected.value) {
      emit("select", {
        video: bgVideoToBeSelected.value,
        key: bgVideoToBeSelected.value,
      })
    }
  } finally {
    videoUploadLoading.value = false
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
</script>
