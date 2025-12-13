<template>
  <div
    class="media-main min-h-[75vh] lg:min-h-[75vh] xl:min-h-[80vh] 2xl:min-h-[82.5vh]"
  >
    <UTabs :items="mediaTabs" @change="activeTab = $event">
      <template #default="{ item }">
        <div class="flex gap-2 capitalize">
          <IconWrapper :name="item.icon" size="4" />
          {{ item.label }}
        </div>
      </template>
    </UTabs>

    <!-- FILES TAB -->
    <div v-if="activeTab === 0" class="collector-ctn flex flex-col gap-3 mt-4">
      <div
        class="alert flex gap-2 p-4 rounded-md bg-primary-100 dark:bg-primary-900"
      >
        <IconWrapper
          name="i-bx-info-circle"
          size="4"
          class="text-primary-500"
        />
        <div class="flex-1">
          <h4 class="text-md font-semibold">
            Add image, video or audio slides
          </h4>
          <p class="text-sm">
            You can now add files by dragging and dropping them here or by
            copying and pasting them from your file explorer.
          </p>
        </div>
      </div>

      <FileDropzone @change="files = $event" />
      <label v-if="isTauri" class="flex flex-col center text-center">
        <div
          class="text-center w-full mx-auto px-2 py-2 mt-1 bg-primary-500 rounded-md flex items-center text-primary-500 cursor-pointer gap-1 border border-primary-500 bg-transparent"
        >
          <IconWrapper name="i-bx-folder-open" size="5" />
          Choose files
        </div>
        <input
          type="file"
          class="invisible"
          accept="video/*,image/*,audio/*"
          multiple
          @change="files = $event.target?.files"
        />
      </label>
    </div>

    <!-- YOUTUBE/VIMEO TAB -->
    <div v-if="activeTab === 1" class="collector-ctn flex flex-col gap-3 mt-4">
      <div
        class="alert flex gap-2 p-4 rounded-md bg-primary-100 dark:bg-primary-900"
      >
        <IconWrapper
          name="i-bx-info-circle"
          size="4"
          class="text-primary-500"
        />
        <div class="flex-1">
          <h4 class="text-md font-semibold">Add YouTube or Vimeo videos</h4>
          <p class="text-sm">
            Paste a YouTube or Vimeo URL below to add external videos to your
            schedule.
          </p>
        </div>
      </div>

      <!-- YouTube/Vimeo URL Input -->
      <div class="flex flex-col gap-2">
        <UInput
          v-model="externalVideoUrl"
          placeholder="Paste YouTube or Vimeo URL here..."
          class="flex-1"
          size="lg"
          icon="i-bx-link"
        />
        <UButton
          @click="addExternalVideo"
          :disabled="!externalVideoUrl"
          icon="i-bx-plus"
          size="lg"
          class="justify-center mt-1"
        >
          Add external video
        </UButton>
      </div>
    </div>
    <!-- PREVIEW AND CREATE BUTTON -->
    <div v-if="fileObjs?.length > 0" class="preview-ctn flex flex-col mt-8">
      <UButton
        class="mb-2 w-[100%] flex justify-between"
        trailing-icon="i-bx-chevron-right"
        :loading="imageCompressionLoading"
        @click="addMediaEmitter"
        size="lg"
        >Create {{ fileObjs?.length }} Slide{{
          fileObjs?.length > 1 ? "s" : ""
        }}</UButton
      >
      <Transition name="fade-sm">
        <div
          class="grid gap-2 max-h-[250px] overflow-auto rounded-md overflow-x-hidden"
          :class="
            fileObjs?.length === 1 || isAnyFileExternal
              ? 'grid-cols-1'
              : 'grid-cols-3'
          "
        >
          <div
            v-for="(fileObj, index) in fileObjs"
            :key="fileObj.name"
            v-show="fileObj"
            class="file-preview relative border-2 border-primary-100 dark:border-primary-800 rounded-md flex min-h-[100px] cursor-pointer group hover:border-primary-500 transition-all"
            @click="removeFile(index)"
          >
            <!-- External Videos (YouTube/Vimeo) -->

            <div class="flex flex-col gap-2" v-if="fileObj.isExternal">
              <div
                v-for="(video, index) in externalVideos"
                :key="index"
                class="flex items-center gap-2 p-3 rounded-md bg-primary-50 dark:bg-primary-900 hover:bg-primary-100 dark:hover:bg-primary-800 transition-all h-full w-[100%]"
              >
                <IconWrapper
                  :name="
                    video.type === 'youtube' ? 'i-bxl-youtube' : 'i-bxl-vimeo'
                  "
                  size="6"
                  :class="
                    video.type === 'youtube' ? 'text-red-500' : 'text-blue-500'
                  "
                />
                <div class="flex-1">
                  <p class="text-sm font-medium">{{ video.name }}</p>
                  <p class="text-xs text-gray-500 truncate w-[250px]">
                    {{ video.url }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Regular Files -->
            <template v-else>
              <img
                v-if="fileObj?.type === 'image'"
                :src="fileObj.url"
                alt="previewed slide image"
                class="rounded-md max-h-[40vh] 2xl:max-h-[100%] bg-primary-950 object-contain"
              />
              <audio
                v-if="fileObj?.type === 'audio'"
                alt="previewed slide image"
                controls
                class="max-h-[40vh] 2xl:max-h-[100%] w-[100%]"
              >
                <source :src="fileObj.url" type="audio/mp3" />
              </audio>
              <video
                v-else-if="fileObj?.type === 'video'"
                :src="fileObj.url"
                autoplay
                muted
                alt="previewed slide image"
                class="rounded-md max-h-[40vh] 2xl:max-h-[100%]"
              />
              <div class="absolute top-0 left-1">
                <IconWrapper
                  v-if="fileObj.type?.includes('image')"
                  name="i-bx-image"
                  size="4"
                  class="text-white"
                />
                <IconWrapper
                  v-if="fileObj.type?.includes('video')"
                  name="i-bx-movie"
                  size="4"
                  class="text-white"
                />
              </div>
            </template>

            <div
              class="bg-primary-800 opacity-0 absolute inset-0 flex items-center justify-center rounded-md group-hover:opacity-90 transition-all"
            >
              <IconWrapper name="i-bx-trash" size="8" class="text-white" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import type { Emitter } from "mitt"
import type { ExtendedFileT, ExternalVideo } from "~/types"

const props = defineProps<{
  initialTab?: number
}>()

const imageCompressionLoading = ref(false)
const { isTauri } = useTauri()
const emitter = useNuxtApp().$emitter as Emitter<any>
const files = ref()
const emit = defineEmits(["close"])
const externalVideoUrl = ref("")
const externalVideos = ref<ExternalVideo[]>([])
const toast = useToast()
const activeTab = ref(props.initialTab || 0)

const mediaTabs = [
  {
    label: "Files",
    icon: "i-bx-image",
  },
  {
    label: "YouTube/Vimeo",
    icon: "i-bx-link",
  },
]

const detectVideoType = (url: string): string => {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube"
  } else if (url.includes("vimeo.com")) {
    return "vimeo"
  }
  return "other"
}

