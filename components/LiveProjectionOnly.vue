<template>
  <div
    class="live-output-ctn w-[100%] min-h-[220px] relative"
    :class="{ 'no-animations': !currentState.settings.animations }"
    :style="`transition-duration: ${
      currentState.settings.animations
        ? currentState.settings.transitionInterval
        : 0
    }s`"
  >
    <div
      class="live-output w-[100%] min-h-[220px] rounded-md relative overflow-hidden border bg-no-repeat transition-all backdrop-blur-0 bg-black dark:border-none"
      v-if="contentVisible"
      :class="{
        'h-[100vh] rounded-none border-none min-h-[100%] bg-center': fullScreen,
        'h-[88vh] rounded-none border-none min-h-[100%] bg-center':
          fullScreenHeight,
        'bg-cover': slide?.type !== slideTypes.media,
        'bg-center bg-cover':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.crop,
        'bg-top bg-cover':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.cropTop,
        'bg-bottom bg-cover':
          slide?.slideStyle?.backgroundFillType ===
          backgroundFillTypes.cropBottom,
        'bg-center bg-contain':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
        'bg-center bg-stretch':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.stretch,
      }"
      @dblclick="activateFullScreen()"
      :style="useSlideBackground(slide)"
    >
      <!-- AUDIO BACKGROUND -->
      <audio
        ref="video"
        v-if="slide?.data?.type?.includes('audio')"
        :src="slide?.data?.url"
        autoplay
        :loop="
          slide?.type !== slideTypes.media || slide?.slideStyle?.repeatMedia
        "
        :muted="
          audioMuted
            ? true
            : fullScreen
            ? slide?.slideStyle?.isMediaMuted
            : true
        "
        playsinline="true"
        crossorigin="anonymous"
      ></audio>
      <!-- VIDEO BACKGROUND -->
      <video
        ref="video"
        v-if="slide?.backgroundType === backgroundTypes.video"
        :src="slide?.background"
        autoplay
        :loop="
          slide?.type !== slideTypes.media || slide?.slideStyle?.repeatMedia
        "
        :muted="
          audioMuted
            ? true
            : fullScreen
            ? slide?.slideStyle?.isMediaMuted
            : true
        "
        playsinline="true"
        :class="[
          'h-[100%] w-[100%] absolute inset-0',
          slide?.type === slideTypes.media ? 'object-contain' : 'object-cover',
          {
            'object-center object-cover':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.crop,
            'object-center object-contain':
              slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
            'object-center bg-fixed bg-stretch object-fill':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.stretch,
            'object-center bg-repeat':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.center,
          },
        ]"
        crossorigin="anonymous"
      ></video>
      <div
        v-if="!fullScreen || slideLabel"
        class="overlay-gradient absolute z-10 inset-0"
      ></div>
      <div
        v-if="!fullScreen || slideLabel"
        class="heading p-3 absolute z-10 inset-0"
      >
        <h5
          class="font-semibold text-white overflow-hidden truncate w-48 2xl:w-64"
        >
          {{ slide?.name || "No Live Slide" }}
        </h5>
        <LiveSlideIndicator :visible="!!slide?.name" class="mr-4 mt-4" />
      </div>

      <!-- MAIN FOREGROUND CONTENT -->
      <!-- :padding="fullScreen ? '6' : '0'" -->
      <LiveContent
        :content-visible="foregroundContentVisible"
        :slide="slide"
        class="relative"
        :class="fullScreen ? '' : 'min-h-[220px] rounded-md'"
        :padding="
          fullScreen
            ? {
                top: computePadding(
                  currentState.settings.slideStyles.windowPadding?.top
                ),
                right: computePadding(
                  currentState.settings.slideStyles.windowPadding?.right
                ),
                bottom: computePadding(
                  currentState.settings.slideStyles.windowPadding?.bottom
                ),
                left: computePadding(
                  currentState.settings.slideStyles.windowPadding?.left
                ),
              }
            : { top: 0, right: 0, bottom: 0, left: 0 }
        "
        :style="
          slide?.type === slideTypes.media
            ? ''
            : `backdrop-filter: blur(${slideStyles.blur}px) brightness(${slideStyles.brightness}%);`
        "
      />

      <template v-if="!fullScreen">
        <UTooltip
          class="absolute bottom-3 right-3 z-10"
          text="Expand preview"
          :popper="{ arrow: true }"
        >
          <UButton
            variant="ghost"
            size="xs"
            color="slate"
            icon="i-bx-expand-alt"
            class="hover:bg-primary-500"
            @click="isLargePreviewOpen = true"
          ></UButton>
        </UTooltip>

        <UModal v-model="isLargePreviewOpen" fullscreen>
          <UCard>
            <div class="flex items-center justify-between h-[60px] mb-4">
              <div class="logo flex items-center gap-2 w-[250px]">
                <Logo class="w-[24px]" />
                <h1 class="text-sm font-semibold">Cloud of Worship</h1>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Large Preview
              </h3>
              <div class="close-ctn w-[250px] flex justify-end">
                <UButton
                  color="gray"
                  variant="ghost"
                  icon="i-mdi-close"
                  class="my-1"
                  @click="isLargePreviewOpen = false"
                />
              </div>
            </div>
            <LiveProjectionOnly
              :full-screen="true"
              full-screen-height="80vh"
              :content-visible="true"
              :slide="slide"
              :slide-label="false"
              :slide-styles="slideStyles"
            />
          </UCard>
        </UModal>
      </template>
      <AlertView :size="fullScreen ? '' : 'sm'" />
      <FallingSnowView
        v-if="fullScreen && currentState.activeOverlay === 'falling-snow'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Slide, SlideStyle } from "~/types"
const appMounted = ref<boolean>(false)
const video = ref<HTMLVideoElement | null>(null)
const foregroundContentVisible = ref<boolean>(true)
const isLargePreviewOpen = ref<boolean>(false)
const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()
const route = useRoute()
// const previousSlideVideo = ref<HTMLVideoElement | null>(null)
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["activate-fullscreen"])

const props = defineProps<{
  slideLabel: Boolean
  slide: Slide
  contentVisible: Boolean
  fullScreen: Boolean
  fullScreenHeight: string
  slideStyles: SlideStyle
  audioMuted: Boolean
}>()

// TODO: Listen to slide.id and pause video if it is no longer the current live slide, using the Global Emitter on EditLiveContent component and passing ot here
// Listen to liveSlideId and pause video if it is no longer the current live slide
watch(
  () => currentState.value?.liveSlideId,
  (newVal, oldVal) => {
    // console.log("liveSlideId", newVal)
  }
)

watch(
  () => props.audioMuted,
  (newVal, oldVal) => {
    if (props.audioMuted) {
      // video.value?.pause()
    }
  }
)

watch(
  () => props.slide,
  (newVal, oldVal) => {
    try {
      if (process.client && props.fullScreen && route.name === "live") {
        document.documentElement.requestFullscreen()
      }
      if (appMounted && props.slide.id === currentState.value?.liveSlideId) {
        // console.log(video.value)
        // if (newVal.type === slideTypes.media) {
        //   previousSlideVideo.value = video.value
        //   console.log(video.value)
        //   // video.value?.pause()
        // }
        video.value?.play()
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          foregroundContentVisible.value = false
          setTimeout(() => {
            foregroundContentVisible.value = true
          }, 100)
        }

        // console.log(newVal.slideStyle?.mediaSeekPosition)
        if (newVal.slideStyle?.mediaSeekPosition === 0) {
          video.value.currentTime = newVal.slideStyle?.mediaSeekPosition
        }

        // Play/pause video
        // console.log(newVal.name, newVal.slideStyle)
        if (newVal.slideStyle?.isMediaPlaying) {
          video.value?.play()
        } else if (
          !newVal.slideStyle?.isMediaPlaying &&
          newVal.slideStyle?.isMediaPlaying !== undefined &&
          newVal.type === slideTypes.media
        ) {
          // console.log("triggered pause")
          video.value?.pause()
        }

        // TODO: Listen to see if video is playing or paused
        // video.value?.addEventListener("play", (ev) => {
        //   useGlobalEmit()
        // })
        // video.value?.addEventListener("pause", (ev) => {
        //   console.log(ev)
        // })
      }
    } catch (err) {
      // console.log(err)
    }
  }
)

onBeforeMount(() => {
  // if (props.fullScreen) {
  //   document.addEventListener("mouseover", () => {
  //     document.documentElement.requestFullscreen()
  //   })
  // }
})

onMounted(() => {
  appMounted.value = true
  // try {
  video.value?.play()

  // emitter.on("media-seek", (seekPosition: string) => {
  //   // video.value?.fastSeek(Number(seekPosition))
  //   // console.log(seekPosition, video.value?.currentTime)
  //   // Number(seekPosition)
  //   video.value.currentTime = 0
  // })
})

// Function to create padding based on the ones set at display settings
// Calculation is necessary because minimum padding is 6vw and the padding is in VW units
const computePadding = (padding: number | undefined) => {
  return ((padding || 24) * 6) / 24
}

const activateFullScreen = () => {
  // const toast = useToast()
  const route = useRoute()
  if (props.fullScreen && route.name === "live") {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
      emit("activate-fullscreen")
    }
  }
}
</script>

<style></style>
