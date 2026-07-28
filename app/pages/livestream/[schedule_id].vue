<template>
  <div
    v-if="loadingResources"
    class="loading-ctn h-[100vh] w-[100vw] fixed inset-0 grid place-items-center dark:bg-gray-900"
  >
    <div class="wrapper flex flex-col gap-6">
      <div class="logo flex items-center justify-center mb-6 gap-2">
        <Logo class="w-[64px]" />
        <h1 class="text-2xl font-semibold">Cloud of Worship</h1>
      </div>
      <div class="progress-wrapper text-center relative">
        <UProgress
          size="2xl"
          class="text-center"
          :value="parseInt(downloadProgress)"
          :max="100"
        />
        <UProgress
          v-show="downloadStep === 2"
          size="2xl"
          class="text-center absolute top-0 left-0 opacity-50"
          color="white"
        />
        <UProgress
          v-show="downloadStep === 4"
          size="2xl"
          class="text-center absolute top-0 left-0 opacity-50"
          color="white"
        />
        <div
          v-if="downloadStep !== 5"
          class="text-md font-semibold w-[300px] flex items-center justify-between mt-4"
        >
          <span class="font-normal">
            <div class="text-left">Loading {{ downloadResource }}</div>
            <div class="opacity-50 text-left">
              This might take a while
            </div></span
          >
          <span>{{ parseInt(downloadProgress) || 0 }}%</span>
        </div>
        <div
          v-else
          class="text-md font-semibold w-[300px] flex items-center justify-center mt-4"
        >
          <span class="font-normal">
            {{ downloadResource }}
          </span>
        </div>
      </div>
    </div>
  </div>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId?.toString()"
    v-else
  >
    <!-- Connection Status Indicator -->
    <div
      v-if="connectionStatus !== 'connected'"
      class="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
      :class="{
        'bg-primary-200 text-primary-800':
          connectionStatus === 'connecting' ||
          connectionStatus === 'disconnected',
        'bg-red-500 text-white': connectionStatus === 'failed',
      }"
    >
      <div
        v-if="
          connectionStatus === 'connecting' ||
          connectionStatus === 'disconnected'
        "
        class="w-2 h-2 bg-primary-800 rounded-full animate-pulse"
      ></div>
      <span class="text-sm font-medium">
        {{
          connectionStatus === "connecting"
            ? "Connecting..."
            : connectionStatus === "disconnected"
            ? "Reconnecting..."
            : "Connection Failed"
        }}
      </span>
    </div>

    <!-- <div
      v-if="!isFullScreen"
      class="banner inset-0 bottom-auto h-[60px] flex items-center justify-center bg-primary-100 text-black text-center bg-opacity-70"
    >
      <div class="banner-text text-lg flex items-center gap-6">
        <span
          ><span class="font-bold">Double click</span> the display below to
          toggle full screen and remove this banner</span
        >
        •
        <span class="flex items-center gap-2 font-bold"
          ><Logo class="w-[34px] mb-2" /> Cloud of Worship</span
        >
      </div>
    </div> -->

    <LiveProjectionOnly
      v-if="liveSlide"
      :content-visible="true"
      :id="liveSlide?.id"
      :full-screen="true"
      :slide="liveSlide!!"
      :slide-label="false"
      :slide-styles="currentState.settings.slideStyles"
      :audio-muted="
          liveSlide?.slideStyle?.isMediaMuted!!
        "
    />
    <AlertView />
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import type { BackgroundVideo, Slide } from "~/types"
import { useAppStore } from "@/store/app"
import { useOnline } from "@vueuse/core"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const liveSlide = ref<Slide | null>(null)
const isFullScreen = ref(false)
const downloadProgress = ref<string>("0")
const downloadResource = ref<string>("")
const route = useRoute()
const loadingResources = ref<boolean>(true)
const online = useOnline()
const downloadStep = ref<number>(0)
const cachedVideosURLs = ref<BackgroundVideo[]>()
const localMedia = useLocalMediaStorage()
const { rehydrateSlideMedia, prefetchScheduleMedia } = useSlideMediaCache()
const connectionStatus = ref<
  "connecting" | "connected" | "disconnected" | "failed"
>("connecting")
const showConnectionError = ref(false)

useHead({
  title: "CoW Live",
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})

const checkFullScreen = () => {
  if (document.fullscreenElement) {
    isFullScreen.value = true
  } else {
    isFullScreen.value = false
  }
}

onMounted(() => {
  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)
  checkFullScreen()
})

const saveAllBackgroundVideos = async () => {
  const videoIds = [1, 2, 3, 4, 5, 6, 9, 10]
  const savedKeys = new Set(
    (await localMedia.listRecords()).map((record) => record.key)
  )

  downloadResource.value = "background videos"

  // Download videos that aren't cached yet - using a map for URLs
  const videoUrlMap: Record<number, string> = {
    1: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-1.mp4?v=v1",
    2: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-2.mp4?v=v1",
    3: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-3.mp4?v=v1",
    4: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-4.mp4?v=v1",
    5: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-5.mp4?v=v1",
    6: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-6.mp4?v=v1",
    9: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-9.mp4?v=v1",
    10: "https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-10.mp4?v=v1",
  }

  const missingVideoIds = videoIds.filter(
    (id) => !savedKeys.has(`/video-bg-${id}.mp4`)
  )

  const batchSize = 2
  for (let i = 0; i < missingVideoIds.length; i += batchSize) {
    await Promise.all(
      missingVideoIds.slice(i, i + batchSize).map(async (id) => {
        await localMedia.downloadToLocal({
          key: `/video-bg-${id}.mp4`,
          groupId: `/video-bg-${id}.mp4`,
          category: "preset",
          kind: "video",
          url: videoUrlMap[id]!,
          mimeType: "video/mp4",
          recoverable: true,
          onProgress: (fraction) => {
            if (Number.isFinite(fraction)) {
              downloadProgress.value = (fraction * 100).toFixed(2)
            }
          },
        })
      })
    )
  }
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  cachedVideosURLs.value = cachedVideos
  appStore.setBackgroundVideos(cachedVideos)
}

