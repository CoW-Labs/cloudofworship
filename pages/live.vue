<template>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="liveSlideId"
  >
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
        :audio-muted="liveSlide?.slideStyle?.isMediaMuted"
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

const liveSlide = computed(() => {
  // console.log(activeSlides.value)
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

onMounted(() => {
  const toast = useToast()
  toast.add({
    icon: "i-bx-info-circle",
    title: "Double tap display to go full screen",
  })
})
</script>

<style>
body {
  overflow: hidden;
}
</style>
