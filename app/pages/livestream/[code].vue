<template>
  <!-- The server refused this schedule: no slide will ever arrive, so the
       loader below would spin forever and the projection surface would stay
       black with nothing to explain it. -->
  <LivestreamUnavailable
    v-if="tierRestricted"
    :reason="tierRestrictionReason"
  />
  <template v-else>
    <!-- Same splash as the operator console (layouts/app.vue), so the hand-off
         from the pre-hydration boot screen carries on instead of jumping to a
         different loader. -->
    <Transition name="fade-sm">
      <div
        v-if="loadingResources"
        class="loading-ctn h-[100vh] w-[100vw] fixed inset-0 z-50 grid place-items-center bg-white px-6 text-[#131724] dark:bg-[#131724] dark:text-white"
      >
        <div class="wrapper flex w-full max-w-[324px] flex-col items-center">
          <CoWSplashLogo class="w-[76px] shrink-0" />

          <div
            class="bar mt-[34px] h-1 w-full overflow-hidden rounded-full bg-[#e6e8ef] dark:bg-[#222838]"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="downloadProgress"
            aria-label="Loading background videos"
          >
            <div
              class="h-full rounded-full bg-current transition-[width] duration-500 ease-out"
              :style="{ width: `${Math.max(downloadProgress, 3)}%` }"
            />
          </div>
        </div>
      </div>
    </Transition>
    <div
      v-if="!loadingResources"
      class="main relative max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
      :id="currentState.liveSlideId?.toString()"
      @dblclick="toggleFullScreen"
    >
      <!-- No banner here, unlike /live: this page is mostly an OBS / vMix
           browser source, which is never full screen, so any chrome drawn
           over the output ends up in the church's stream. Double click and
           the shortcut still toggle full screen for a plain browser tab. -->
      <DisplayConnectionStatus :status="connectionStatus" />

      <Transition name="cow-pair">
        <LivePairProjection
          v-if="livePairSlides"
          :slides="livePairSlides"
          :full-screen="true"
          :slide-styles="currentState.settings.slideStyles"
        />
      </Transition>
      <Transition name="cow-single">
        <LiveProjectionOnly
          v-if="!livePairSlides && liveSlide"
          :content-visible="true"
          :id="liveSlide?.id"
          :full-screen="true"
          :slide="liveSlide!!"
          :slide-label="false"
          :slide-styles="currentState.settings.slideStyles"
          :audio-muted="
              liveSlide?.slideStyle?.isMediaMuted!!
            "
        />
      </Transition>
      <AlertView />
    </div>
  </template>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import type { BackgroundVideo, LivePayload, Slide } from "~/types"
import {
  continueAsSolo,
  isPairPayload,
  patchLivePayload,
} from "~/utils/slidePairs"
import { useAppStore } from "@/store/app"
import { until } from "@vueuse/core"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"
// The `live` layout is what loads /css/fonts.css and /css/main.css as real
// stylesheets, as it does for /live. Without it this page only had the
// global rel="prefetch" swap, which browsers without prefetch never apply.
definePageMeta({ layout: "live", middleware: "schedule-code" })

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
// What is on screen: one slide, a slide pair's members, or null for blank.
const livePayload = ref<LivePayload>(null)
const liveSlide = computed<Slide | null>(() =>
  isPairPayload(livePayload.value) ? null : livePayload.value
)
const livePairSlides = computed<Slide[] | null>(() =>
  isPairPayload(livePayload.value) ? livePayload.value : null
)
const onScreenSlide = (slideId?: string | null) =>
  slideId
    ? (isPairPayload(livePayload.value)
        ? livePayload.value
        : livePayload.value
        ? [livePayload.value]
        : []
      ).find((slide) => slide.id === slideId)
    : undefined
const isFullScreen = ref(false)
// 0–100 across every background video still to download.
const downloadProgress = ref(0)
const route = useRoute()
// `/livestream/:code`; the schedule-code middleware has already resolved it.
const scheduleId = useScheduleCodeLookup().resolvedId(route.params.code)
const loadingResources = ref<boolean>(true)
const cachedVideosURLs = ref<BackgroundVideo[]>()
const localMedia = useLocalMediaStorage()
const { rehydrateSlideMediaWithStatus, prefetchScheduleMedia } =
  useSlideMediaCache()