const updateBlobBackgroundURl = (slide: Slide) => {
  const updatedSlide = { ...slide }
  if (
    updatedSlide.background?.startsWith("blob:") &&
    updatedSlide.backgroundType === backgroundTypes.video
  ) {
    updatedSlide.background = currentState.value.backgroundVideos?.find(
      (video) => video.id === updatedSlide.backgroundVideoKey
    )?.url
  }
  return updatedSlide
}

const updateBlobBackgroundURls = (slides: Slide[]) => {
  if (!Array.isArray(slides)) return slides
  return slides?.map((slide) => updateBlobBackgroundURl(slide))
}

const localizeSlide = async (slide: Slide) =>
  await rehydrateSlideMedia(updateBlobBackgroundURl({ ...slide }), {
    allowDownload: true,
  })

const handleWebSocketMessage = async (parsedData: any) => {
  const { data, action } = parsedData

  switch (action) {
    case "connected":
      // Only process if data contains slides array
      if (Array.isArray(data)) {
        const slides = updateBlobBackgroundURls(data)
        await prefetchScheduleMedia(slides, currentState.value.liveSlideId)
      }
      break
    case "new-slide":
    case "slide-created":
      // New slide created in real-time
      break
    case "update-slide":
    case "slide-updated":
      // Update the livestream slide when any edit is made to the current live slide
      // This ensures real-time updates for content changes, not just live slide selections
      if (
        liveSlide.value?.id === data.id ||
        liveSlide.value?.id === data.slideId
      ) {
        // Create a new object to trigger Vue reactivity
        const slideData = await localizeSlide({ ...data })
        liveSlide.value = { ...slideData }
      }
      if (
        appStore.currentState.activeOverlaySlide?.id === data.id ||
        appStore.currentState.activeOverlaySlide?.id === data.slideId
      ) {
        appStore.setActiveOverlaySlide(await localizeSlide({ ...data }))
      }
      break
    case "delete-slide":
    case "slide-deleted":
      if (
        appStore.currentState.activeOverlaySlide?.id === data.slideId ||
        appStore.currentState.activeOverlaySlide?.id === data.id ||
        appStore.currentState.activeOverlaySlide?._id === data._id
      ) {
        appStore.setActiveOverlaySlide(null)
      }
      break
    case "add-alert":
      appStore.setActiveAlert(data)
      break
    case "remove-alert":
      appStore.setActiveAlert(null)
      break
    case "add-overlay":
      appStore.setActiveOverlay(data)
      break
    case "remove-overlay":
      appStore.setActiveOverlay("")
      break
    case "show-slide-overlay":
      appStore.setActiveOverlaySlide(await localizeSlide({ ...data }))
      break
    case "remove-slide-overlay":
      appStore.setActiveOverlaySlide(null)
      break
    case "updated-slides":
      break
    default:
    // Unknown action
  }
}

const socketManager = useSocketIO({
  scheduleId: route.params.schedule_id as string,
  maxRetries: 30,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  connectionTimeout: 10000,
  onMessage: (event, data) => void handleWebSocketMessage(data),
  onConnected: () => {
    connectionStatus.value = "connected"
    showConnectionError.value = false
    usePosthogCapture("REMOTE_CONTROL_CONNECTED", {
      scheduleId: route.params.schedule_id,
    })
  },
  onDisconnected: () => {
    connectionStatus.value = "disconnected"
    usePosthogCapture("REMOTE_CONTROL_DISCONNECTED", {
      scheduleId: route.params.schedule_id,
    })
  },
  onError: (error) => {
    console.error("❌ Socket error:", error)
    connectionStatus.value = "disconnected"
  },
  onMaxRetriesReached: () => {
    console.error("❌ Max retries reached. Could not establish connection.")
    connectionStatus.value = "failed"
    showConnectionError.value = true
  },
})

// Watch for reactive connection state changes for seamless reconnection
watch(
  () => socketManager.isConnectedRef?.value,
  (isConnected) => {
    if (isConnected) {
      connectionStatus.value = "connected"
      showConnectionError.value = false
    } else if (socketManager.isReconnecting?.value) {
      connectionStatus.value = "disconnected"
    }
  }
)

watch(
  () => socketManager.isReconnecting?.value,
  (isReconnecting) => {
    if (isReconnecting && !socketManager.isConnectedRef?.value) {
      connectionStatus.value = "disconnected"
    }
  }
)

onBeforeMount(async () => {
  await saveAllBackgroundVideos()
  await setCachedVideosURL()

  // All computations completed
  downloadStep.value = 5
  downloadResource.value = "All resources downloaded."

  // Connect to Socket.IO
  socketManager.connect()

  setTimeout(() => {
    loadingResources.value = false
  }, 100)
})

onBeforeUnmount(() => {
  // Clean up Socket.IO connection
  socketManager.disconnect()

  // Clean up fullscreen event listeners
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>
