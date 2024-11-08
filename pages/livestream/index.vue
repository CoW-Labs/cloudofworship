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
        v-for="liveSlide in currentState.activeSlides"
        :key="liveSlide.id"
        v-show="liveSlide?.id === currentState.liveSlideId"
        :content-visible="true"
        :id="currentState.liveSlideId"
        :full-screen="true"
        :slide="liveSlide"
        :slide-label="false"
        :slide-styles="currentState.settings.slideStyles"
        :audio-muted="
          liveSlide?.id !== currentState.liveSlideId ||
          liveSlide?.slideStyle?.isMediaMuted
        "
      />
    </TransitionGroup>

    <AlertView />
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "@/store/app"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const isFullScreen = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10
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

const liveSlide = computed(() => {
  // console.log(activeSlides.value)
  console.log(currentState.value.liveSlideId)
  return currentState.value.activeSlides.find(
    (slide) => slide.id === currentState.value.liveSlideId
  )
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

  window.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded")
    // document.documentElement.requestFullscreen()
  })

  checkFullScreen()

  //  Capture screen on load
  // transmitScreenCapture()
})

onBeforeUnmount(() => {
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})

// socket.value = await useSocket(currentState.value.activeSchedule?._id)

// socket.value.onmessage = (event) => {
//   const data = JSON.parse(event.data)
//   console.log(data)

//   switch (data.action) {
//     case "live-slide":
//       break
//     case "new-slide":
//       break
//     case "updated-slides":
//       break
//     default:
//       console.log("Unknown action:", data.action)
//   }
// }

// socket.value.onclose = async () => {
//   socket.value = await useSocket(currentState.value.activeSchedule?._id)
// }
</script>
