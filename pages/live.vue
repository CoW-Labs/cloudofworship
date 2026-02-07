<template>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId?.toString()"
  >
    <div
      v-if="!isFullScreen && !isTauri"
      class="banner inset-0 bottom-auto h-[60px] flex items-center justify-center bg-primary-100 text-black text-center bg-opacity-70"
    >
      <div class="banner-text text-lg flex items-center gap-6">
        <span v-if="!mostUpdatedLiveSlide"
          ><span class="font-bold">Select a slide</span> from the Slide Schedule
          Pane to show here</span
        >
        <span v-else
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
    <!-- Using motionless slides to test bug with Bible Slides not moving to next slide in live view -->
    <!-- <Transition class="fade"> -->
    <LiveProjectionOnly
      v-show="mostUpdatedLiveSlide?.id === currentState.liveSlideId"
      :content-visible="true"
      :id="currentState.liveSlideId"
      :full-screen="true"
      :slide="mostUpdatedLiveSlide!!"
      :slide-label="false"
      :slide-styles="currentState.settings.slideStyles"
      :audio-muted="
          mostUpdatedLiveSlide?.id !== currentState.liveSlideId ||
          mostUpdatedLiveSlide?.slideStyle?.isMediaMuted!!
        "
    />
    <!-- </Transition> -->

    <AlertView />
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "@/store/app"
import type { Slide } from "~/types"
import { useAuthStore } from "~/store/auth"

// Use dedicated live layout
definePageMeta({
  layout: "live",
})

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const { isTauri } = useTauri()
const isFullScreen = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10
const mostUpdatedLiveSlide = ref<Slide | null>(null)

useHead({
  title: "Live Projection - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service with Cloud of Worship's live projection feature.",
    },
    {
      name: "keywords",
      content:
        "live projection, worship display, church presentation, full screen slides, live worship, church service display, presentation software",
    },
    { property: "og:title", content: "Live Projection - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service with Cloud of Worship's live projection feature.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Live Projection - Cloud of Worship",
    },
    {
      name: "twitter:description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service.",
    },
  ],
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
    {
      rel: "stylesheet",
      href: "/css/fonts.css",
    },
    {
      rel: "stylesheet",
      href: "/css/main.css",
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

  checkFullScreen()

  // Show active slide or first slide when live window opens
  const initializeLiveSlide = () => {
    const activeSlides = currentState.value.activeSlides || []
    const currentLiveSlideId = currentState.value.liveSlideId

    // Check if there's an active slide selected
    if (currentLiveSlideId) {
      const activeSlide = activeSlides.find(
        (slide) => slide.id === currentLiveSlideId
      )
      if (activeSlide) {
        mostUpdatedLiveSlide.value = activeSlide
        return
      }
    }

    // If no active slide, show the first slide
    if (activeSlides.length > 0) {
      mostUpdatedLiveSlide.value = activeSlides[0]
      // Update the live slide ID in the store so it's reflected everywhere
      appStore.setLiveSlide(activeSlides[0].id)
    }
  }

  // Initialize the slide display
  initializeLiveSlide()

  // Store cleanup function to properly dispose of BroadcastChannel
  const cleanupBroadcast = useBroadcastMessage((data: string) => {
    try {
      const updatedSlide = JSON.parse(data) as Slide

      // Check if this is just a content update within the same slide
      const isSameSlide = mostUpdatedLiveSlide.value?.id === updatedSlide.id

      if (isSameSlide) {
        // For same-slide updates (verse changes), update immediately without requestAnimationFrame
        // This prevents jitter when moving between verses
        mostUpdatedLiveSlide.value = updatedSlide
      } else {
        // For different slides, use requestAnimationFrame to batch visual updates
        requestAnimationFrame(() => {
          mostUpdatedLiveSlide.value = updatedSlide
        })
      }
    } catch (error) {
      console.error("Failed to parse broadcast message:", error)
    }
  })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    cleanupBroadcast()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>

<style>
body {
  overflow: hidden;
}
</style>
