<template>
  <div class="live-output-ctn w-[100%] min-h-[220px] relative">
    <div
      class="live-output w-[100%] min-h-[220px] rounded-md relative overflow-hidden border bg-no-repeat transition-all backdrop-blur-0 bg-black dark:border-none"
      v-if="contentVisible"
      :class="{
        'h-[100vh] rounded-none border-none min-h-[100%]': fullScreen,
        'h-[88vh] rounded-none border-none min-h-[100%]': fullScreenHeight,
        'bg-cover': slide?.type !== slideTypes.media,
        'bg-center bg-cover':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.crop,
        'bg-center bg-contain':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
        'bg-center bg-fixed bg-stretch':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.stretch,
        'bg-center bg-repeat':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.center,
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
        :muted="fullScreen ? slide?.slideStyle?.isMediaMuted : true"
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
        :muted="fullScreen ? slide?.slideStyle?.isMediaMuted : true"
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
      <LiveContent
        :content-visible="foregroundContentVisible"
        :slide="slide"
        class="relative come-up-1"
        :class="fullScreen ? '' : 'min-h-[220px] rounded-md'"
        :padding="fullScreen ? '6' : '0'"
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
      <AlertView v-if="fullScreen" />
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

const props = defineProps<{
  slideLabel: Boolean
  slide: Slide
  contentVisible: Boolean
  fullScreen: Boolean
  fullScreenHeight: string
  slideStyles: SlideStyle
  audioMuted: Boolean
}>()

watch(
  () => props.slide,
  (newVal, oldVal) => {
    try {
      if (appMounted && props.slide.id === appStore.liveSlideId) {
        // console.log(video.value)
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
          newVal.slideStyle?.isMediaPlaying !== undefined
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

onMounted(() => {
  appMounted.value = true
  // try {
  video.value?.play()
  // } catch (err) {}

  // emitter.on("media-seek", (seekPosition: string) => {
  //   // video.value?.fastSeek(Number(seekPosition))
  //   // console.log(seekPosition, video.value?.currentTime)
  //   // Number(seekPosition)
  //   video.value.currentTime = 0
  // })
})

const activateFullScreen = () => {
  const toast = useToast()
  const route = useRoute()
  if (props.fullScreen && route.name === "live") {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
      toast.add({
        icon: "i-bx-info-circle",
        title: "Double tap display to exit full screen",
      })
    }
  }
}
</script>

<style></style>
