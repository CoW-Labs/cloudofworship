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
        :audio-muted="
          liveSlide?.id !== liveSlideId || liveSlide?.slideStyle?.isMediaMuted
        "
      />
    </TransitionGroup>
  </div>
</template>
<script setup lang="ts">
import type { Slide } from "~/types"

const activeSlides = ref([])
const liveSlideId = ref<string>("")
const settings = ref({
  slideStyles: {
    blur: 0,
    brightness: 0,
  },
})
const liveSlide = computed(() => {
  return activeSlides.value.find(
    (slide: Slide) => slide.id === liveSlideId.value
  )
})

const socket = await useSocket()

socket.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data)
  if (data.type === "live-slide-id-transfer") {
    liveSlideId.value = data.data
  }
  if (data.type === "live-active-slides-transfer") {
    console.log(data)
    activeSlides.value = data.data
  }
  if (data.type === "live-settings-transfer") {
    settings.value = data.data
    console.log(settings.value.slideStyles)
  }
}
</script>
