<template>
  <div class="media-main flex h-full min-h-0 flex-col">
    <div
      class="relative flex min-h-0 flex-1 flex-col rounded-xl bg-white p-1.5 dark:bg-[#222938]"
    >
      <!-- Scrolls under the floating CTA below. -->
      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <UTabs v-model="activeTab" :items="mediaTabs" />

        <!-- FILES TAB -->
        <div
          v-if="activeTab === 0"
          class="collector-ctn flex flex-col gap-3 mt-4"
        >
          <Hint dismissible dismiss-key="add-media-drag-drop">
            You can now add files by dragging and dropping them here or by
            copying and pasting them from your file explorer.
          </Hint>

          <FileDropzone
            upload-layout="row"
            title="Upload a File or Drag and Drop here"
            caption="jpg, jpeg, png, mp4, mov · Max 15MB"
            :maxFileSize="maxFileSize"
            :maxVideoFileSize="maxVideoFileSize"
            accept="video/*,image/*,audio/*"
            @change="onDropzoneChange"
          />
        </div>

        <!-- YOUTUBE/VIMEO TAB -->
        <div
          v-if="activeTab === 1"
          class="collector-ctn flex flex-col gap-3 mt-4"
        >
          <Hint dismissible dismiss-key="add-media-external-video">
            Paste a YouTube or Vimeo link below and we'll fetch the video for
            you.
          </Hint>

          <CowInput
            v-model="externalVideoUrl"
            label="YouTube or Vimeo URL"
            @paste="onExternalUrlPaste"
          />
          <div
            v-if="isFetchingExternalVideo"
            class="flex items-center gap-2 px-1 text-[12px] text-gray-500 dark:text-[#9BA3B2]"
          >
            <UIcon name="i-bx-loader-alt" class="animate-spin text-base" />
            <span>Fetching video&hellip;</span>
          </div>
        </div>

        <!-- PICKED FILES -->
        <div v-if="fileObjs?.length > 0" class="preview-ctn mt-6">
          <p class="text-[13px] text-gray-500 dark:text-[#9BA3B2]">
            {{ pickedFilesLabel }}
          </p>
          <!-- Negative margin cancels the panel padding so the rule is full-bleed -->
          <div
            class="-mx-1.5 mt-3 border-b border-gray-200 dark:border-white/5"
          ></div>

          <Transition name="fade-sm">
            <div
              class="mt-3 grid gap-2"
              :class="isAnyFileExternal ? 'grid-cols-1' : 'grid-cols-3'"
            >
              <div
                v-for="(fileObj, index) in fileObjs"
                :key="fileObj.url"
                v-show="fileObj"
                class="file-preview group relative flex cursor-pointer overflow-hidden rounded-lg transition-all"
                :class="
                  fileObj.isExternal
                    ? ''
                    : 'aspect-square bg-black/5 dark:bg-black/20'
                "
                @click="removeFile(index)"
              >
                <!-- External Videos (YouTube/Vimeo) -->
                <div
                  v-if="fileObj.isExternal"
                  class="w-full flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/5"
                >
                  <!-- Thumbnail -->
                  <div
                    class="relative w-32 h-20 flex-shrink-0 rounded-md overflow-hidden bg-primary-100 dark:bg-primary-800"
                  >
                    <img
                      v-if="fileObj.thumbnail"
                      :src="fileObj.thumbnail"
                      :alt="fileObj.name"
                      class="w-full h-full object-cover"
                      @error="onThumbnailError"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center"
                    >
                      <IconWrapper
                        :name="
                          fileObj.type === 'youtube'
                            ? 'i-bxl-youtube'
                            : 'i-bxl-vimeo'
                        "
                        size="8"
                        :class="
                          fileObj.type === 'youtube'
                            ? 'text-red-500'
                            : 'text-blue-500'
                        "
                      />
                    </div>
                    <!-- Play overlay -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"
                    >
                      <IconWrapper
                        :name="
                          fileObj.type === 'youtube'
                            ? 'i-bxl-youtube'
                            : 'i-bxl-vimeo'
                        "
                        size="8"
                        class="text-white opacity-90"
                      />
                    </div>
                  </div>

                  <!-- Video Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium line-clamp-2">
                      {{ fileObj.name }}
                    </p>
                    <p class="text-xs text-gray-500 truncate mt-1">
                      {{ fileObj.url }}
                    </p>
                  </div>
                </div>

                <!-- Regular Files -->
                <template v-else>
                  <img
                    v-if="fileObj?.type === 'image'"
                    :src="fileObj.url"
                    alt="previewed slide image"
                    class="h-full w-full object-cover"
                  />
                  <audio
                    v-if="fileObj?.type === 'audio'"
                    alt="previewed slide audio"
                    controls
                    class="w-[100%] self-center px-1"
                  >
                    <source :src="fileObj.url" type="audio/mp3" />
                  </audio>
                  <video
                    v-else-if="fileObj?.type === 'video'"
                    :src="fileObj.url"
                    autoplay
                    muted
                    alt="previewed slide video"
                    class="h-full w-full object-cover"
                  />
                  <div class="absolute top-1 left-1">
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
                  class="bg-primary-800 opacity-0 absolute inset-0 flex items-center justify-center rounded-lg group-hover:opacity-90 transition-all"
                >
                  <DeleteIcon class="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- FLOATING CTA — content scrolls underneath it -->
      <Transition name="fade-sm">
        <div
          v-if="fileObjs?.length > 0"
          class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-transparent p-3 pt-10 dark:from-[#222938] dark:via-[#222938]"
        >
          <CowButton
            variant="primary"
            class="pointer-events-auto"
            block
            size="lg"
            @click="addMediaEmitter"
          >
            Create slides
          </CowButton>
        </div>
      </Transition>
    </div>
  </div>
</template>
<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import { useAuthStore } from "~/store/auth"
import { useDebounceFn } from "@vueuse/core"
import type { Emitter } from "mitt"
import type { ExtendedFileT, ExternalVideo } from "~/types"

const props = defineProps<{
  initialTab?: number
}>()

const authStore = useAuthStore()

// Local limits are capacity-based. Cloud subscription limits remain enforced
// independently by the upload API.
const maxFileSize = computed(() => Infinity)
const maxVideoFileSize = computed(() => Infinity)
const emitter = useNuxtApp().$emitter as Emitter<any>
const files = ref()
const emit = defineEmits(["close"])
const externalVideoUrl = ref("")
const externalVideos = ref<ExternalVideo[]>([])
const isFetchingExternalVideo = ref(false)
const toast = useToast()
const activeTab = ref(props.initialTab || 0)
const urlCache = new Map<File, string>()

watch(
  () => files.value,
  (newFiles) => {
    const currentFiles = new Set<File>(Array.from(newFiles || []))
    urlCache.forEach((url, file) => {
      if (!currentFiles.has(file)) {
        URL.revokeObjectURL(url)
        urlCache.delete(file)
      }
    })
    currentFiles.forEach((file) => {
      if (!urlCache.has(file)) {
        urlCache.set(file, URL.createObjectURL(file))
      }
    })
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  urlCache.forEach((url) => URL.revokeObjectURL(url))
  urlCache.clear()
})

const mediaTabs = [
  {
    label: "Files",
    icon: "i-bx-image",
  },
  {
    label: "Youtube/Vimeo Links",
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

const extractVideoId = (url: string, type: string): string => {
  if (type === "youtube") {
    if (url.includes("youtu.be")) {
      return url.split("youtu.be/")[1]?.split("?")[0] || ""
    } else if (url.includes("/shorts/")) {
      return url.split("/shorts/")[1]?.split("?")[0] || ""
    } else {
      return url.split("v=")[1]?.split("&")[0] || ""
    }
  } else if (type === "vimeo") {
    return url.split("vimeo.com/")[1]?.split("?")[0]?.split("/")[0] || ""
  }
  return ""
}

const getVideoThumbnail = (videoId: string, type: string): string => {
  if (type === "youtube") {
    // YouTube thumbnail URLs - maxresdefault for highest quality, fallback to hqdefault
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  } else if (type === "vimeo") {
    // For Vimeo, we'll need to fetch from API - return placeholder for now
    return `https://vumbnail.com/${videoId}.jpg`
  }
  return ""
}

const fetchVideoMetadata = async (
  url: string,
  type: string,
  videoId: string
): Promise<{ title: string; thumbnail: string }> => {
  try {
    if (type === "youtube") {
      // For YouTube, use oEmbed API (no API key needed)
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          url
        )}&format=json`
      )
      if (response.ok) {
        const data = await response.json()
        return {
          title: data.title || `YouTube Video (${videoId})`,
          thumbnail: getVideoThumbnail(videoId, type),
        }
      }
    } else if (type === "vimeo") {
      // For Vimeo, use oEmbed API
      const response = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
      )
      if (response.ok) {
        const data = await response.json()
        return {
          title: data.title || `Vimeo Video (${videoId})`,
          thumbnail: data.thumbnail_url || getVideoThumbnail(videoId, type),
        }
      }
    }
  } catch (error) {
    console.error("Error fetching video metadata:", error)
  }

  // Fallback
  return {
    title:
      type === "youtube"
        ? `YouTube Video (${videoId})`
        : `Vimeo Video (${videoId})`,
    thumbnail: getVideoThumbnail(videoId, type),
  }
}

const addExternalVideo = async () => {
  const url = externalVideoUrl.value?.trim()
  if (!url || isFetchingExternalVideo.value) return

  const type = detectVideoType(url)
  // Typing a URL fires this on every keystroke, so an incomplete link is not an
  // error yet — stay quiet and wait for a recognisable host.
  if (type === "other") return

  const videoId = extractVideoId(url, type)
  if (!videoId) {
    toast.add({
      title: "Invalid URL",
      description: "Could not extract video ID from URL",
      icon: "i-bx-error",
      color: "red",
    })
    return
  }

  if (externalVideos.value.some((video) => video.url === url)) {
    externalVideoUrl.value = ""
    return
  }

  isFetchingExternalVideo.value = true
  try {
    const metadata = await fetchVideoMetadata(url, type, videoId)

    const video: ExternalVideo = {
      url,
      type: type,
      name: metadata.title,
      thumbnail: metadata.thumbnail,
    }

    externalVideos.value.push(video)
    externalVideoUrl.value = ""
  } finally {
    isFetchingExternalVideo.value = false
  }
}

// Pasting is the primary path, but a typed/autofilled URL should work too, so
// both funnel through the same debounced fetch.
const debouncedAddExternalVideo = useDebounceFn(addExternalVideo, 500)

watch(externalVideoUrl, (url) => {
  if (url?.trim()) debouncedAddExternalVideo()
})

const onExternalUrlPaste = () => {
  // The bound value updates after the paste event, so let it settle first.
  nextTick(() => debouncedAddExternalVideo())
}

const removeExternalVideo = (index: number) => {
  externalVideos.value.splice(index, 1)
}

const PLACEHOLDER_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E"

// YouTube maxresdefault is missing for many videos; fall back to hqdefault, then a placeholder
const onThumbnailError = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (img.src.includes("maxresdefault")) {
    img.src = img.src.replace("maxresdefault", "hqdefault")
  } else {
    img.src = PLACEHOLDER_THUMBNAIL
  }
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
        url: urlCache.get(file) || URL.createObjectURL(file),
      })
    }
  })

  // Add external videos
  externalVideos.value?.forEach((video) => {
    tempArr.push({
      name: video.name,
      type: video.type,
      url: video.url,
      thumbnail: video.thumbnail,
      isExternal: true,
    })
  })

  return tempArr
})

const isAnyFileExternal = computed(() => {
  return fileObjs.value?.find((file) => file.isExternal)
})

// The design labels this section "Uploaded Images"; widen it when the picks
// aren't all images so the header never mislabels what's on screen.
const pickedFilesLabel = computed(() => {
  const types = new Set(
    fileObjs.value.map((file) => (file.isExternal ? "video" : file.type))
  )
  if (types.size === 1 && types.has("image")) return "Uploaded Images"
  if (types.size === 1 && types.has("video")) return "Uploaded Videos"
  if (types.size === 1 && types.has("audio")) return "Uploaded Audio"
  return "Uploaded Files"
})

const addMediaEmitter = () => {
  // Emit immediately with the original blobs so slides reach the schedule
  // instantly. Image compression now runs in the background just before upload
  // (see createMultipleMediaSlides), so the user no longer waits on the worker.
  const mediaFiles = fileObjs.value.map((fileObj) => {
    // Handle external videos
    if (fileObj.isExternal) {
      return {
        name: fileObj.name,
        type: fileObj.type,
        url: fileObj.url,
        thumbnail: fileObj.thumbnail,
        isExternal: true,
      } as unknown as ExtendedFileT & { isExternal: boolean }
    }

    // Fresh object URL from the original blob — the cached preview URL is
    // revoked when `files` clears below, so the slide needs its own.
    return {
      ...fileObj,
      url: URL.createObjectURL(fileObj.blob),
    } as ExtendedFileT
  })
  useGlobalEmit(appWideActions.newMedia, mediaFiles)
  files.value = []
  externalVideos.value = []
  emit("close")
}

const onDropzoneChange = (incomingFiles: FileList | File[]) => {
  // Single validation gate for BOTH the dropzone and the Tauri file input.
  // FileDropzone pre-filters, but the Tauri input feeds raw files straight here,
  // so size limits must be enforced before files.value is updated.
  const validFiles: File[] = []
  Array.from(incomingFiles || []).forEach((file) => {
    if (
      file.type.startsWith("image") &&
      file.size > maxFileSize.value * 1024 * 1024
    ) {
      toast.add({
        title: `Image size exceeds ${maxFileSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    if (
      file.type.startsWith("video") &&
      file.size > maxVideoFileSize.value * 1024 * 1024
    ) {
      toast.add({
        title: `Video size exceeds ${maxVideoFileSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    validFiles.push(file)
  })
  if (validFiles.length === 0) return
  // Accumulate so multiple drops/selections build up the preview set without
  // losing previously added (or removed) files.
  files.value = [...Array.from(files.value || []), ...validFiles]
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
    filesArray.splice(index, 1)
    files.value = filesArray
  }
}
</script>
