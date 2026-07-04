<template>
  <div
    class="live-output-ctn w-[100%] min-h-[220px] relative"
    :class="{ 'no-animations': currentState.settings.microAnimations === false }"
    :style="`--cow-transition-duration: ${
      currentState.settings.animations
        ? currentState.settings.transitionInterval ?? 0.7
        : 0
    }s`"
  >
    <div
      class="live-output w-[100%] min-h-[220px] relative overflow-hidden bg-black"
      :class="
        isLivePageFullScreen
          ? 'rounded-none border-0'
          : 'rounded-2xl border dark:border-none'
      "
      v-if="contentVisible"
      @dblclick="activateFullScreen()"
    >
      <!-- PERSISTENT MEDIA LAYER -->
      <!-- Kept OUTSIDE the crossfade so the video/audio/iframe refs and their
           playback survive slide changes (seek/play/pause/mute watchers depend
           on stable refs, and re-mounting a video would replay/flash it). -->
      <div class="absolute inset-0" style="z-index: 1">
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
      <!-- End of PERSISTENT MEDIA LAYER -->

      <!-- SLIDE FACE (crossfades as one unit: background + label + text) -->
      <!-- Keyed by the displayed slide id so a slide change swaps the whole
           face via the crossfade, while same-slide edits (e.g. Bible verse
           navigation) keep the same key and update in place with no crossfade. -->
      <Transition :name="transitionName">
        <div
          :key="displayedSlide?.id"
          class="slide-face relative h-full"
          style="z-index: 2"
        >
          <!-- BACKGROUND (image/solid/gradient, blurred for text slides) -->
          <div
            class="absolute inset-0 bg-no-repeat"
            :class="{
              'h-[100vh] rounded-none border-none min-h-[100%]': fullScreen,
              'h-[88vh] rounded-none border-none min-h-[100%]': fullScreenHeight,
              'bg-cover': displayedSlide?.type !== slideTypes.media,
              'bg-center bg-cover':
                displayedSlide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.crop,
              'bg-top bg-cover':
                displayedSlide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.cropTop,
              'bg-bottom bg-cover':
                displayedSlide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.cropBottom,
              'bg-center bg-contain':
                displayedSlide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.fit,
              'bg-center bg-stretch':
                displayedSlide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.stretch,
            }"
            :style="backgroundStyles"
          ></div>

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
              {{ displayedSlide?.name || "No Live Slide" }}
            </h5>
            <LiveSlideIndicator
              :visible="!!displayedSlide?.name"
              class="mr-4 mt-4"
            />
          </div>

          <!-- MAIN FOREGROUND CONTENT -->
          <LiveContent
            :key="displayedSlide?._id"
            :content-visible="true"
            :slide="displayedSlide"
            class="relative z-10"
            :class="fullScreen ? 'h-screen' : 'min-h-[220px] rounded-2xl'"
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
        </div>
      </Transition>
      <!-- End of SLIDE FACE -->

      <template v-if="!fullScreen">
        <UTooltip
          class="absolute bottom-3 right-3 z-10"
          text="Expand preview"
          :popper="{ arrow: true }"
        >
          <UButton
            variant="ghost"
            size="xs"
            color="gray"
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
import type { ExtendedFileT, Slide, SlideStyle, ExternalVideo } from "~/types"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
  safePauseMedia,
  safePlayMedia,
  safePostMessage,
} from "~/utils/browserSafety"

const appMounted = ref<boolean>(false)
const video = ref<HTMLVideoElement | null>(null)
const audio = ref<HTMLAudioElement | null>(null)
const iframe = ref<HTMLIFrameElement | null>(null)
const isLargePreviewOpen = ref<boolean>(false)
const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()
const route = useRoute()
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["activate-fullscreen"])

const props = defineProps<{
  slide: Slide
  contentVisible: Boolean
  fullScreen: Boolean
  slideStyles: SlideStyle
  audioMuted?: Boolean
  slideLabel?: Boolean
  fullScreenHeight?: string
}>()

// The slide currently rendered in the crossfading face. It lags props.slide by
// the (image) preload so the incoming background doesn't flash blank mid-fade.
// Same-slide edits share this object's reactivity and update in place.
const displayedSlide = ref<Slide>(props.slide)

// Resolve the Vue transition name from the transition type. Only `fade` is
// implemented today; future types (slide/zoom/cut) plug in here + one CSS block.
const transitionName = computed(() => `cow-slide-${transitionTypes.fade}`)
const isLivePageFullScreen = computed(
  () => props.fullScreen && route.path === "/live"
)

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
    } else if (data.url.includes("/shorts/")) {
      videoId = data.url.split("/shorts/")[1]?.split("?")[0] || ""
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

// Preload background images so the crossfade doesn't flash a blank background.
const preloadBackgroundImage = async (slide: Slide): Promise<boolean> => {
  if (slide?.backgroundType !== backgroundTypes.image || !slide?.background) {
    return true // No image to preload
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = slide.background!

    // Timeout after 3 seconds to prevent indefinite waiting
    setTimeout(() => resolve(true), 3000)
  })
}

// Drive the crossfade: when the slide switches, preload the incoming image then
// commit it to `displayedSlide`, which changes the face key and triggers the
// crossfade. Same-slide updates (new object, same id) commit immediately with
// no crossfade so verse navigation stays jitter-free.
watch(
  () => props.slide,
  async (newSlide, oldSlide) => {
    if (!newSlide) {
      displayedSlide.value = newSlide
      return
    }

    const idChanged = !!oldSlide && newSlide.id !== oldSlide.id
    if (idChanged) {
      await preloadBackgroundImage(newSlide)
    }

    displayedSlide.value = newSlide

    // Only play video/audio when in fullScreen mode
    if (idChanged && props.fullScreen) {
      safePlayMedia(video.value)
    }
  }
)

const computeBackgroundStyles = (slide: Slide): string => {
  if (
    slide?.type === slideTypes.media ||
    slide?.type === slideTypes.presentation
  ) {
    return useSlideBackground(slide)
  }
  return `${useSlideBackground(slide)}; filter: blur(${
    props.slideStyles.blur
  }px) brightness(${props.slideStyles.brightness}%);`
}

const backgroundStyles = computed(() => {
  return displayedSlide.value
    ? computeBackgroundStyles(displayedSlide.value)
    : ""
})

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
      const slide = props.slide
      if (
        !appMounted.value ||
        !slide?.id ||
        slide.id !== currentState.value?.liveSlideId
      ) {
        return
      }

      // Handle seeking - only in fullScreen mode
      const isExternalVideo =
        (slide.data as any)?.type === "youtube" ||
        (slide.data as any)?.type === "vimeo"

      if (isExternalVideo && iframe.value) {
        // For YouTube/Vimeo, send postMessage to control playback
        const videoData = slide.data as ExternalVideo
        if (videoData.type === "youtube") {
          safePostMessage(
            iframe.value.contentWindow,
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [newSeekPosition, true],
            }),
            "*"
          )
        } else if (videoData.type === "vimeo") {
          safePostMessage(
            iframe.value.contentWindow,
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
      const slide = props.slide
      if (
        !appMounted.value ||
        !slide?.id ||
        slide.id !== currentState.value?.liveSlideId
      ) {
        return
      }

      const isExternalVideo =
        (slide.data as any)?.type === "youtube" ||
        (slide.data as any)?.type === "vimeo"

      if (isPlaying) {
        if (isExternalVideo && iframe.value) {
          const videoData = slide.data as ExternalVideo
          if (videoData.type === "youtube") {
            safePostMessage(
              iframe.value.contentWindow,
              JSON.stringify({
                event: "command",
                func: "playVideo",
                args: [],
              }),
              "*"
            )
          } else if (videoData.type === "vimeo") {
            safePostMessage(
              iframe.value.contentWindow,
              JSON.stringify({ method: "play" }),
              "*"
            )
          }
        } else {
          safePlayMedia(video.value)
          safePlayMedia(audio.value)
        }
      } else if (
        !isPlaying &&
        isPlaying !== undefined &&
        slide.type === slideTypes.media
      ) {
        if (isExternalVideo && iframe.value) {
          const videoData = slide.data as ExternalVideo
          if (videoData.type === "youtube") {
            safePostMessage(
              iframe.value.contentWindow,
              JSON.stringify({
                event: "command",
                func: "pauseVideo",
                args: [],
              }),
              "*"
            )
          } else if (videoData.type === "vimeo") {
            safePostMessage(
              iframe.value.contentWindow,
              JSON.stringify({ method: "pause" }),
              "*"
            )
          }
        } else {
          safePauseMedia(video.value)
          safePauseMedia(audio.value)
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
      const slide = props.slide
      if (
        !appMounted.value ||
        !slide?.id ||
        slide.id !== currentState.value?.liveSlideId
      ) {
        return
      }

      const isExternalVideo =
        (slide.data as any)?.type === "youtube" ||
        (slide.data as any)?.type === "vimeo"

      if (isExternalVideo && iframe.value) {
        const videoData = slide.data as ExternalVideo
        if (videoData.type === "youtube") {
          const muteFunc = isMuted ? "mute" : "unMute"
          safePostMessage(
            iframe.value.contentWindow,
            JSON.stringify({ event: "command", func: muteFunc, args: [] }),
            "*"
          )
        } else if (videoData.type === "vimeo") {
          safePostMessage(
            iframe.value.contentWindow,
            JSON.stringify({
              method: "setVolume",
              value: isMuted ? 0 : 1,
            }),
            "*"
          )
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
    safePlayMedia(video.value)
  }
})

// Function to create padding based on the ones set at display settings
// Calculation is necessary because minimum padding is 6vw and the padding is in VW units
const computePadding = (padding: number | undefined) => {
  return ((padding || 24) * 6) / 24
}

const activateFullScreen = () => {
  const route = useRoute()
  if (props.fullScreen && route.name === "live") {
    if (document.fullscreenElement) {
      exitFullscreenSafely()
    } else {
      requestFullscreenSafely(document.documentElement).finally(() => {
        emit("activate-fullscreen")
      })
    }
  }
}
</script>

<style></style>