const connectionStatus = ref<
  "connecting" | "connected" | "disconnected" | "failed"
>("connecting")
const showConnectionError = ref(false)
// Set by the server's `tier-restricted` event. Once refused, stay refused: the
// socket remains connected but empty, and flipping back would need a fresh
// connection, which is what a reload gives.
const tierRestricted = ref(false)
const tierRestrictionReason = ref<"plan" | "quota">("plan")

useHead({
  title: "Livestream - Cloud of Worship",
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})

const checkFullScreen = () => {
  if (document.fullscreenElement) {
    isFullScreen.value = true
  } else {
    isFullScreen.value = false
  }
}

const toggleFullScreen = () => {
  if (document.fullscreenElement) {
    exitFullscreenSafely()
  } else {
    requestFullscreenSafely(document.documentElement)
  }
}

let cleanupShortcut: (() => void) | null = null

onMounted(() => {
  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)
  checkFullScreen()
  cleanupShortcut = useRegisteredShortcut(shortcutIds.fullscreen, toggleFullScreen)
})

const saveAllBackgroundVideos = async () => {
  const videoIds = [1, 2, 3, 4, 5, 6, 9, 10]
  const savedKeys = new Set(
    (await localMedia.listRecords()).map((record) => record.key)
  )

  const missingVideoIds = videoIds.filter(
    (id) => !savedKeys.has(`/video-bg-${id}.mp4`)
  )
  // Two download at once, so each reports its own fraction and the bar shows
  // their sum. A failed video counts as done: it no longer holds the loader.
  const fractions = new Map<number, number>()
  const reportProgress = (id: number, fraction: number) => {
    fractions.set(id, Math.min(Math.max(fraction, 0), 1))
    const done = [...fractions.values()].reduce((sum, f) => sum + f, 0)
    downloadProgress.value = Math.round(
      (done / Math.max(missingVideoIds.length, 1)) * 100
    )
  }

  const batchSize = 2
  for (let i = 0; i < missingVideoIds.length; i += batchSize) {
    await Promise.all(
      missingVideoIds.slice(i, i + batchSize).map(async (id) => {
        // One dropped download must not hold the viewer on the loader: a
        // video that failed to cache is simply left out of the cached list,
        // as the operator console does.
        try {
          await localMedia.downloadToLocal({
            key: `/video-bg-${id}.mp4`,
            groupId: `/video-bg-${id}.mp4`,
            category: "preset",
            kind: "video",
            url: await backgroundVideoAssetUrl(id),
            mimeType: "video/mp4",
            recoverable: true,
            onProgress: (fraction) => {
              if (Number.isFinite(fraction)) reportProgress(id, fraction)
            },
          })
        } catch (err) {
          console.warn(`Failed to download video-bg-${id}:`, err)
        } finally {
          reportProgress(id, 1)
        }
      })
    )
  }
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  cachedVideosURLs.value = cachedVideos
  appStore.setBackgroundVideos(cachedVideos)
}

const updateBlobBackgroundURl = (slide: Slide) => {
  const updatedSlide = { ...slide }
  if (
    updatedSlide.background?.startsWith("blob:") &&
    updatedSlide.backgroundType === backgroundTypes.video
  ) {
    updatedSlide.background = currentState.value.backgroundVideos?.find(
      (video) => video.id === updatedSlide.backgroundVideoKey
    )?.url
  }
  return updatedSlide
}

const updateBlobBackgroundURls = (slides: Slide[]) => {
  if (!Array.isArray(slides)) return slides
  return slides?.map((slide) => updateBlobBackgroundURl(slide))
}

// Resolved once the background videos are cached and registered on the store.
// The socket now connects before that work starts, so without this a slide
// arriving early would resolve its video background against an empty list and
// render with no background at all.
let markResourcesReady: () => void = () => {}
const resourcesReady = new Promise<void>((resolve) => {
  markResourcesReady = resolve
})

// A download that fails (a weak connection at the start of a service) is
// retried inside useSlideMediaCache; `onRecovered` hands back the slide once the
// bytes land, so the media appears without waiting for the next slide change.
const localizeSlide = async (
  slide: Slide,
  onRecovered?: (recovered: Slide) => void
) => {
  await resourcesReady
  const { slide: localized } = await rehydrateSlideMediaWithStatus(
    updateBlobBackgroundURl({ ...slide }),
    { allowDownload: true, onRecovered }
  )
  return localized
}

