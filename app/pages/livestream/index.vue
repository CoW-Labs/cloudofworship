<template>
  <LivestreamUnavailable v-if="!canLivestream" />
  <div
    v-else
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId?.toString()"
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
        v-for="liveSlide in appStore.activeSlides"
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
          liveSlide?.slideStyle?.isMediaMuted!!
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

// Unlike /livestream/:schedule_id, this page is driven straight from the local
// store — same browser, same `pinia-shared-state` — so the church is right here
// and the gate is the ordinary client-side one, matching /mobile.
//
// It stays paired with the paywall kill switch for the same reason
// mobile.global.ts does: the switch has to keep working. Unlike the PostHog
// flag it replaced, it is served by our own API and defaults to on, so a
// dropped network no longer opens the page up. And the plan is only trusted
// once the church has actually loaded, since `getCurrentPlan` fails safe to
// "free" and would otherwise black out a paying church on a cold start.
const { isTeamsPlan, isPlanKnown, isPaywallEnabled } = useSubscription()
const canLivestream = computed(
  () => !isPlanKnown.value || !isPaywallEnabled.value || isTeamsPlan.value
)
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
  // console.log(currentState.value.liveSlideId)
  return appStore.activeSlides.find(
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
</script>
