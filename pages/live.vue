<template>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="liveSlideId"
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
        v-for="liveSlide in activeSlides"
        :key="liveSlide.id"
        v-show="liveSlide?.id === liveSlideId"
        :content-visible="true"
        :id="liveSlideId"
        :full-screen="true"
        :slide="liveSlide"
        :slide-label="false"
        :slide-styles="settings.slideStyles"
        :audio-muted="
          liveSlide?.id !== liveSlideId || liveSlide?.slideStyle?.isMediaMuted
        "
      />
    </TransitionGroup>
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "@/store/app"
const appStore = useAppStore()
const { liveSlideId, activeSlide, activeSlides, settings } =
  storeToRefs(appStore)
const isFullScreen = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10

const liveSlide = computed(() => {
  // console.log(activeSlides.value)
  console.log(liveSlideId.value)
  return activeSlides.value.find((slide) => slide.id === liveSlideId.value)
})

useHead({
  title: "CoW Live",
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})

const displayMediaOptions: DisplayMediaStreamConstraints = {
  video: {
    displaySurface: "tab",
  },
  audio: {
    suppressLocalAudioPlayback: true,
  },
  preferCurrentTab: true,
  selfBrowserSurface: "include",
  systemAudio: "include",
  surfaceSwitching: "exclude",
  monitorTypeSurfaces: "exclude",
}

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("goto-verse", (data: any) => {
  // console.log("goto-verse", 1)
})

const checkFullScreen = () => {
  if (document.fullscreenElement) {
    isFullScreen.value = true
  } else {
    isFullScreen.value = false
  }
}

onMounted(() => {
  // const toast = useToast()
  // toast.add({
  //   icon: "i-bx-info-circle",
  //   title: "Double tap display to go full screen",
  // })

  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)

  checkFullScreen()

  //  Capture screen on load
  // transmitScreenCapture()
})

onBeforeUnmount(() => {
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
  stopScreenCapture()
})

const startScreenCapture = async () => {
  let captureStream = null
  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    )
  } catch (err) {
    console.log("Error getting screen capture stream", err)
  }
  return captureStream
}

const transmitScreenCapture = async () => {
  const socket = new WebSocket("ws://localhost:6787/ndi-livestream")
  const captureStream = await startScreenCapture()
  if (captureStream !== null) {
    mediaRecorder.value = new MediaRecorder(captureStream, {
      mimeType: "video/webm",
    })
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        socket.send(event.data)
        // console.log("data available", event.data)
      }
    }
    mediaRecorder.value.onstop = (event) => {
      // console.log("stopped", event)
    }
    mediaRecorder.value.start()

    mediaRecorderInterval.value = setInterval(() => {
      if (mediaRecorder.value?.state !== "inactive") {
        mediaRecorder.value?.requestData()
      }
    }, 1000 / FPS)
    // console.log("mediaRecorder", mediaRecorder.value)
  } else {
    console.log("No capture stream")
  }
}

const stopScreenCapture = async () => {
  try {
    if (mediaRecorder.value) {
      mediaRecorder.value.stop()
      mediaRecorder.value.ondataavailable = null
      mediaRecorder.value = null
    }
    clearInterval(mediaRecorderInterval.value)
  } catch (err) {
    console.log("Error stopping screen capture", err)
  }
}
</script>

<style>
body {
  overflow: hidden;
}
</style>
