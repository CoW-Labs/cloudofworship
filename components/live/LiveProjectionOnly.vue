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
      class="live-output w-[100%] min-h-[220px] rounded-md relative overflow-hidden border bg-black dark:border-none"
      v-if="contentVisible"
      @dblclick="activateFullScreen()"
    >
      <!-- BACKGROUND CONTENT -->
      <div
        class="absolute inset-0 bg-no-repeat transition-all"
        :class="{
          'h-[100vh] rounded-none border-none min-h-[100%]': fullScreen,
          'h-[88vh] rounded-none border-none min-h-[100%]': fullScreenHeight,
          'bg-cover': slide?.type !== slideTypes.media,
          'bg-center bg-cover':
            slide?.slideStyle?.backgroundFillType === backgroundFillTypes.crop,
          'bg-top bg-cover':
            slide?.slideStyle?.backgroundFillType ===
            backgroundFillTypes.cropTop,
          'bg-bottom bg-cover':
            slide?.slideStyle?.backgroundFillType ===
            backgroundFillTypes.cropBottom,
          'bg-center bg-contain':
            slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
          'bg-center bg-stretch':
            slide?.slideStyle?.backgroundFillType ===
            backgroundFillTypes.stretch,
        }"
        :style="backgroundStyles"
      >
        <!-- AUDIO BACKGROUND -->
        <audio
          v-if="fullScreen"
          ref="audio"
          v-show="(slide?.data as ExtendedFileT)?.type?.includes('audio')"
          :src="(slide?.data as ExtendedFileT)?.url"
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

        <!-- EXTERNAL VIDEO (YOUTUBE/VIMEO) - Only in fullScreen -->
        <iframe
          v-if="
            fullScreen &&
            slide?.type === slideTypes.media &&
            ((slide?.data as any)?.type === 'youtube' ||
              (slide?.data as any)?.type === 'vimeo')
          "
          ref="iframe"
          :src="getEmbedUrl(slide?.data as any)"
          class="h-[100%] w-[100%] absolute inset-0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>

        <!-- EXTERNAL VIDEO THUMBNAIL - Only when NOT fullScreen -->
        <div
          v-if="
            !fullScreen &&
            slide?.type === slideTypes.media &&
            ((slide?.data as any)?.type === 'youtube' ||
              (slide?.data as any)?.type === 'vimeo')
          "
          class="h-[100%] w-[100%] absolute inset-0 bg-primary-950"
        >
          <!-- Thumbnail Background -->
          <div v-if="(slide?.data as any)?.thumbnail" class="absolute inset-0">
            <img
              :src="(slide?.data as any)?.thumbnail"
              :alt="(slide?.data as any)?.name"
              class="w-full h-full object-cover opacity-70"
            />
          </div>
        </div>

        <!-- VIDEO BACKGROUND -->
        <video
          v-if="fullScreen"
          ref="video"
          v-show="
            slide?.backgroundType === backgroundTypes.video &&
            (slide?.data as any)?.type !== 'youtube' &&
            (slide?.data as any)?.type !== 'vimeo'
          "
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
            slide?.type === slideTypes.media
              ? 'object-contain'
              : 'object-cover',
            {
              'object-center object-cover':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.crop,
              'object-center object-contain':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.fit,
              'object-center bg-fixed bg-stretch object-fill':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.stretch,
            },
          ]"
          crossorigin="anonymous"
        ></video>

        <!-- VIDEO THUMBNAIL - Only when NOT fullScreen -->
        <video
          v-if="
            !fullScreen &&
            slide?.backgroundType === backgroundTypes.video &&
            (slide?.data as any)?.type !== 'youtube' &&
            (slide?.data as any)?.type !== 'vimeo'
          "
          :src="slide?.background"
          muted
          playsinline="true"
          :class="[
            'h-[100%] w-[100%] absolute inset-0',
            slide?.type === slideTypes.media
              ? 'object-contain'
              : 'object-cover',
            {
              'object-center object-cover':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.crop,
              'object-center object-contain':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.fit,
              'object-center bg-fixed bg-stretch object-fill':
                slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.stretch,
            },
          ]"
          crossorigin="anonymous"
        ></video>
      </div>

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
        :key="slide?._id"
        :content-visible="foregroundContentVisible"
        :slide="slide"
        class="relative"
        :class="fullScreen ? 'h-screen' : 'min-h-[220px] rounded-md'"
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
import { useDebounceFn } from "@vueuse/core"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { ExtendedFileT, Slide, SlideStyle, ExternalVideo } from "~/types"
import { hasSlideChanged, getSlideComparisonKey } from "~/utils/slideComparison"

