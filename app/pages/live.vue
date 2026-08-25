<template>
  <div
    class="main max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId?.toString()"
  >
    <div
      v-if="!isFullScreen && !isTauri"
      class="banner inset-0 bottom-auto h-[60px] flex items-center justify-center bg-primary-100 text-black text-center bg-opacity-70"
    >
      <div class="banner-text text-lg flex items-center gap-6">
        <span v-if="!mostUpdatedLiveSlide"
          ><span class="font-bold">Select a slide</span> from the Slide Schedule
          Pane to show here</span
        >
        <span v-else
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
    <!-- Using motionless slides to test bug with Bible Slides not moving to next slide in live view -->
    <!-- <Transition class="fade"> -->
    <LiveProjectionOnly
      :content-visible="true"
      :id="currentState.liveSlideId"
      :full-screen="true"
      :slide="mostUpdatedLiveSlide"
      :slide-label="false"
      :slide-styles="currentState.settings.slideStyles"
      :audio-muted="mostUpdatedLiveSlide?.slideStyle?.isMediaMuted!!"
    />
    <!-- </Transition> -->

    <AlertView />
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "@/store/app"
import type { Slide } from "~/types"
import type {
  LiveBroadcastEnvelope,
  LiveSlideChangedNotification,
  SlideOverlayBroadcast,
} from "~/composables/useBroadcastPost"
import { resolveLiveSlideBroadcast } from "~/composables/useBroadcastPost"
import { useAuthStore } from "~/store/auth"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"

// Use dedicated live layout
definePageMeta({
  layout: "live",
})

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)
const { isTauri } = useTauri()
const isFullScreen = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10
const mostUpdatedLiveSlide = ref<Slide | null>(null)
const lastBroadcastTs = ref(0)
const lastOverlayBroadcastTs = ref(0)

// Local-first media for the projection window. blob: URLs are scoped to the
// operator document that created them, so they die when that tab closes/reloads.
// We rehydrate incoming media from THIS window's shared IndexedDB (downloading
// once if needed) and cache the localized URLs per source signature so repeated
// same-slide broadcasts (e.g. verse changes) don't re-download, re-create object
// URLs, or reload the <video>.
const { rehydrateSlideMedia } = useSlideMediaCache()
const localMedia = useLocalMediaStorage()
type LocalizedMedia = {
  background?: string
  dataUrl?: string
  presentationObjects?: Slide["presentationObjects"]
}
const localizedLiveMedia = new Map<string, LocalizedMedia>()

const slideNeedsLocalMedia = (slide: Slide) =>
  slide.type === slideTypes.media ||
  slide.type === slideTypes.presentation ||
  !!slide.backgroundImageKey ||
  !!slide.backgroundVideoKey

// A presentation ships every page in one slide object; paging only changes
// presentationPageIndex, and the broadcast blanks blob:/asset: URLs — so its
// background is "" on the wire for every page. Keying on the background made
// all pages share one cache entry and page 2+ kept re-applying page 1's URL.
// Key presentations on the slide id and cache the whole localized page list.
const mediaSignature = (slide: Slide) =>
  slide.type === slideTypes.presentation
    ? `presentation:${slide.id}`
    : `${slide.id}|${slide.background ?? ""}`

const applyLocalizedMedia = (slide: Slide, cached: LocalizedMedia) => {
  // Presentations resolve their background from the cached page list so the
  // page currently being projected wins. A presentation with no localized page
  // list (nothing cached locally) falls through to the generic handling below.
  if (slide.type === slideTypes.presentation && cached.presentationObjects?.length) {
    slide.presentationObjects = cached.presentationObjects
    slide.background =
      cached.presentationObjects[slide.presentationPageIndex ?? 0]?.imageUrl ||
      slide.background
    return
  }
  if (cached.background) slide.background = cached.background
  if (cached.dataUrl && slide.data) {
    ;(slide.data as any).url = cached.dataUrl
  }
}

