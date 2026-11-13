<template>
  <div
    class="live-output-ctn w-[100%] relative"
    :class="{
      'no-animations': currentState.settings.microAnimations === false,
      'h-full min-h-0': embedded,
      'min-h-[220px]': !embedded,
    }"
    :style="`--cow-transition-duration: ${
      currentState.settings.animations ? transitionDuration : 0
    }s`"
  >
    <div
      class="live-output w-[100%] relative overflow-hidden"
      :class="[
        hideBackground ? 'bg-transparent' : 'bg-black',
        embedded ? 'h-full min-h-0' : 'min-h-[220px]',
        isLivePageFullScreen || embedded
          ? 'rounded-none border-0'
          : 'rounded-2xl border dark:border-none',
      ]"
      v-if="contentVisible"
      @dblclick="!embedded && activateFullScreen()"
    >
      <!-- PERSISTENT MEDIA LAYER -->
      <!-- Kept OUTSIDE the crossfade so the video/audio/iframe refs and their
           playback survive slide changes (seek/play/pause/mute watchers depend
           on stable refs, and re-mounting a video would replay/flash it). -->
      <div class="absolute inset-0" style="z-index: 1">
        <!-- CAMERA FEED -->
        <!-- Follows `displayedSlide` so the camera stays up until the next
             slide is ready (its background image preloaded) and then
             crossfades with it, instead of cutting to black first. This layer
             sits outside the crossfading face, so it is still one stream per
             slide, not one per face. Only the projector (`capture`) and the
             operator's preview open the camera; every other screen, including
             the public livestream page that also renders full screen, gets a
             placeholder. -->
        <Transition :name="transitionName">
          <div
            v-if="displayedSlide?.type === slideTypes.camera"
            :key="displayedSlide.id"
            class="absolute inset-0"
          >
            <CameraFeed
              v-if="opensCamera"
              :data="cameraData"
              :quality="cameraMode === 'capture' ? 'output' : 'preview'"
              :resolution="cameraResolution"
              :remote="cameraMode === 'preview'"
              :remote-only="cameraMode === 'preview' && cameraIsExclusive"
            />
            <CameraPlaceholder
              v-else
              :title="
                fullScreen || cameraMode === 'preview' ? 'Camera is live' : 'Camera'
              "
              :subtitle="(displayedSlide.data as CameraSlideData)?.deviceLabel"
              :size="fullScreen ? 'lg' : 'sm'"
            />
          </div>
        </Transition>

        <!-- AUDIO BACKGROUND -->
        <!-- Fed only for an audio slide. A video media slide's `data.url` is
             the video file too, and `v-show` hides the element without
             stopping it, so an unmuted video played its sound twice: once here
             and once from the <video>. -->
        <audio
          v-if="fullScreen"
          ref="audio"
          v-show="isAudioSlide"
          :src="isAudioSlide ? (slide?.data as ExtendedFileT)?.url : undefined"
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
          :src="embedSrc"
          class="h-[100%] w-[100%] absolute inset-0"
          @load="sendEmbedMute()"
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
        <!-- A pair's caption layout leaves the words' own background out
             (`hideBackground`): the element goes, rather than decoding a
             video nobody sees. -->
        <video
          v-if="fullScreen && !hideBackground"
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
              '!object-cover !object-center': fillMedia,
            },
          ]"
          crossorigin="anonymous"
        ></video>

        <!-- VIDEO PREVIEW - Only when NOT fullScreen. Muted, and never plays
             on its own: it follows the projector's actual playback (see
             useMediaPlaybackSync), so it moves only while /live does. -->
        <video
          v-if="
            !fullScreen &&
            slide?.backgroundType === backgroundTypes.video &&
            (slide?.data as any)?.type !== 'youtube' &&
            (slide?.data as any)?.type !== 'vimeo'
          "
          ref="previewVideo"
          :src="slide?.background"
          :loop="
            slide?.type !== slideTypes.media || slide?.slideStyle?.repeatMedia
          "
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
              '!object-cover !object-center': fillMedia,
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
      <Transition :name="transitionName" appear>
        <div
          v-if="displayedSlide"
          :key="displayedSlide?.id"
          class="slide-face relative h-full"
          style="z-index: 2"
        >
          <!-- BACKGROUND (image/solid/gradient, blurred for text slides) -->
          <!-- A camera slide paints none, so the feed below shows through. -->
          <div
            v-if="displayedSlide?.type !== slideTypes.camera && !hideBackground"
            class="absolute inset-0 bg-no-repeat"
            :class="{
              'h-[100vh] rounded-none border-none min-h-[100%]':
                fullScreen && !embedded,
              'h-full rounded-none border-none min-h-[100%]':
                fullScreen && embedded,
              'h-[88vh] rounded-none border-none min-h-[100%]':
                fullScreenHeight,
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
              '!bg-cover !bg-center': fillMedia,
            }"
            :style="backgroundStyles"
          ></div>

          <!-- An interlude paints an opaque canvas, so its label has to sit
               above the content instead of showing through it. -->
          <div
            v-if="(!fullScreen && !embedded) || slideLabel"
            class="overlay-gradient absolute inset-0"
            :class="labelLayerClass"
          ></div>

          <div
            v-if="(!fullScreen && !embedded) || slideLabel"
            class="heading p-3 absolute inset-0"
            :class="labelLayerClass"
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
            ref="liveContent"
            :key="displayedSlide?._id"
            :content-visible="true"
            :slide="displayedSlide"
            class="relative z-10"
            :class="[
              embedded
                ? 'h-full'
                : fullScreen
                ? 'h-screen'
                : 'min-h-[220px] rounded-2xl',
              { 'pair-text-shadow': textShadow, 'pair-fit-text': fitText },
            ]"
            :style="fitStyle"
            :padding="
              fitText
                ? FIT_TEXT_PADDING
                : fullScreen
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

        <!-- BLANK / IDLE STATE - no slide is live -->
        <div
          v-else
          key="blank"
          class="slide-face blank-face relative flex items-center justify-center bg-transparent"
          :class="{
            'h-[100vh]': fullScreen && !embedded,
            'h-[88vh]': fullScreenHeight,
            'h-full': embedded || (!fullScreen && !fullScreenHeight),
          }"
          style="z-index: 2"
        >
          <!-- MEDIA BLANK (video / image) — shown clean, no branding -->
          <BackgroundVideo
            v-if="isBlankMedia && blankVideoUrl"
            :source="blankVideoUrl"
            :repeat="true"
            :visible="true"
          />
          <img
            v-else-if="isBlankMedia && blankImageUrl"
            :src="blankImageUrl"
            class="h-full w-full object-cover absolute inset-0"
            alt=""
          />
          <!-- Otherwise the screen stays completely blank (black). -->
        </div>
      </Transition>
      <!-- End of SLIDE FACE -->

      <OverlaySlideView
        v-if="!hideGlobalLayers"
        :size="fullScreen ? '' : 'sm'"
        :dynamic-background="
          displayedSlide?.backgroundType === backgroundTypes.video
        "
      />

      <template v-if="!fullScreen && !embedded">
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

        <!-- Same shell as the app's other modals (see ShortcutsModal): a
             transparent UModal around one rounded card. The stage is a 16:9 box
             sized from the window's height as well as its width, so the whole
             card always fits and the modal never scrolls. -->
        <UModal
          v-model="isLargePreviewOpen"
          :ui="{
            rounded: 'rounded-2xl',
            background: 'bg-transparent dark:bg-transparent',
            ring: '',
            shadow: 'shadow-none',
            width: 'w-full sm:max-w-none',
            container: 'items-center',
            overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
          }"
        >
          <div
            class="mx-auto rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden"
            :style="{ width: largePreviewCardWidth }"
          >
            <div class="flex items-center justify-between gap-3 px-5 py-4">
              <div class="min-w-0">
                <h2 class="font-semibold text-base text-gray-900 dark:text-white">
                  Large Preview
                </h2>
                <p
                  class="text-sm text-gray-400 dark:text-[#9aa3b2] mt-0.5 truncate"
                >
                  {{ slide?.name || "No live slide" }}
                </p>
              </div>
              <button
                class="grid h-8 w-8 place-items-center rounded-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#222938] shrink-0"
                aria-label="Close large preview"
                @click="isLargePreviewOpen = false"
              >
                <CloseIcon
                  class="block h-4 w-4 text-gray-600 dark:text-[#a7afbd]"
                />
              </button>
            </div>
            <div class="px-3 pb-3">
              <div
                class="w-full overflow-hidden rounded-xl bg-black"
                style="aspect-ratio: 16 / 9"
              >
                <LiveProjectionOnly
                  embedded
                  :full-screen="true"
                  :content-visible="true"
                  :slide="slide"
                  :slide-label="false"
                  :slide-styles="slideStyles"
                  :camera-mode="
                    cameraMode === 'placeholder' ? 'placeholder' : 'preview'
                  "
                />
              </div>
            </div>
          </div>
        </UModal>
      </template>
      <template v-if="!hideGlobalLayers">
        <AlertView :size="fullScreen ? '' : 'sm'" />
        <FallingSnowView
          v-if="fullScreen && currentState.activeOverlay === 'falling-snow'"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type {
  CameraSlideData,
  ExtendedFileT,
  Slide,
  SlideStyle,
  ExternalVideo,
} from "~/types"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
  safePauseMedia,
  safePlayMedia,
  safePostMessage,
} from "~/utils/browserSafety"
import { externalEmbedUrl } from "~/utils/externalVideo"
import { cameraCaptureIsExclusive } from "~/composables/useCameraStream"
import useCameraShare from "~/composables/useCameraShare"
import {
  useFollowMediaPlayback,
  useReportMediaPlayback,
} from "~/composables/useMediaPlaybackSync"
import type { Ref } from "vue"
import {
  adoptMedia,
  mediaHandoffKey,
  releaseMedia,
} from "~/composables/useMediaHandoff"
import {
  INTERLUDE_EXIT_MS,
  interludeExitKey,
  interludeModeKey,
  type InterludeExitSignal,
} from "~/utils/interlude/context"

const appMounted = ref<boolean>(false)
const video = ref<HTMLVideoElement | null>(null)
const previewVideo = ref<HTMLVideoElement | null>(null)
const audio = ref<HTMLAudioElement | null>(null)
const iframe = ref<HTMLIFrameElement | null>(null)
const isLargePreviewOpen = ref<boolean>(false)
// The card is as wide as its 16:9 stage allows: the window's width, or less when
// the window is short, so the header and stage always fit in the height.
// 10rem is the header, the card's padding and a margin above and below.
const largePreviewCardWidth =
  "min(94vw, calc((100vh - 10rem) * 16 / 9 + 1.5rem))"

// The Large Preview plays with sound, like the projector. With a Live Output
// window open on this computer that is two copies of the same sound, so opening
// it on a video or audio media slide warns about the echo.
const makesSound = computed(() => {
  const slide = props.slide
  if (!slide || slide.type !== slideTypes.media) return false
  if (slide.slideStyle?.isMediaMuted) return false
  const data = slide.data as ExtendedFileT | ExternalVideo | undefined
  const external = data?.type === "youtube" || data?.type === "vimeo"
  return (
    slide.backgroundType === backgroundTypes.video ||
    external ||
    !!(data as ExtendedFileT | undefined)?.type?.includes("audio")
  )
})
watch(isLargePreviewOpen, (open) => {
  if (!open || !makesSound.value) return
  usePosthogCapture("LARGE_PREVIEW_ECHO_WARNED", { slideType: props.slide?.type })
  useToast().add({
    id: "large-preview-echo",
    title: "Sound is on in Large Preview",
    description: "If a Live Output window is open on this computer, you may hear an echo.",
    icon: "i-bx-info-circle",
    color: "amber",
    timeout: 6000,
  })
})
const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()
const route = useRoute()
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["activate-fullscreen"])

const props = withDefaults(
  defineProps<{
    slide?: Slide | null
    contentVisible: Boolean
    fullScreen: Boolean
    slideStyles: SlideStyle
    // Lower-case `boolean`: with the `Boolean` wrapper type Vue does not cast a
    // bare `audio-muted` attribute, which then arrives as "" and reads false.
    audioMuted?: boolean
    slideLabel?: Boolean
    fullScreenHeight?: string
    /**
     * Whether a camera slide opens the camera here. Explicit rather than read
     * off `fullScreen`, because the public livestream page renders full screen
     * too and must never turn on a viewer's camera.
     * - `capture`: the /live projector window, at full resolution.
     * - `preview`: the operator's Live Output thumbnail, at low resolution.
     * - `placeholder`: everything else; draws a static card.
     */
    cameraMode?: "capture" | "preview" | "placeholder"
    /**
     * Rendered as one region of a slide pair (LivePairProjection): sized by
     * its parent instead of the viewport, and without the double-click full
     * screen, which the pair's container owns.
     */
    embedded?: boolean
    /**
     * Leave out the overlay, alert and snow layers. A slide pair draws them
     * once over the whole screen rather than once per member.
     */
    hideGlobalLayers?: boolean
    /**
     * Slide pairs only. Leave out the slide's own background (image, colour or
     * video), so the slide's words sit straight over what is behind them.
     */
    hideBackground?: boolean
    /**
     * Slide pairs only. Lay the words out for a short box rather than a whole
     * screen: no window padding, and scaled down until they fit its height.
     * The slide's saved font size is untouched.
     */
    fitText?: boolean
    /** Slide pairs only. A soft shadow behind the words. */
    textShadow?: boolean
    /** Slide pairs only. Media and camera fill the region (cover), cropping. */
    fillMedia?: boolean
    /** Slide pairs only. A camera drawn as a small inset asks for 720p. */
    cameraResolution?: "full" | "inset"
  }>(),
  { cameraMode: "placeholder", cameraResolution: "full" }
)

// Settings saved under an older, wider range can still hold an interval well
// past what the settings slider allows, which would stall the projection on a
// multi-second crossfade. Clamp to the same bounds the slider offers.
const transitionDuration = computed(() => {
  const stored = currentState.value.settings.transitionInterval
  if (stored === null || stored === undefined) return DEFAULT_TRANSITION_INTERVAL
  const interval = Number(stored)
  if (!Number.isFinite(interval)) return DEFAULT_TRANSITION_INTERVAL
  return Math.min(
    MAX_TRANSITION_INTERVAL,
    Math.max(MIN_TRANSITION_INTERVAL, interval)
  )
})

// Blank/idle state (shown when no slide is live). Defaults to a completely
// blank screen; the operator can optionally set a video/image background.
// Settings sync into the live window via pinia-shared-state.
const { rehydrateSlideMedia } = useSlideMediaCache()
const blankSettings = computed(
  () => currentState.value.settings.intermission
)
const isBlankMedia = computed(
  () =>
    blankSettings.value?.mode === "media" &&
    !!blankSettings.value?.background
)
const blankImageLocalUrl = ref<string | null>(null)
const blankImageUrl = computed(() =>
  blankSettings.value?.backgroundType === backgroundTypes.image
    ? blankImageLocalUrl.value ||
      blankSettings.value?.background ||
      null
    : null
)
// Resolved LOCAL object URL for the blank-screen video (created in THIS
// document). Kept ready even while a slide is live so switching to blank
// is instant; the <BackgroundVideo> only mounts inside the idle v-else block.
const blankVideoUrl = ref<string | null>(null)
const localMedia = useLocalMediaStorage()

const revokeBlankVideoUrl = () => {
  localMedia.releasePlaybackUrl(blankVideoUrl.value)
}

/**
 * Retry-queue key shared by both blank-screen branches, so switching the
 * blank screen between an image and a video cancels the previous one's
 * outstanding retries instead of leaving them racing each other.
 */
const BLANK_MEDIA_ID = "__blank__"

const resolveBlankVideo = async () => {
  const s = blankSettings.value
  if (
    s?.mode === "media" &&
    s?.backgroundType === backgroundTypes.image &&
    s?.backgroundImageKey
  ) {
    // Routed through the shared media cache rather than calling `ensureLocal`
    // directly, exactly as the video branch below is. A download that fails on
    // a weak connection is then caught, queued on the shared backoff and
    // retried when the network returns. The bare call threw straight out of
    // this function instead — an unhandled rejection in the projection window,
    // where nothing catches it and nothing can be shown to the congregation,
    // leaving the blank screen empty until someone reloaded.
    const resolved = await rehydrateSlideMedia(
      {
        id: BLANK_MEDIA_ID,
        type: slideTypes.text,
        backgroundType: backgroundTypes.image,
        background: s.background,
        backgroundImageKey: s.backgroundImageKey,
      } as unknown as Slide,
      { allowDownload: true }
    )
    const previous = blankImageLocalUrl.value
    blankImageLocalUrl.value = resolved.background || null
    if (previous && previous !== blankImageLocalUrl.value) {
      localMedia.releasePlaybackUrl(previous)
    }
  } else if (blankImageLocalUrl.value) {
    localMedia.releasePlaybackUrl(blankImageLocalUrl.value)
    blankImageLocalUrl.value = null
  }
  if (
    s?.mode !== "media" ||
    s?.backgroundType !== backgroundTypes.video ||
    !s?.backgroundVideoKey
  ) {
    revokeBlankVideoUrl()
    blankVideoUrl.value = null
    return
  }

  // Local-first: resolve (downloading once if needed) the cached video into a
  // fresh playback URL. A non-media slide type + backgroundVideoKey routes
  // through the shared local media service.
  const resolved = await rehydrateSlideMedia(
    {
      id: BLANK_MEDIA_ID,
      type: slideTypes.text,
      backgroundType: backgroundTypes.video,
      background: s.background,
      backgroundVideoKey: s.backgroundVideoKey,
    } as unknown as Slide,
    { allowDownload: true }
  )

  const prev = blankVideoUrl.value
  blankVideoUrl.value = resolved.background || null
  if (prev && prev !== blankVideoUrl.value) {
    localMedia.releasePlaybackUrl(prev)
  }
}

/**
 * Both callers below are fire-and-forget, so anything this rejects with becomes
 * an unhandled rejection on the projector — a window with no toaster, no
 * console anyone is watching, and a congregation looking at it. The media work
 * inside already handles its own failures; this is the backstop for everything
 * else (a revoked URL, a settings shape that changed under us).
 */
const resolveBlankMedia = () =>
  resolveBlankVideo().catch((error) =>
    console.warn("Blank media could not be resolved:", error)
  )

watch(
  () => blankSettings.value,
  () => resolveBlankMedia(),
  { deep: true }
)
onMounted(() => resolveBlankMedia())
onBeforeUnmount(() => {
  revokeBlankVideoUrl()
  localMedia.releasePlaybackUrl(blankImageLocalUrl.value)
})

// The slide currently rendered in the crossfading face. It lags props.slide by
// the (image) preload so the incoming background doesn't flash blank mid-fade.
// Same-slide edits share this object's reactivity and update in place.
const displayedSlide = ref<Slide | null | undefined>(props.slide)

// A pair's frame fills its card, so a camera there covers rather than letter-
// boxes. A copy for this render only; the slide's own setting is kept.
const cameraData = computed(() => {
  const data = displayedSlide.value?.data as CameraSlideData | undefined
  return props.fillMedia && data ? { ...data, fit: "cover" as const } : data
})

// ── Fit text to a short box (slide pairs) ───────────────────────────────────
// Text sizes are in cqw of the projection box, set per element by the slide
// and its theme, so a parent font-size cannot shrink them. Instead the text is
// laid out on a wider, taller canvas (1/s of the box) and scaled by s back into
// it: the words wrap across the box's whole width first and only shrink as
// much as its height needs. cqw still measures the box, so the canvas growing
// does not grow the type. The measure is capped at FIT_TEXT_MAX_WIDTH of the
// box as seen, so a long verse does not run edge to edge.
const FIT_TEXT_PADDING = { top: 1.5, right: 4, bottom: 1.5, left: 4 }
const FIT_TEXT_MAX_WIDTH = 85 // % of the box, as it appears on screen
const FIT_MIN_SCALE = 0.3
const liveContent = ref<{ $el?: HTMLElement } | null>(null)
const fitScale = ref(1)

const fitStyleFor = (scale: number) => ({
  width: `${100 / scale}%`,
  height: `${100 / scale}%`,
  // A string either way: assigning undefined to a style property is ignored
  // and would leave a trial scale behind.
  transform: scale < 1 ? `scale(${scale})` : "none",
  transformOrigin: "0 0",
  "--pair-fit-max-width": `calc(${FIT_TEXT_MAX_WIDTH}cqw / ${scale})`,
})
const fitStyle = computed(() =>
  props.fitText ? fitStyleFor(fitScale.value) : undefined
)

/** Height the words need on the canvas, as laid out (transforms ignored). */
const naturalHeight = (ctn: HTMLElement) => {
  const style = getComputedStyle(ctn)
  const children = Array.from(ctn.children) as HTMLElement[]
  const gap = parseFloat(style.rowGap || "0") || 0
  return (
    children.reduce((sum, child) => sum + child.offsetHeight, 0) +
    gap * Math.max(0, children.length - 1) +
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0)
  )
}

/**
 * What the fit depends on: the words, the box and the fonts. Digits count as
 * one shape, so a countdown or clock ticking over (4:59 to 4:58) is the same
 * fit and costs nothing; the slide's style is in it because a font size change
 * re-wraps the words with the same text.
 */
let lastFitKey = ""
const fitKeyFor = (ctn: HTMLElement, box: HTMLElement) =>
  [
    (ctn.textContent || "").replace(/\d/g, "0"),
    box.clientWidth,
    box.clientHeight,
    document.fonts?.status,
    props.slide?.layout,
    JSON.stringify(props.slide?.slideStyle ?? null),
  ].join("|")

/**
 * The largest scale at which the words, wrapped at that scale's width, fit
 * the box's height. Wider wrapping means fewer lines, so the fit is not a
 * single ratio; a short binary search settles it. Each trial writes the
 * canvas size straight onto the element and reads the layout back (a forced
 * layout), then the answer is committed once through `fitScale`. The last
 * answer is tried first, so new words of a similar length settle in two or
 * three trials rather than nine.
 */
const measureFit = () => {
  const el = liveContent.value?.$el
  if (!props.fitText || !el) {
    fitScale.value = 1
    return
  }
  const ctn = el.querySelector?.(".slide-layout-ctn") as HTMLElement | null
  const box = el.parentElement as HTMLElement | null
  const boxHeight = box?.clientHeight || 0
  if (!ctn || !box || !boxHeight) return
  const key = fitKeyFor(ctn, box)
  if (key === lastFitKey) return
  lastFitKey = key

  const fits = (scale: number) => {
    Object.assign(el.style, fitStyleFor(scale))
    el.style.setProperty("--pair-fit-max-width", fitStyleFor(scale)["--pair-fit-max-width"])
    return naturalHeight(ctn) <= boxHeight / scale + 0.5
  }
  const search = (low: number, high: number, steps: number) => {
    let best = low
    for (let step = 0; step < steps; step++) {
      const mid = (low + high) / 2
      if (fits(mid)) {
        best = mid
        low = mid
      } else {
        high = mid
      }
    }
    return best
  }

  const last = fitScale.value
  let best: number
  if (fits(1)) {
    best = 1
  } else if (last < 1 && fits(last)) {
    best = fits(Math.min(1, last * 1.03)) ? search(last, 1, 6) : last
  } else if (last < 1) {
    best = search(FIT_MIN_SCALE, last, 6)
  } else {
    best = search(FIT_MIN_SCALE, 1, 8)
  }
  // Hand the inline styles back to Vue, which re-applies the settled scale.
  Object.assign(el.style, fitStyleFor(fitScale.value))
  el.style.setProperty(
    "--pair-fit-max-width",
    fitStyleFor(fitScale.value)["--pair-fit-max-width"]
  )
  // Ignore sub-pixel jitter so a re-measure never sets off another.
  if (Math.abs(best - fitScale.value) > 0.005) fitScale.value = best
}

// Every trigger (the box resizing, the words changing, fonts landing) asks
// for one measure on the next frame, however many arrive in it.
let fitFrame = 0
const scheduleFit = ({ force = false }: { force?: boolean } = {}) => {
  if (force) lastFitKey = ""
  if (fitFrame) return
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0
    measureFit()
  })
}

let fitObserver: ResizeObserver | null = null
let fitMutations: MutationObserver | null = null
const stopFitWatching = () => {
  fitObserver?.disconnect()
  fitMutations?.disconnect()
  fitObserver = fitMutations = null
  if (fitFrame) cancelAnimationFrame(fitFrame)
  fitFrame = 0
}
watch(
  () => [props.fitText, liveContent.value?.$el] as const,
  ([fit, el]) => {
    stopFitWatching()
    fitScale.value = 1
    lastFitKey = ""
    if (!fit || !el?.parentElement) return
    // Re-measure when the box resizes (layout change, window resize) or the
    // words change (verse navigation swaps the text in the same element).
    // The box is watched rather than the canvas, which this resizes itself.
    // The words themselves are watched too: a web font landing re-wraps them
    // with no resize of the box and no change to the markup.
    fitObserver = new ResizeObserver(() => scheduleFit())
    const observeWords = () => {
      fitObserver?.disconnect()
      fitObserver?.observe(el.parentElement!)
      el.querySelectorAll(".slide-layout-ctn > *").forEach((child) =>
        fitObserver?.observe(child)
      )
    }
    observeWords()
    fitMutations = new MutationObserver((records) => {
      // New elements need watching too; a text change alone does not.
      if (records.some((record) => record.type === "childList")) observeWords()
      scheduleFit()
    })
    fitMutations.observe(el, { childList: true, subtree: true, characterData: true })
    scheduleFit()
    document.fonts?.ready.then(() => scheduleFit({ force: true }))
  },
  { flush: "post" }
)
onBeforeUnmount(stopFitWatching)

// Interlude slides animate here: at full rate on the projector, at the
// preview rate in the operator's live output panel.
provide(
  interludeModeKey,
  computed(() => (props.fullScreen ? "live" : "preview"))
)
// The operator's preview is skipped where only one page may hold the camera
// (Safari's engine, the macOS app): opening it there would mute the projector.
// A teammate's computer sending the camera opens nothing here, so the preview
// shows it even there. The projector itself never uses a teammate's feed.
const cameraIsExclusive = cameraCaptureIsExclusive()
const { hostFor: cameraHostFor } = useCameraShare()
const opensCamera = computed(
  () =>
    props.cameraMode === "capture" ||
    (props.cameraMode === "preview" &&
      (!cameraIsExclusive || !!cameraHostFor(cameraData.value)))
)
const labelLayerClass = computed(() =>
  displayedSlide.value?.type === slideTypes.interlude ? "z-20" : "z-10"
)
const interludeExit = ref<InterludeExitSignal | null>(null)
provide(interludeExitKey, interludeExit)
let slideChangeToken = 0

// Resolve the Vue transition name from the transition type. Only `fade` is
// implemented today; future types (slide/zoom/cut) plug in here + one CSS block.
const transitionName = computed(() => `cow-slide-${transitionTypes.fade}`)
const isLivePageFullScreen = computed(
  () => props.fullScreen && route.path === "/live"
)

// The embedded player's address, worked out once per video and loop setting.
// Its sound is changed through the player's API (see sendEmbedMute), never by
// a new address, which would reload the video from the start.
const embedKey = computed(() => {
  const data = props.slide?.data as ExternalVideo | undefined
  if (
    !props.fullScreen ||
    props.slide?.type !== slideTypes.media ||
    (data?.type !== "youtube" && data?.type !== "vimeo")
  ) {
    return ""
  }
  const shouldLoop =
    props.slide?.type !== slideTypes.media || !!props.slide?.slideStyle?.repeatMedia
  return `${props.slide.id}|${data.url}|${shouldLoop}`
})
const embedSrc = ref("")
watch(
  embedKey,
  (key) => {
    embedSrc.value = key ? getEmbedUrl(props.slide!.data as ExternalVideo) : ""
  },
  { immediate: true }
)

function getEmbedUrl(data: ExternalVideo): string {
  const isMuted =
    props.audioMuted ||
    (!props.fullScreen ? true : props.slide?.slideStyle?.isMediaMuted)
  const shouldLoop =
    props.slide?.type !== slideTypes.media ||
    props.slide?.slideStyle?.repeatMedia

  return externalEmbedUrl(data, {
    muted: !!isMuted,
    loop: !!shouldLoop,
    origin: window.location.origin,
  })
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
    // Moving off an interlude: hold it while its text blurs out, then
    // let the usual crossfade take over. A newer change supersedes this one.
    const token = ++slideChangeToken
    const leaving = displayedSlide.value
    if (
      leaving?.type === slideTypes.interlude &&
      leaving.id !== newSlide?.id &&
      currentState.value.settings.animations
    ) {
      interludeExit.value = { id: leaving.id, exiting: true }
      await new Promise((resolve) => setTimeout(resolve, INTERLUDE_EXIT_MS))
      if (token !== slideChangeToken) return
    } else if (
      leaving &&
      newSlide?.id === leaving.id &&
      interludeExit.value?.id === leaving.id &&
      interludeExit.value.exiting
    ) {
      // Back to the same interlude before its exit finished.
      interludeExit.value = { id: leaving.id, exiting: false }
    }

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

// The playable file for the current slide, or null when there is nothing this
// element can play (a still background, or a YouTube/Vimeo link the iframe owns).
// Only an audio file feeds the <audio> element; see the template.
const isAudioSlide = computed(
  () => !!(props.slide?.data as ExtendedFileT | undefined)?.type?.includes("audio")
)

const playableVideo = computed(() => {
  const slide = props.slide
  if (!slide || slide.backgroundType !== backgroundTypes.video) return null
  const type = (slide.data as any)?.type
  if (type === "youtube" || type === "vimeo") return null
  return slide.background ? { id: slide.id, src: slide.background } : null
})

// The source often arrives well after the slide does. On a device that did not
// upload the file, `background` is still the cloud URL — or blank — at the
// moment the slide goes live, and the local URL is swapped in once the download
// lands: a new object with the SAME id, so the watcher above never fires again.
// That left the element relying on the bare `autoplay` attribute, which Chrome
// refuses for unmuted media without user activation, and the video sat on its
// first frame. Playing on the source itself covers both arrivals.
// The operator's Live Output preview does the same on its own muted copy, so it
// plays whether or not a projector window is open.
const mediaElement = () => (props.fullScreen ? video.value : previewVideo.value)

watch(playableVideo, async (next, previous) => {
  if (!next) return
  if (previous?.id === next.id && previous.src === next.src) return

  // Same slide, new source: the local copy replaced the cloud URL it had been
  // streaming. It is the same footage, so keep the position rather than
  // restarting the clip mid-service. A different slide starts from the top.
  const sameSlide = previous?.id === next.id
  const current = mediaElement()
  const resumeAt = sameSlide && current ? current.currentTime : 0
  // Paused by the operator while the local copy was still saving: it stays
  // paused when the copy lands. Playing it here undid the pause mid-service.
  // A stream that simply has not started yet (no pause pressed) still plays.
  const stayPaused =
    sameSlide &&
    !!current?.paused &&
    !current?.ended &&
    !!props.slide?.slideStyle?.mediaCommandAt &&
    props.slide?.slideStyle?.isMediaPlaying === false

  // Let Vue patch :src onto the element before asking it to play.
  await nextTick()
  const element = mediaElement()
  if (!element) return

  if (resumeAt > 0) {
    const seek = () => {
      // Seeking past a shorter re-encode throws; the clip still plays.
      try {
        element.currentTime = resumeAt
      } catch (error) {
        console.warn("Could not restore video position after source swap:", error)
      }
    }
    if (element.readyState >= 1) seek()
    else element.addEventListener("loadedmetadata", seek, { once: true })
  }

  if (stayPaused) {
    // The new src re-arms the element's `autoplay`. The element already
    // reports `paused`, so safePauseMedia would skip it; only a real pause()
    // call disarms autoplay.
    try {
      element.pause()
    } catch {
      // Nothing loaded yet to pause; autoplay is disarmed all the same.
    }
    return
  }
  safePlayMedia(element)
})

// The projector reports its video's playback, and the operator-side preview
// copy is corrected by it. Only the /live window is the projector: the public
// livestream page plays for viewers elsewhere, and the operator's Large Preview
// is a full-screen copy that must not pass for it.
useReportMediaPlayback(
  video,
  () => props.slide?.id,
  () => props.fullScreen && route.path === "/live"
)
useFollowMediaPlayback(
  previewVideo,
  () => props.slide?.id,
  () => !props.fullScreen
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
        !appStore.isSlideLive(slide.id)
      ) {
        return
      }

      // The operator's preview copy follows the seek too.
      if (!props.fullScreen) {
        if (previewVideo.value) previewVideo.value.currentTime = newSeekPosition
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
// Every play/pause press carries a fresh `mediaCommandAt`, so it lands even
// when `isMediaPlaying` already held that value: a video starts on its own when
// it goes live while the stored value still says paused.
//
// Only a command for the slide already on screen counts. Comparing across a
// slide change paused a video as it went live whenever the slide before it had
// last been played from the toolbar (`true` there, `false` on the new one).
watch(
  () =>
    [
      props.slide?.id,
      props.slide?.slideStyle?.isMediaPlaying,
      props.slide?.slideStyle?.mediaCommandAt,
    ] as const,
  ([slideId, isPlaying, commandAt], previous) => {
    const [previousId, wasPlaying, previousCommandAt] = previous ?? []
    if (
      slideId !== previousId ||
      (isPlaying === wasPlaying && commandAt === previousCommandAt)
    ) {
      return
    }

    try {
      const slide = props.slide
      if (
        !appMounted.value ||
        !slide?.id ||
        !appStore.isSlideLive(slide.id)
      ) {
        return
      }

      // The operator's preview copy: muted, no embedded players to command.
      if (!props.fullScreen) {
        if (isPlaying) safePlayMedia(previewVideo.value)
        else if (isPlaying !== undefined && slide.type === slideTypes.media) {
          safePauseMedia(previewVideo.value)
        }
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

// Mute and unmute an embedded YouTube or Vimeo player. Its address is fixed
// per video (see embedSrc), so this is the only way its sound changes: from
// the slide's own mute, or from a slide pair handing its sound to the other
// member (`audioMuted`). Re-sent when the player loads, since a command sent
// before it is ready is dropped.
const effectiveMuted = computed(
  () =>
    props.audioMuted ||
    !props.fullScreen ||
    !!props.slide?.slideStyle?.isMediaMuted
)
const sendEmbedMute = () => {
  const data = props.slide?.data as ExternalVideo | undefined
  const target = iframe.value?.contentWindow
  if (!target || (data?.type !== "youtube" && data?.type !== "vimeo")) return
  try {
    if (data.type === "youtube") {
      safePostMessage(
        target,
        JSON.stringify({
          event: "command",
          func: effectiveMuted.value ? "mute" : "unMute",
          args: [],
        }),
        "*"
      )
    } else {
      safePostMessage(
        target,
        JSON.stringify({ method: "setVolume", value: effectiveMuted.value ? 0 : 1 }),
        "*"
      )
    }
  } catch (err) {
    console.error("Error controlling media mute:", err)
  }
}
watch(effectiveMuted, (muted, wasMuted) => {
  if (muted !== wasMuted) sendEmbedMute()
})

// Hand a playing video or audio file over to whichever element shows this
// slide next, so moving between a single slide and a pair (or hiding a pair
// member and showing it again) carries on where it was. See useMediaHandoff.
const watchMediaHandoff = (
  el: Ref<HTMLMediaElement | null>,
  kind: "video" | "audio"
) => {
  watch(
    [() => props.slide?.id, el] as const,
    ([slideId, current], previous) => {
      const [previousId, previousEl] = previous ?? []
      if (previousId && previousEl) {
        releaseMedia(mediaHandoffKey(previousId, kind), previousEl)
      }
      if (slideId && current) adoptMedia(mediaHandoffKey(slideId, kind), current)
    },
    { immediate: true, flush: "post" }
  )
  onBeforeUnmount(() => {
    const slideId = props.slide?.id
    if (slideId && el.value) {
      releaseMedia(mediaHandoffKey(slideId, kind), el.value, { keepPosition: true })
    }
  })
}
watchMediaHandoff(video, "video")
watchMediaHandoff(audio, "audio")

onMounted(() => {
  appMounted.value = true
  if (props.fullScreen) {
    safePlayMedia(video.value)
  } else if (
    // The preview plays on its own, unless the operator paused this clip.
    !(
      props.slide?.slideStyle?.mediaCommandAt &&
      props.slide?.slideStyle?.isMediaPlaying === false
    )
  ) {
    safePlayMedia(previewVideo.value)
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

<style scoped>
/* Slide pairs only (caption, lower third): the words' measure is capped at a
   share of the box as seen, and centred in it. See measureFit. */
/* The fit writes trial sizes onto this canvas and reads the layout straight
   back, so none of it may be transitioned (the global .tiptap.live-content
   rule transitions everything): a read would return the old size and the
   search would settle on the wrong scale, leaving lines spilling out of the
   box. It also kept the words re-wrapping every frame for half a second. */
.pair-fit-text {
  transition: none !important;
}
/* The operator's live preview (.lg-preview in main.css) gives the words a
   196px minimum height, meant for a whole slide. A caption or lower third is
   far shorter, so that floor pushed the words below the box. The fit sizes
   the canvas itself. */
.pair-fit-text :deep(.slide-layout-ctn) {
  min-height: 0;
}
.pair-fit-text :deep(.slide-layout-ctn > *) {
  max-width: var(--pair-fit-max-width, 100%);
  margin-inline: auto;
}

/* Slide pairs only (the caption layout): words straight over a picture. */
.pair-text-shadow :deep(*) {
  text-shadow: 0 0.12cqw 0.6cqw rgba(0, 0, 0, 0.55),
    0 0 0.2cqw rgba(0, 0, 0, 0.35);
}
</style>

<style>
/* Leaving for a slide pair. Pages mount a single slide inside
   <Transition name="cow-single">, so when a pair takes its place it fades out
   over the entering pair instead of the screen cutting to black first. Its
   length follows the slide transition setting (0 with animations off). */
.cow-single-leave-active {
  position: absolute !important;
  inset: 0;
  z-index: 5;
  transition: opacity var(--cow-transition-duration, 0.3s) cubic-bezier(0.4, 0, 0.7, 0.2);
}
.cow-single-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .cow-single-leave-active {
    transition: none;
  }
}
</style>