const appMounted = ref<boolean>(false)
const video = ref<HTMLVideoElement | null>(null)
const audio = ref<HTMLAudioElement | null>(null)
const iframe = ref<HTMLIFrameElement | null>(null)
const foregroundContentVisible = ref<boolean>(true)
const isLargePreviewOpen = ref<boolean>(false)
const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()
const route = useRoute()
const renderKey = ref(0)
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["activate-fullscreen"])
const mostRecentSlideUpdate = ref<Slide | null>(null)
const lastComparisonKey = ref<string>("")

const props = defineProps<{
  slide: Slide
  contentVisible: Boolean
  fullScreen: Boolean
  slideStyles: SlideStyle
  audioMuted?: Boolean
  slideLabel?: Boolean
  fullScreenHeight?: string
}>()

const getEmbedUrl = (data: ExternalVideo): string => {
  const isMuted =
    props.audioMuted ||
    (!props.fullScreen ? true : props.slide?.slideStyle?.isMediaMuted)
  const shouldLoop =
    props.slide?.type !== slideTypes.media ||
    props.slide?.slideStyle?.repeatMedia

  if (data.type === "youtube") {
    let videoId = ""
    if (data.url.includes("youtu.be")) {
      videoId = data.url.split("youtu.be/")[1]?.split("?")[0] || ""
    } else {
      videoId = data.url.split("v=")[1]?.split("&")[0] || ""
    }
    // Enable JS API for control and add necessary parameters
    const muteParam = isMuted ? "&mute=1" : "&mute=0"
    const loopParam = shouldLoop ? `&loop=1&playlist=${videoId}` : ""
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&enablejsapi=1&origin=${window.location.origin}${muteParam}${loopParam}`
  } else if (data.type === "vimeo") {
    const videoId = data.url.split("vimeo.com/")[1]?.split("?")[0] || ""
    // Enable JS API for control
    const muteParam = isMuted ? "&muted=1" : "&muted=0"
    const loopParam = shouldLoop ? "&loop=1" : ""
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&api=1${muteParam}${loopParam}`
  }
  return ""
}

// Optimized watcher - only watch slide ID for main changes
watch(
  () => props.slide?.id,
  (newId, oldId) => {
    try {
      if (process.client && props.fullScreen && route.name === "live") {
        document.documentElement.requestFullscreen()
      }

      // Only proceed if this is the active live slide
      if (!appMounted || props.slide.id !== currentState.value?.liveSlideId) {
        return
      }

      // Check if slide has actually changed using efficient comparison
      if (newId !== oldId) {
        incrementRenderKey(props.slide)

        // Only play video/audio when in fullScreen mode
        if (props.fullScreen) {
          video.value?.play()
        }

        // Trigger content fade animation on slide change
        foregroundContentVisible.value = false
        setTimeout(() => {
          foregroundContentVisible.value = true
        }, 100)
      }
    } catch (error) {
      console.error("Error in slide watcher:", error)
    }
  }
)

// Separate watcher for slide content/style changes (debounced)
const handleSlideContentChange = useDebounceFn(() => {
  if (!appMounted || props.slide.id !== currentState.value?.liveSlideId) {
    return
  }

  const newKey = getSlideComparisonKey(props.slide)

  // Only update if content has actually changed
  if (newKey !== lastComparisonKey.value) {
    lastComparisonKey.value = newKey
    incrementRenderKey(props.slide)

    foregroundContentVisible.value = false
    setTimeout(() => {
      foregroundContentVisible.value = true
    }, 100)
  }
}, 50)

watch(
  () => [props.slide?.contents, props.slide?.slideStyle],
  handleSlideContentChange,
  { deep: true }
)

// Separate watcher for media seeking (not debounced - needs to be immediate)
watch(
  () => props.slide?.slideStyle?.mediaSeekPosition,
  (newSeekPosition, oldSeekPosition) => {
    if (
      !props.fullScreen ||
      newSeekPosition === undefined ||
      newSeekPosition < 0 ||
      newSeekPosition === oldSeekPosition
    ) {
      return
    }

    try {
      if (appMounted && props.slide.id === currentState.value?.liveSlideId) {
        // Handle seeking - only in fullScreen mode
        const isExternalVideo =
          (props.slide.data as any)?.type === "youtube" ||
          (props.slide.data as any)?.type === "vimeo"

        if (isExternalVideo && iframe.value) {
          // For YouTube/Vimeo, send postMessage to control playback
          const videoData = props.slide.data as ExternalVideo
          if (videoData.type === "youtube") {
            iframe.value.contentWindow?.postMessage(
              JSON.stringify({
                event: "command",
                func: "seekTo",
                args: [newSeekPosition, true],
              }),
              "*"
            )
          } else if (videoData.type === "vimeo") {
            iframe.value.contentWindow?.postMessage(
              JSON.stringify({
                method: "setCurrentTime",
                value: newSeekPosition,
              }),
              "*"
            )
          }
        } else {
          // For regular video/audio files
          if (video.value) {
            video.value.currentTime = newSeekPosition
          }
          if (audio.value) {
            audio.value.currentTime = newSeekPosition
          }
        }
      }
    } catch (err) {
      console.error("Error seeking media:", err)
    }
  }
)