useHead({
  title: "Live Projection - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service with Cloud of Worship's live projection feature.",
    },
    {
      name: "keywords",
      content:
        "live projection, worship display, church presentation, full screen slides, live worship, church service display, presentation software",
    },
    { property: "og:title", content: "Live Projection - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service with Cloud of Worship's live projection feature.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Live Projection - Cloud of Worship",
    },
    {
      name: "twitter:description",
      content:
        "Display worship slides, lyrics, Bible verses, and media in full screen during your church service.",
    },
  ],
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
    {
      rel: "stylesheet",
      href: "/css/fonts.css",
    },
    {
      rel: "stylesheet",
      href: "/css/main.css",
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

onMounted(() => {
  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)

  // Prevent default action on specific keys
  document.addEventListener("keydown", function (event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "f" || event.key === "F")
    ) {
      event.preventDefault()
    }
  })

  // Shortcut to go full screen
  useRegisteredShortcut(shortcutIds.fullscreen, () => {
    if (document.fullscreenElement) {
      exitFullscreenSafely()
    } else {
      requestFullscreenSafely(document.documentElement)
    }
  })

  checkFullScreen()

  // Restore only the projection record that agrees with lightweight shared state.
  const initializeLiveSlide = async () => {
    const projected = await useLiveProjectionRepository().getCurrent()
    const expectedSlideId = currentState.value.liveSlideId || null
    if (
      projected &&
      isRestorableLiveProjection(projected, {
        expectedSlideId,
        churchId: authStore.user?.churchId,
      })
    ) {
      mostUpdatedLiveSlide.value = projected.slide
      if (
        projected.slideId &&
        appStore.currentState.liveSlideId !== projected.slideId
      ) {
        appStore.setLiveSlide(projected.slideId)
      } else if (!projected.slideId && appStore.currentState.liveSlideId) {
        appStore.setLiveSlide("")
      }
      return
    }
    // Never resurrect a schedule slide when the projected record is missing,
    // expired, from another church, or disagrees with the shared live slide id.
    if (!expectedSlideId) mostUpdatedLiveSlide.value = null
  }

  // Initialize the slide display
  void initializeLiveSlide().catch((error) =>
    console.warn("Unable to restore the live projection from IndexedDB:", error)
  )
  const stopRestoreWatch = watch(
    () => currentState.value.liveSlideId,
    () => {
      void initializeLiveSlide().catch((error) =>
        console.warn("Unable to reconcile the live projection:", error)
      )
    }
  )

  // Store cleanup function to properly dispose of BroadcastChannel
  const cleanupBroadcast = useBroadcastMessage(async (data) => {
    try {
      // Accept the old JSON envelope during hot updates, but use the direct
      // structured-clone object for all new messages.
      const envelope = (typeof data === "string" ? JSON.parse(data) : data) as
        | LiveBroadcastEnvelope<
            | Slide
            | null
            | string
            | SlideOverlayBroadcast
            | LiveSlideChangedNotification
          >
        | undefined
      if (!envelope || typeof envelope.ts !== "number") return

      const payload =
        typeof envelope.payload === "string"
          ? JSON.parse(envelope.payload)
          : envelope.payload

      if (
        payload?.action === appWideActions.showSlideOverlay ||
        payload?.action === appWideActions.removeSlideOverlay
      ) {
        if (envelope.ts < lastOverlayBroadcastTs.value) return
        lastOverlayBroadcastTs.value = envelope.ts
        appStore.setActiveOverlaySlide(
          payload.action === appWideActions.showSlideOverlay
            ? payload.slide || null
            : null
        )
        return
      }

      // Drop messages that arrive out of order (e.g. a background countdown
      // tick from a tab that hasn't yet caught up to a newer local live output
      // change) instead of always applying whatever lands last.
      if (envelope.ts < lastBroadcastTs.value) return

      const resolved = await resolveLiveSlideBroadcast(payload)
      if (!resolved.matched) return
      // The IndexedDB read yielded. Re-check in case a newer notification was
      // resolved and displayed while this one was waiting.
      if (envelope.ts < lastBroadcastTs.value) return
      lastBroadcastTs.value = envelope.ts
      const parsed = resolved.slide

      // null broadcast means the live slide was deleted — blank the projection
      if (parsed === null) {
        mostUpdatedLiveSlide.value = null
        // Keep the shared store in agreement so a reloading operator window
        // doesn't adopt a stale liveSlideId from this tab via pinia-shared-state.
        if (appStore.currentState.liveSlideId) appStore.setLiveSlide("")
        return
      }

      const updatedSlide = parsed as Slide

      // Mirror the projected slide id into the shared store. The broadcast
      // channel drives the projection, but the operator window derives its
      // live output preview from currentState.liveSlideId — and on reload it
      // re-adopts state from this /live tab. Without this, that value goes
      // stale here and the operator shows "No Live Slide" after a reload.
      if (updatedSlide?.id && appStore.currentState.liveSlideId !== updatedSlide.id) {
        appStore.setLiveSlide(updatedSlide.id)
      }

      // Track slide presentation
      usePosthogCapture("SLIDE_PRESENTED_LIVE", {
        slideType: updatedSlide?.type,
        slideLayout: updatedSlide?.layout,
        slideId: updatedSlide?.id,
      })

      // For media-bearing slides, swap in a local object URL so the projection
      // never depends on the operator tab's blob: URL (which dies when that tab
      // closes). Use the cached localized URL when we've already resolved this
      // source; otherwise rehydrate asynchronously below.
      let pendingRehydrateSig: string | null = null
      if (slideNeedsLocalMedia(updatedSlide)) {
        const sig = mediaSignature(updatedSlide)
        const cached = localizedLiveMedia.get(sig)
        if (cached) {
          applyLocalizedMedia(updatedSlide, cached)
        } else {
          pendingRehydrateSig = sig
        }
      }

      // Check if this is just a content update within the same slide
      const isSameSlide = mostUpdatedLiveSlide.value?.id === updatedSlide.id

      if (isSameSlide) {
        // For same-slide updates (verse changes), update immediately without requestAnimationFrame
        // This prevents jitter when moving between verses
        mostUpdatedLiveSlide.value = updatedSlide
      } else {
        // For different slides, use requestAnimationFrame to batch visual updates
        requestAnimationFrame(() => {
          mostUpdatedLiveSlide.value = updatedSlide
        })
      }

      // First time we've seen this media source: ensure a local copy exists in
      // this window (download once if needed), then re-apply with the local URL.
      if (pendingRehydrateSig) {
        const sig = pendingRehydrateSig
        rehydrateSlideMedia(updatedSlide, { allowDownload: true })
          .then((rehydrated) => {
            const localized: LocalizedMedia = {
              background: rehydrated.background,
              dataUrl: (rehydrated.data as any)?.url,
              presentationObjects: rehydrated.presentationObjects,
            }
            localizedLiveMedia.set(sig, localized)
            // Re-apply onto whatever is on screen now rather than adopting
            // `rehydrated` wholesale — the operator may have paged ahead while
            // the download ran, and that newer page index must win.
            const current = mostUpdatedLiveSlide.value
            if (current?.id === rehydrated.id) {
              const next = { ...current }
              applyLocalizedMedia(next, localized)
              mostUpdatedLiveSlide.value = next
            }
          })
          .catch((err) =>
            console.warn("Live media rehydrate failed:", err)
          )
      }
    } catch (error) {
      console.error("Failed to parse broadcast message:", error)
    }
  })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    stopRestoreWatch()
    cleanupBroadcast()
  })
})

onBeforeUnmount(() => {
  const urls = new Set<string>()
  localizedLiveMedia.forEach((media) => {
    if (media.background) urls.add(media.background)
    if (media.dataUrl) urls.add(media.dataUrl)
    media.presentationObjects?.forEach((page) => {
      if (page.imageUrl) urls.add(page.imageUrl)
    })
  })
  urls.forEach((url) => localMedia.releasePlaybackUrl(url))
  localizedLiveMedia.clear()
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>

<style>
body {
  overflow: hidden;
}
</style>