// Recovered media only applies while that slide is still the one on screen.
// Its URLs are taken but the current slide is kept, so a page or verse the
// operator moved to during the download still wins.
const withRecoveredMedia = (current: Slide, recovered: Slide): Slide => ({
  ...current,
  background:
    recovered.type === slideTypes.presentation
      ? recovered.presentationObjects?.[current.presentationPageIndex ?? 0]
          ?.imageUrl || current.background
      : recovered.background,
  presentationObjects: recovered.presentationObjects,
  data:
    current.data && (recovered.data as any)?.url
      ? ({
          ...(current.data as any),
          url: (recovered.data as any).url,
        } as Slide["data"])
      : current.data,
})

const applyRecoveredToLive = (recovered: Slide) => {
  const current = onScreenSlide(recovered.id)
  if (current) {
    livePayload.value = patchLivePayload(
      livePayload.value,
      withRecoveredMedia(current, recovered)
    )
  }
}

const applyRecoveredToOverlay = (recovered: Slide) => {
  const overlay = appStore.currentState.activeOverlaySlide
  if (overlay?.id === recovered.id) {
    appStore.setActiveOverlaySlide(withRecoveredMedia(overlay, recovered))
  }
}

// Media is downloaded before a slide is shown, so a slow slide can finish
// after a quicker one sent later. As /live does with its broadcast timestamps,
// only the newest message may land: `liveSeq` moves on each `live-slide`,
// `updateSeq` orders edits to the slide on screen, `overlaySeq` the overlay.
let liveSeq = 0
let updateSeq = 0
let overlaySeq = 0

const showOverlaySlide = async (data: Slide | null) => {
  const seq = ++overlaySeq
  const slide = data
    ? await localizeSlide({ ...data }, applyRecoveredToOverlay)
    : null
  if (seq !== overlaySeq) return
  appStore.setActiveOverlaySlide(slide)
}

const handleWebSocketMessage = async (parsedData: any) => {
  const { data, action } = parsedData

  switch (action) {
    case "connected":
      // Only process if data contains slides array
      if (Array.isArray(data)) {
        await resourcesReady
        const slides = updateBlobBackgroundURls(data)
        await prefetchScheduleMedia(slides, currentState.value.liveSlideId)
      }
      break
    case "live-slide":
      // The operator changed what is on screen. This is the only thing that
      // seeds liveSlide — without it the page renders nothing at all.
      // A null payload means blank: clear the stream.
      // A slide pair arrives as its members' array, each localised on its own.
      {
        const seq = ++liveSeq
        const payload: LivePayload = isPairPayload(data)
          ? await Promise.all(
              (data as Slide[]).map((member) =>
                localizeSlide({ ...member }, applyRecoveredToLive)
              )
            )
          : data
          ? await localizeSlide({ ...data }, applyRecoveredToLive)
          : null
        if (seq !== liveSeq) break
        // One of the pair's own slides going on alone carries on in the
        // pair's place, so its video keeps playing (see continueAsSolo).
        livePayload.value =
          isPairPayload(livePayload.value) && payload && !isPairPayload(payload)
            ? continueAsSolo(livePayload.value, payload) ?? payload
            : payload
      }
      break
    case "new-slide":
    case "slide-created":
      // New slide created in real-time
      break
    case "update-slide":
    case "slide-updated":
      // Update the livestream slide when any edit is made to the current live slide
      // This ensures real-time updates for content changes, not just live slide selections
      // Inside a live pair only the edited member changes; the other keeps
      // playing.
      if (onScreenSlide(data.id) || onScreenSlide(data.slideId)) {
        // Dropped if the operator went to another slide, or a later edit
        // landed, while this one's media was loading.
        const live = liveSeq
        const seq = ++updateSeq
        const slideData = await localizeSlide({ ...data }, applyRecoveredToLive)
        if (live === liveSeq && seq === updateSeq) {
          // Create a new object to trigger Vue reactivity
          livePayload.value = patchLivePayload(livePayload.value, {
            ...slideData,
            id: slideData.id || data.slideId,
          })
        }
      }
      if (
        appStore.currentState.activeOverlaySlide?.id === data.id ||
        appStore.currentState.activeOverlaySlide?.id === data.slideId
      ) {
        await showOverlaySlide(data)
      }
      break
    case "delete-slide":
    case "slide-deleted":
      if (
        appStore.currentState.activeOverlaySlide?.id === data.slideId ||
        appStore.currentState.activeOverlaySlide?.id === data.id ||
        appStore.currentState.activeOverlaySlide?._id === data._id
      ) {
        await showOverlaySlide(null)
      }
      break
    case "add-alert":
      appStore.setActiveAlert(data)
      break
    case "remove-alert":
      appStore.setActiveAlert(null)
      break
    case "add-overlay":
      appStore.setActiveOverlay(data)
      break
    case "remove-overlay":
      appStore.setActiveOverlay("")
      break
    case "show-slide-overlay":
      await showOverlaySlide(data)
      break
    case "remove-slide-overlay":
      await showOverlaySlide(null)
      break
    case "updated-slides":
      break
    default:
    // Unknown action
  }
}

