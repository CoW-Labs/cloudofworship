<template>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId"
  >
    <div
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
        <!-- •
        <UButton
          size="lg"
          color="black"
          class="font-bold"
          @click="transmitScreenCapture"
        >
          Stream via NDI
        </UButton> -->
      </div>
    </div>
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
import type { Slide } from "~/types"
import { useAppStore } from "@/store/app"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const slides = ref<Slide[]>(appStore.currentState.activeSlides || [])
const liveSlide = ref<Slide | null>(null)
const isFullScreen = ref(false)
const downloadProgress = ref<string>("0")
const downloadResource = ref<string>("")
const route = useRoute()
const socket = ref<WebSocket | null>(null)

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

onBeforeUnmount(() => {
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})

const db = useIndexedDB()

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
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-1.mp4`,
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

saveAllBackgroundVideos()

// WEBSOCKETS
socket.value = await useSocket(route.params.schedule_id as string)

socket.value.onopen = (event) => {}

socket.value.onmessage = (event) => {
  const { data, action, message } = JSON.parse(event.data)
  console.log(action, data)

  switch (action) {
    case "connected":
      slides.value = data
      break
    case "live-slide":
      liveSlide.value = data
      break
    case "new-slide":
      break
    case "updated-slides":
      break
    default:
      console.log("Unknown action:", data.action)
  }
}
</script>
