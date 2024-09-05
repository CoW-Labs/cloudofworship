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
          toggle full screen mode</span
        >
        •
        <span class="flex items-center gap-2 font-bold"
          ><Logo class="w-[34px] mb-2" /> Cloud of Worship</span
        >
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
})
</script>

<style>
body {
  overflow: hidden;
}
</style>