const socketManager = useSocketIO({
  scheduleId,
  // Identifies this as the public viewer, which is what scopes the Teams gate
  // to this page. The operator console and /mobile stay ungated on every plan.
  client: "livestream",
  maxRetries: 30,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  connectionTimeout: 10000,
  onMessage: (event, data) => void handleWebSocketMessage(data),
  onTierRestricted: (restriction) => {
    tierRestricted.value = true
    tierRestrictionReason.value =
      restriction?.reason === "quota" ? "quota" : "plan"
    // A refused socket never reports a connection problem, so clear the
    // reconnecting chrome that would otherwise sit over the wall.
    connectionStatus.value = "connected"
    loadingResources.value = false
    usePosthogCapture("LIVESTREAM_TIER_RESTRICTED", {
      scheduleId,
      reason: tierRestrictionReason.value,
    })
  },
  onConnected: () => {
    connectionStatus.value = "connected"
    showConnectionError.value = false
    usePosthogCapture("REMOTE_CONTROL_CONNECTED", {
      scheduleId,
    })
  },
  onDisconnected: () => {
    connectionStatus.value = "disconnected"
    usePosthogCapture("REMOTE_CONTROL_DISCONNECTED", {
      scheduleId,
    })
  },
  onError: (error) => {
    console.error("❌ Socket error:", error)
    connectionStatus.value = "disconnected"
  },
  onMaxRetriesReached: () => {
    console.error("❌ Max retries reached. Could not establish connection.")
    connectionStatus.value = "failed"
    showConnectionError.value = true
  },
})

// Watch for reactive connection state changes for seamless reconnection
watch(
  () => socketManager.isConnectedRef?.value,
  (isConnected) => {
    if (isConnected) {
      connectionStatus.value = "connected"
      showConnectionError.value = false
    } else if (socketManager.isReconnecting?.value) {
      connectionStatus.value = "disconnected"
    }
  }
)

watch(
  () => socketManager.isReconnecting?.value,
  (isReconnecting) => {
    if (isReconnecting && !socketManager.isConnectedRef?.value) {
      connectionStatus.value = "disconnected"
    }
  }
)

onBeforeMount(async () => {
  // Connect before downloading, not after. The background videos are hundreds
  // of megabytes, and a refused viewer used to pay for all of them before
  // finding out no slide was ever coming.
  socketManager.connect()

  // The server answers from a cached plan, so a refusal lands in milliseconds.
  // This only ever waits out the grace period when the schedule is allowed —
  // and a fraction of a second is nothing against the download it precedes.
  await Promise.race([
    until(tierRestricted).toBe(true),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ])
  if (tierRestricted.value) return

  try {
    await saveAllBackgroundVideos()
    await setCachedVideosURL()
  } finally {
    // Whatever failed is still reported, but the viewer gets the stream:
    // until this runs no live slide renders, and the loader never clears.
    markResourcesReady()

    downloadProgress.value = 100
    setTimeout(() => {
      loadingResources.value = false
    }, 100)
  }
})

onBeforeUnmount(() => {
  // Clean up Socket.IO connection
  socketManager.disconnect()
  cleanupShortcut?.()

  // Clean up fullscreen event listeners
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>
