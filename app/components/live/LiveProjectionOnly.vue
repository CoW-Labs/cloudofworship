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
              :camera-mode="
                cameraMode === 'placeholder' ? 'placeholder' : 'preview'
              "
            />
          </UCard>
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
import { cameraCaptureIsExclusive } from "~/composables/useCameraStream"
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
const audio = ref<HTMLAudioElement | null>(null)
const iframe = ref<HTMLIFrameElement | null>(null)
const isLargePreviewOpen = ref<boolean>(false)
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
    audioMuted?: Boolean
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
const opensCamera = computed(
  () =>
    props.cameraMode === "capture" ||
    (props.cameraMode === "preview" && !cameraCaptureIsExclusive())
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
watch(playableVideo, async (next, previous) => {
  if (!next || !props.fullScreen) return
  if (previous?.id === next.id && previous.src === next.src) return

  // Same slide, new source: the local copy replaced the cloud URL it had been
  // streaming. It is the same footage, so keep the position rather than
  // restarting the clip mid-service. A different slide starts from the top.
  const resumeAt =
    previous?.id === next.id && video.value ? video.value.currentTime : 0

  // Let Vue patch :src onto the element before asking it to play.
  await nextTick()
  const element = video.value
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

  safePlayMedia(element)
})

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
        !appStore.isSlideLive(slide.id)
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
        !appStore.isSlideLive(slide.id)
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