// Separate watcher for media play/pause control
watch(
  () => props.slide?.slideStyle?.isMediaPlaying,
  (isPlaying, wasPlaying) => {
    if (!props.fullScreen || isPlaying === wasPlaying) {
      return
    }

    try {
      if (appMounted && props.slide.id === currentState.value?.liveSlideId) {
        const isExternalVideo =
          (props.slide.data as any)?.type === "youtube" ||
          (props.slide.data as any)?.type === "vimeo"

        if (isPlaying) {
          if (isExternalVideo && iframe.value) {
            const videoData = props.slide.data as ExternalVideo
            if (videoData.type === "youtube") {
              iframe.value.contentWindow?.postMessage(
                JSON.stringify({
                  event: "command",
                  func: "playVideo",
                  args: [],
                }),
                "*"
              )
            } else if (videoData.type === "vimeo") {
              iframe.value.contentWindow?.postMessage(
                JSON.stringify({ method: "play" }),
                "*"
              )
            }
          } else {
            video.value?.play()
            audio.value?.play()
          }
        } else if (
          !isPlaying &&
          isPlaying !== undefined &&
          props.slide.type === slideTypes.media
        ) {
          if (isExternalVideo && iframe.value) {
            const videoData = props.slide.data as ExternalVideo
            if (videoData.type === "youtube") {
              iframe.value.contentWindow?.postMessage(
                JSON.stringify({
                  event: "command",
                  func: "pauseVideo",
                  args: [],
                }),
                "*"
              )
            } else if (videoData.type === "vimeo") {
              iframe.value.contentWindow?.postMessage(
                JSON.stringify({ method: "pause" }),
                "*"
              )
            }
          } else {
            video.value?.pause()
            audio.value?.pause()
          }
        }
      }
    } catch (err) {
      console.error("Error controlling media playback:", err)
    }
  }
)

// Separate watcher for media mute/unmute control
watch(
  () => props.slide?.slideStyle?.isMediaMuted,
  (isMuted, wasMuted) => {
    if (!props.fullScreen || isMuted === wasMuted || isMuted === undefined) {
      return
    }

    try {
      if (appMounted && props.slide.id === currentState.value?.liveSlideId) {
        const isExternalVideo =
          (props.slide.data as any)?.type === "youtube" ||
          (props.slide.data as any)?.type === "vimeo"

        if (isExternalVideo && iframe.value) {
          const videoData = props.slide.data as ExternalVideo
          if (videoData.type === "youtube") {
            const muteFunc = isMuted ? "mute" : "unMute"
            iframe.value.contentWindow?.postMessage(
              JSON.stringify({ event: "command", func: muteFunc, args: [] }),
              "*"
            )
          } else if (videoData.type === "vimeo") {
            iframe.value.contentWindow?.postMessage(
              JSON.stringify({
                method: "setVolume",
                value: isMuted ? 0 : 1,
              }),
              "*"
            )
          }
        }
      }
    } catch (err) {
      console.error("Error controlling media mute:", err)
    }
  }
)

onMounted(() => {
  appMounted.value = true
  // Only play video when in fullScreen mode
  if (props.fullScreen) {
    video.value?.play()
  }
})

const backgroundStyles = computed(() => {
  if (props.slide?.type === slideTypes.media) {
    return useSlideBackground(props.slide)
  }
  return `${useSlideBackground(props.slide)}; filter: blur(${
    props.slideStyles.blur
  }px) brightness(${props.slideStyles.brightness}%);`
})

const incrementRenderKey = (slide: Slide) => {
  // Use efficient comparison instead of expensive JSON.stringify
  if (!hasSlideChanged(slide, mostRecentSlideUpdate.value)) {
    return
  }

  renderKey.value += 1
  mostRecentSlideUpdate.value = slide
}

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
