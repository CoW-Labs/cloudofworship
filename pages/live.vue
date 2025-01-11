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
        v-for="liveSlide in viewableSlides"
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
import type { Slide } from "~/types"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const isFullScreen = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10
const mostUpdatedLiveSlide = ref<Slide | null>(null)

const activeSlides = computed(() => {
  const tempActiveSlides: Slide[] = [...currentState.value.activeSlides]
  if (mostUpdatedLiveSlide.value) {
    const mostUpdatedLiveSlideIndex = tempActiveSlides.findIndex(
      (slide) => slide.id === mostUpdatedLiveSlide.value?.id
    )
    if (mostUpdatedLiveSlideIndex !== -1) {
      tempActiveSlides.push(mostUpdatedLiveSlide.value!!)
    } else {
      tempActiveSlides.splice(
        mostUpdatedLiveSlideIndex,
        1,
        mostUpdatedLiveSlide.value!!
      )
    }
  }
  return tempActiveSlides
})

const viewableSlides = computed(() => {
  return activeSlides.value?.filter((slide) => {
    return slide.id === currentState.value.liveSlideId
  })
})

// const liveSlide = computed(() => {
//   // console.log(activeSlides.value)
//   // console.log(currentState.value.liveSlideId)
//   return currentState.value.activeSlides.find(
//     (slide) => slide.id === currentState.value.liveSlideId
//   )
// })

// LISTEN TO STATE CHANGES FOR SOCKET BROADCAST
// const socket = await useSocket()
// watch(liveSlideId, (newVal, oldVal) => {
//   console.log("liveSlideId", newVal)
//   socket.send(
//     JSON.stringify({
//       type: appWideActions.liveSlideIdTransfer,
//       data: newVal,
//     })
//   )
// })

// watch(
//   activeSlides,
//   (newVal, oldVal) => {
//     console.log("activeSlides", newVal)
//     socket.send(
//       JSON.stringify({
//         type: appWideActions.liveActiveSlidesTransfer,
//         data: newVal,
//       })
//     )
//   },
//   { deep: true }
// )

// watch(
//   settings,
//   (newVal, oldVal) => {
//     console.log("settings", newVal)
//     socket.send(
//       JSON.stringify({
//         type: appWideActions.liveSettingsTransfer,
//         data: newVal,
//       })
//     )
//   },
//   { deep: true }
// )

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

  // Prevent default action on specific keys
  document.addEventListener("keydown", function (event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "f" || event.key === "F")
    ) {
      event.preventDefault()
    }
  })

  // Shortcut to go full screen
  useCreateShortcut("f", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  })

  window.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded")
    // document.documentElement.requestFullscreen()
  })

  checkFullScreen()

  //  Capture screen on load
  // transmitScreenCapture()
  useBroadcastMessage((data: string) => {
    const updatedSlide = JSON.parse(data) as Slide
    mostUpdatedLiveSlide.value = updatedSlide
  })
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
  const socket = await useSocket()
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
