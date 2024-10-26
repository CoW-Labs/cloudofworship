<template>
  <div class="bg-image-selection-ctn p-2">
    <div
      class="bg-image-selection gap-2 grid grid-cols-3 max-h-[200px] overflow-y-auto"
    >
      <UButton
        v-for="video in backgroundVideos"
        :key="video?.id"
        @click="$emit('select', { video: video?.url, key: video?.id })"
        class="w-[100px] h-[60px] p-0 text-black bg-cover transition-all overflow-hidden relative"
      >
        <video
          class="bg-image w-[100%] h-[100%] transition rounded-md opacity-100 hover:opacity-30 object-cover"
          :class="{ 'opacity-30': video === value }"
          :src="video?.url"
          muted
          autoplay
          crossorigin="anonymous"
        ></video>
        <IconWrapper
          v-if="video === value"
          name="i-bx-check"
          size="5"
          :rounded-bg="true"
          class="absolute text-primary-500 scale-50 bottom-2 right-2"
        />
      </UButton>
    </div>
    <div class="button-ctn pt-2">
      <FileDropzone
        size="sm"
        icon="i-bx-film"
        @change="saveAndSelectVideo($event?.[0])"
      />
      <!-- <label class="relative">
        <input
          type="file"
          name=""
          id=""
          class="absolute inset-0 opacity-0 cursor-pointer"
          accept="video/*"
          @change="saveAndSelectVideo($event.target?.files?.[0])"
        />
        <UButton class="z-1" block variant="outline" icon="i-bx-plus" size="xs"
          >Add from device</UButton
        >
      </label> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Media, BackgroundVideo } from "~/types"
const appStore = useAppStore()

defineProps<{
  value: string
}>()

const emit = defineEmits(["select"])

// const backgroundVideoKeys = [
//   "/video-bg-1.mp4",
//   "/video-bg-2.mp4",
//   "/video-bg-3.mp4",
//   "/video-bg-4.mp4",
//   "/video-bg-5.mp4",
//   "/video-bg-6.mp4",
// ]
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

  // Create Object URLs from locally saved images
  const locallySavedVideos: BackgroundVideo[] = []
  videos.forEach((video) => {
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
  // console.log("locallySavedVideos", locallySavedVideos)
  // console.log("backgroundVideos", backgroundVideos.value)
  // if (backgroundVideos.value.length > 0) {
  //   backgroundVideos.value = backgroundVideos.value.concat(locallySavedVideos)
  // } else {
  //   backgroundVideos.value = locallySavedVideos
  // }
  locallySavedVideos.forEach((video) => {
    if (backgroundVideos.value.find((bgVideo) => bgVideo.id === video.id)) {
      return
    }
    backgroundVideos.value.push(video)
  })
  // console.log(backgroundVideos.value)
}

const saveAndSelectVideo = async (file: any) => {
  const db = useIndexedDB()
  const randomId = useID(6)
  const tempMedia: Media = {
    id: `/custom-video-bg-${randomId}.${file.type?.split("/")?.[1]}`,
    data: file,
    content: "video",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.cached.add(tempMedia)
  bgVideoToBeSelected.value = tempMedia.id
  await getAllLocallySavedVideos()
  // console.log(bgVideoToBeSelected.value, tempMedia.id)
  emit("select", { video: bgVideoToBeSelected.value, key: tempMedia.id })
}

getAllLocallySavedVideos()

// onBeforeUnmount(() => {
//   backgroundVideos?.value?.forEach((url) => {
//     URL.revokeObjectURL(url)
//   })
// })
</script>