const extractVideoName = (url: string): string => {
  const type = detectVideoType(url)
  if (type === "youtube") {
    const videoId = url.includes("youtu.be")
      ? url.split("youtu.be/")[1]?.split("?")[0]
      : url.split("v=")[1]?.split("&")[0]
    return `YouTube Video ${videoId ? `(${videoId})` : ""}`
  } else if (type === "vimeo") {
    const videoId = url.split("vimeo.com/")[1]?.split("?")[0]
    return `Vimeo Video ${videoId ? `(${videoId})` : ""}`
  }
  return "External Video"
}

const addExternalVideo = () => {
  if (!externalVideoUrl.value) return

  const type = detectVideoType(externalVideoUrl.value)
  if (type === "other") {
    toast.add({
      title: "Invalid URL",
      description: "Please enter a valid YouTube or Vimeo URL",
      icon: "i-bx-error",
      color: "red",
    })
    return
  }

  const video: ExternalVideo = {
    url: externalVideoUrl.value,
    type: type,
    name: extractVideoName(externalVideoUrl.value),
  }

  externalVideos.value.push(video)
  externalVideoUrl.value = ""
}

const removeExternalVideo = (index: number) => {
  externalVideos.value.splice(index, 1)
}

const fileObjs = computed(() => {
  const tempArr: any[] = []

  // Add file objects
  files.value?.forEach((file: any) => {
    if (file) {
      tempArr.push({
        blob: file,
        name: file?.name,
        size: file?.size,
        type: file?.type?.split("/")?.[0],
        url: URL.createObjectURL(file),
      })
    }
  })

  // Add external videos
  externalVideos.value?.forEach((video) => {
    tempArr.push({
      name: video.name,
      type: video.type,
      url: video.url,
      isExternal: true,
    })
  })

  return tempArr
})

const isAnyFileExternal = computed(() => {
  return fileObjs.value?.find((file) => file.isExternal)
})

const addMediaEmitter = async () => {
  imageCompressionLoading.value = true
  // console.log("uncompressedFiles", fileObjs.value)
  const compressedFiles = await Promise.all(
    fileObjs.value.map(async (fileObj) => {
      // Handle external videos
      if (fileObj.isExternal) {
        return {
          name: fileObj.name,
          type: fileObj.type,
          url: fileObj.url,
          isExternal: true,
        } as ExtendedFileT & { isExternal: boolean }
      }

      // Handle regular files
      let compressedFile = fileObj.blob
      if (fileObj.type.includes("image")) {
        compressedFile = await useCompressedImage(fileObj.blob)
      }
      URL.revokeObjectURL(fileObj.url)
      return {
        ...fileObj,
        blob: compressedFile,
        url: URL.createObjectURL(compressedFile),
      } as ExtendedFileT
    })
  )
  // console.log("compressedFiles", compressedFiles)
  imageCompressionLoading.value = false
  useGlobalEmit(appWideActions.newMedia, compressedFiles)
  files.value = []
  externalVideos.value = []
  emit("close")
}

const removeFile = (index: number) => {
  const fileObj = fileObjs.value[index]
  if (fileObj.isExternal) {
    const externalIndex = externalVideos.value.findIndex(
      (v) => v.url === fileObj.url
    )
    if (externalIndex !== -1) {
      removeExternalVideo(externalIndex)
    }
  } else {
    const filesArray = Array.from(files.value || [])
    filesArray.splice(index - externalVideos.value.length, 1)
    files.value = filesArray
  }
}
</script>
