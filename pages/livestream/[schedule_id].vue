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
    :id="currentState.liveSlideId"
    v-else
  >
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
    <!-- :content-visible="liveSlide?.id === liveSlideId" -->
    <TransitionGroup name="fade-list">
      <LiveProjectionOnly
        v-for="slide in slides"
        :key="slide.id"
        v-show="slide?.id === liveSlide?.id"
        :content-visible="true"
        :id="slide.id"
        :full-screen="true"
        :slide="slide"
        :slide-label="false"
        :slide-styles="currentState.settings.slideStyles"
        :audio-muted="
          slide?.id !== currentState.liveSlideId ||
          slide?.slideStyle?.isMediaMuted
        "
      />
    </TransitionGroup>

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
const slides = ref<Slide[]>(appStore.currentState.activeSlides || [])
const liveSlide = ref<Slide | null>(null)
const isFullScreen = ref(false)
const downloadProgress = ref<string>("0")
const downloadResource = ref<string>("")
const route = useRoute()
const socket = ref<WebSocket | null>(null)
const loadingResources = ref<boolean>(true)
const online = useOnline()
const downloadStep = ref<number>(0)
const fullScreenLoading = ref<boolean>(false)
const cachedVideosURLs = ref<BackgroundVideo[]>()
const isOfflineToastOpen = ref<boolean>(false)
const db = useIndexedDB()

const MAX_RETRIES = 30
let retryCount = 0

useHead({
  title: "CoW Live",
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})

const isAppOnline = computed(() => {
  isOfflineToastOpen.value = !online.value
  return online.value
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

onBeforeUnmount(() => {
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})

const saveAllBackgroundVideos = async () => {
  const savedBgVideo1 = await db.cached.get("/video-bg-1.mp4")
  const savedBgVideo2 = await db.cached.get("/video-bg-2.mp4")
  const savedBgVideo3 = await db.cached.get("/video-bg-3.mp4")
  const savedBgVideo4 = await db.cached.get("/video-bg-4.mp4")
  const savedBgVideo5 = await db.cached.get("/video-bg-5.mp4")
  const savedBgVideo6 = await db.cached.get("/video-bg-6.mp4")

  const saveBackground = (blob: any, index: number) => {
    const tempMedia: Media = {
      id: `/video-bg-${index}.mp4`,
      data: blob,
      content: "video",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.cached.add(tempMedia)
  }

  downloadResource.value = "background videos"
  if (!savedBgVideo1) {
    const bgVideoPromise = await useDetailedFetch(
      `https://presentation-software.s3.eu-west-3.amazonaws.com/open/bg-videos/video-bg-1.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 1)
  }

  if (!savedBgVideo2) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-2.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 2)
  }

  if (!savedBgVideo3) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-3.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 3)
  }

  if (!savedBgVideo4) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-4.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 4)
  }

  if (!savedBgVideo5) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-5.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 5)
  }

  if (!savedBgVideo6) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-6.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 6)
  }
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  const tempCachedVideos = cachedVideos?.map((cached: BackgroundVideo) => ({
    id: cached?.id,
    url: URL.createObjectURL(cached?.data),
  }))
  cachedVideosURLs.value = tempCachedVideos as BackgroundVideo[]
  // console.log(tempCachedVideosURLs)
  appStore.setBackgroundVideos(tempCachedVideos)
}

const updateBlobBackgroundURl = (slide: Slide) => {
  if (
    slide.background?.startsWith("blob:") &&
    slide.backgroundType === backgroundTypes.video
  ) {
    slide.background = currentState.value.backgroundVideos?.find(
      (video) => video.id === slide.backgroundVideoKey
    )?.url
  }
  return slide
}

const updateBlobBackgroundURls = (slides: Slide[]) => {
  return slides?.map((slide) => updateBlobBackgroundURl(slide))
}

const connectWebSocket = async () => {
  socket.value = await useSocket(route.params.schedule_id as string)

  socket.value.onopen = (event) => {}

  socket.value.onmessage = (event) => {
    const { data, action, message } = JSON.parse(event.data)
    // console.log(action, data)

    switch (action) {
      case "connected":
        slides.value = data
        updateBlobBackgroundURls(data)
        break
      case "live-slide":
        const tempSlide = updateBlobBackgroundURl(data)
        liveSlide.value = tempSlide
        // console.log("liveSlide", liveSlide.value)
        break
      case "new-slide":
        slides.value.push(data)
        break
      case "update-slide":
        const slideId = data?._id
        const slideData = updateBlobBackgroundURl(data)
        slides.value.splice(
          slides.value.findIndex((slide) => slide?._id === slideId),
          1,
          slideData
        )
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
      case "updated-slides":
        break
      default:
      // DO SOMETHING
      // console.log("Unknown action:", data.action)
    }
  }

  socket.value.onclose = async () => {
    console.log("websocket connection closed")
    if (retryCount < MAX_RETRIES && isAppOnline.value) {
      retryCount++
      const retryDelay = retryCount * 3000
      console.log(`Reconnecting in ${retryDelay / 1000} seconds...`)
      setTimeout(connectWebSocket, retryDelay)
    } else {
      console.error("Max reconnect attempts reached. Unable to reconnect.")
    }
  }

  socket.value.onerror = (error) => {
    console.error("WebSocket connection error:", error)
    socket.value.close() // Close on error to trigger the onclose event
  }
}

onBeforeMount(async () => {
  await saveAllBackgroundVideos()
  await setCachedVideosURL()

  // All computations completed
  downloadStep.value = 5
  downloadResource.value = "All resources downloaded."

  // Connect to websocket
  await connectWebSocket()

  setTimeout(() => {
    loadingResources.value = false
  }, 100)
})
</script>
