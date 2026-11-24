<template>
  <div
    class="main relative max-h-[100vh] overflow-hidden bg-black min-h-[100vh]"
    :id="currentState.liveSlideId?.toString()"
    @contextmenu.prevent="!isTauri && windowMenuRef?.open()"
  >
    <!-- Desktop window actions belong to the operator window. Native NDI
         captures every rendered pixel here, including menus and transitions. -->
    <div
      v-if="!isTauri"
      class="window-actions absolute right-3 top-3 z-50"
      :class="{ 'menu-open': windowMenuOpen }"
    >
      <MoreActionsMenu
        ref="windowMenuRef"
        v-slot="{ close }"
        flush
        trigger-class="rounded-full bg-black/40 hover:!bg-black/60"
        icon-class="text-white"
        @update:open="windowMenuOpen = $event"
      >
        <UButton
          variant="ghost"
          color="red"
          block
          class="more-item-danger"
          @click.stop.prevent="
            () => {
              close()
              closeWindow()
            }
          "
        >
          <template #leading><CloseIcon class="w-4 h-4" /></template>
          Close Window
        </UButton>
      </MoreActionsMenu>
    </div>

    <DisplayWindowBanner
      v-if="!isFullScreen"
      floating
      :label="isSlidesOutput ? 'Slides Output' : 'Live Output'"
      :active="!!primarySlide"
      :shortcut="primarySlide ? undefined : ''"
      :hint="
        primarySlide
          ? 'the display to go full screen and hide this bar'
          : 'Select a slide from the schedule to show it here'
      "
      @fullscreen="toggleFullScreen"
    />
    <!-- :content-visible="liveSlide?.id === liveSlideId" -->
    <!-- Using motionless slides to test bug with Bible Slides not moving to next slide in live view -->
    <!-- <Transition class="fade"> -->
    <!-- A pair animates out over whatever replaces it (see LivePairProjection). -->
    <Transition name="cow-pair">
      <LivePairProjection
        v-if="livePairSlides"
        :id="currentState.liveSlideId"
        :slides="livePairSlides"
        :full-screen="true"
        :slide-styles="currentState.settings.slideStyles"
        camera-mode="capture"
      />
    </Transition>
    <!-- A single slide fades out over a pair taking its place, instead of
         cutting to black first. -->
    <Transition name="cow-single">
      <LiveProjectionOnly
        v-if="!livePairSlides"
        :content-visible="true"
        :id="currentState.liveSlideId"
        :full-screen="true"
        :slide="mostUpdatedLiveSlide"
        :slide-label="false"
        :slide-styles="currentState.settings.slideStyles"
        :audio-muted="mostUpdatedLiveSlide?.slideStyle?.isMediaMuted!!"
        :camera-mode="isSlidesOutput ? 'placeholder' : 'capture'"
      />
    </Transition>
    <!-- </Transition> -->

    <AlertView />
  </div>
</template>
<script setup lang="ts">
import { publicStylesheet } from "~/utils/publicStylesheet"
import type { Emitter } from "mitt"
import { useAppStore } from "@/store/app"
import type { LivePayload, Slide } from "~/types"
import type {
  LiveBroadcastEnvelope,
  LiveSlideChangedNotification,
  SlideOverlayBroadcast,
} from "~/composables/useBroadcastPost"
import { resolveLiveSlideBroadcast } from "~/composables/useBroadcastPost"
import {
  continueAsSolo,
  isCameraSlide,
  isPairPayload,
  liveSlideIds,
  pairRoles,
  patchLivePayload,
  primaryLiveSlide,
} from "~/utils/slidePairs"
import useCameraStream, {
  isCameraPrewarmBroadcast,
} from "~/composables/useCameraStream"
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
const windowMenuOpen = ref(false)
const windowMenuRef = ref<{ open: () => void; close: () => void } | null>(null)
const { closeWindow } = useCloseDisplayWindow("live output")
const { prewarm: prewarmCamera } = useCameraStream()
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaRecorderInterval = ref()
const FPS = 10
// What is on screen: one slide, a slide pair's members, or null for blank.
const livePayload = ref<LivePayload>(null)

// `/live?output=slides` is the Slides-only display: the same feed as the live
// output, minus the camera. A camera slide leaves it black, and a pair shows
// only its non-camera member. This window never opens or prewarms a camera, so
// it costs nothing while a camera slide is live, and it leaves the shared store
// and the analytics to the live window, which already does both.
const route = useRoute()
const isSlidesOutput = route.query.output === "slides"

const shownPayload = computed<LivePayload>(() => {
  const payload = livePayload.value
  if (!isSlidesOutput || !payload) return payload
  if (isPairPayload(payload)) {
    const { text } = pairRoles(payload)
    return text && !isCameraSlide(text) ? text : null
  }
  return isCameraSlide(payload) ? null : payload
})
const mostUpdatedLiveSlide = computed<Slide | null>(() =>
  isPairPayload(shownPayload.value) ? null : shownPayload.value
)
const livePairSlides = computed<Slide[] | null>(() =>
  isPairPayload(shownPayload.value) ? shownPayload.value : null
)
/** The live slide, or the pair's active member: what the banner and store follow. */
const primarySlide = computed(() => primaryLiveSlide(livePayload.value))
/** The pair a live payload shows, from its stamp. Null for a single slide. */
const livePairIdOf = (payload: LivePayload | undefined) =>
  isPairPayload(payload) ? payload[0]?.livePair?.pairId ?? null : null
const lastBroadcastTs = ref(0)
const lastOverlayBroadcastTs = ref(0)

// Local-first media for the projection window. blob: URLs are scoped to the
// operator document that created them, so they die when that tab closes/reloads.
// We rehydrate incoming media from THIS window's shared IndexedDB (downloading
// once if needed) and cache the localized URLs per source signature so repeated
// same-slide broadcasts (e.g. verse changes) don't re-download, re-create object
// URLs, or reload the <video>.
const { rehydrateSlideMediaWithStatus } = useSlideMediaCache()
const localMedia = useLocalMediaStorage()
type LocalizedMedia = {
  background?: string
  dataUrl?: string
  presentationObjects?: Slide["presentationObjects"]
}
const localizedLiveMedia = new Map<string, LocalizedMedia>()

// The last copy resolved for each slide, with the media key it was resolved
// for. Once the operator's own copy is saved, its slide carries a session-only
// link that the broadcast blanks, so the same slide arrives with an empty
// background and misses the signature cache above. Without this, every play,
// pause or mute on a live video cleared its source and reloaded it from the
// top (and the reload played it again, undoing a pause).
const lastLocalizedBySlide = new Map<
  string,
  { mediaKey: string; media: LocalizedMedia }
>()
// Both maps above would otherwise grow for the whole service: every new video
// or presentation adds object URLs (and a full page list) that were only freed
// on unmount. Keep the most recently used few and release the rest. Map
// insertion order is the recency order (hits and writes re-insert).
const MAX_LOCALIZED_MEDIA = 12

const urlsOfMedia = (media: LocalizedMedia, into: Set<string>) => {
  if (media.background) into.add(media.background)
  if (media.dataUrl) into.add(media.dataUrl)
  media.presentationObjects?.forEach((page) => {
    if (page.imageUrl) into.add(page.imageUrl)
  })
}

const urlsOnScreen = () => {
  const urls = new Set<string>()
  const current = livePayload.value as Slide | Slide[] | null | undefined
  ;(Array.isArray(current) ? current : [current]).forEach((slide) => {
    if (!slide) return
    if (slide.background) urls.add(slide.background)
    const dataUrl = (slide.data as any)?.url
    if (dataUrl) urls.add(dataUrl)
    slide.presentationObjects?.forEach((page) => {
      if (page.imageUrl) urls.add(page.imageUrl)
    })
  })
  return urls
}

const touchLocalizedMedia = (sig: string, media: LocalizedMedia) => {
  localizedLiveMedia.delete(sig)
  localizedLiveMedia.set(sig, media)
}

const evictLocalizedMedia = () => {
  if (localizedLiveMedia.size <= MAX_LOCALIZED_MEDIA) return
  const protectedUrls = urlsOnScreen()
  const evicted: LocalizedMedia[] = []
  for (const [sig, media] of localizedLiveMedia) {
    if (localizedLiveMedia.size <= MAX_LOCALIZED_MEDIA) break
    const urls = new Set<string>()
    urlsOfMedia(media, urls)
    if ([...urls].some((url) => protectedUrls.has(url))) continue
    localizedLiveMedia.delete(sig)
    evicted.push(media)
  }
  if (!evicted.length) return
  // Drop the per-slide copies that point at an evicted entry.
  for (const [slideId, last] of lastLocalizedBySlide) {
    if (evicted.includes(last.media)) lastLocalizedBySlide.delete(slideId)
  }
  // Release only URLs no surviving entry (or the screen) still uses.
  const keep = urlsOnScreen()
  localizedLiveMedia.forEach((media) => urlsOfMedia(media, keep))
  lastLocalizedBySlide.forEach((last) => urlsOfMedia(last.media, keep))
  const release = new Set<string>()
  evicted.forEach((media) => urlsOfMedia(media, release))
  release.forEach((url) => {
    if (!keep.has(url)) localMedia.releasePlaybackUrl(url)
  })
}

const slideMediaKey = (slide: Slide) =>
  `${slide.backgroundVideoKey ?? ""}|${slide.backgroundImageKey ?? ""}`
const reusableLocalizedMedia = (slide: Slide): LocalizedMedia | null => {
  if (slide.type === slideTypes.presentation || slide.background) return null
  const last = lastLocalizedBySlide.get(slide.id)
  return last?.media.background && last.mediaKey === slideMediaKey(slide)
    ? last.media
    : null
}

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
      href: publicStylesheet("/css/fonts.css"),
    },
    {
      rel: "stylesheet",
      href: publicStylesheet("/css/main.css"),
    },
  ],
})

// On desktop the window itself goes full screen (the browser's own fullscreen
// doesn't apply to it), so that is the state to read and to toggle.
const tauriWindow = async () =>
  (await import("@tauri-apps/api/window")).getCurrentWindow()

const checkFullScreen = async () => {
  if (isTauri) {
    try {
      isFullScreen.value = await (await tauriWindow()).isFullscreen()
    } catch (error) {
      console.warn("Could not read the live window's fullscreen state:", error)
    }
    return
  }
  isFullScreen.value = !!document.fullscreenElement
}

const toggleFullScreen = async () => {
  if (isTauri) {
    try {
      const win = await tauriWindow()
      await win.setFullscreen(!(await win.isFullscreen()))
      await checkFullScreen()
    } catch (error) {
      console.warn("Could not toggle the live window's fullscreen:", error)
    }
    return
  }
  if (document.fullscreenElement) {
    exitFullscreenSafely()
  } else {
    requestFullscreenSafely(document.documentElement)
  }
}

const blockFindShortcut = (event: KeyboardEvent) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "f" || event.key === "F")
  ) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)
  // A desktop window going full screen (or leaving it) resizes the window.
  if (isTauri) window.addEventListener("resize", checkFullScreen)

  // Prevent default action on specific keys
  document.addEventListener("keydown", blockFindShortcut)

  // Shortcut to go full screen
  useRegisteredShortcut(shortcutIds.fullscreen, toggleFullScreen)

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
      livePayload.value = projected.slides?.length
        ? projected.slides
        : projected.slide
      // The operator owns what is live; this window only copies it.
      if (!isSlidesOutput)
        appStore.mirrorLiveProjection(
          projected.slideId || "",
          projected.slideId ? livePairIdOf(projected.slides) : null
        )
      return
    }
    // Never resurrect a schedule slide when the projected record is missing,
    // expired, from another church, or disagrees with the shared live slide id.
    if (!expectedSlideId) livePayload.value = null
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
            | Slide[]
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

      if (isCameraPrewarmBroadcast(payload)) {
        if (!isSlidesOutput) prewarmCamera(payload.data)
        return
      }

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
      const parsed = resolved.payload

      // null broadcast means the live slide was deleted — blank the projection
      if (parsed === null) {
        livePayload.value = null
        // Keep the shared store in agreement so a reloading operator window
        // doesn't adopt a stale liveSlideId from this tab via pinia-shared-state.
        if (!isSlidesOutput) appStore.mirrorLiveProjection("", null)
        return
      }

      // A slide pair arrives as its members' array. Each member is localised
      // on its own, exactly as a single slide is.
      const incoming = isPairPayload(parsed) ? parsed : [parsed as Slide]
      const primary = primaryLiveSlide(parsed)!

      // Mirror the projected slide id into the shared store. The broadcast
      // channel drives the projection, but the operator window derives its
      // live output preview from currentState.liveSlideId — and on reload it
      // re-adopts state from this /live tab. Without this, that value goes
      // stale here and the operator shows "No Live Slide" after a reload.
      // The pair comes from the payload, never from this window's copy of the
      // shared state, which may not have heard of the pair yet. The copy is
      // not sent back (see mirrorLiveProjection).
      if (primary?.id && !isSlidesOutput) {
        appStore.mirrorLiveProjection(primary.id, livePairIdOf(parsed))
      }

      // Track slide presentation
      if (!isSlidesOutput)
        usePosthogCapture("SLIDE_PRESENTED_LIVE", {
          slideType: primary?.type,
          slideLayout: primary?.layout,
          slideId: primary?.id,
          ...(isPairPayload(parsed)
            ? { pairLayout: primary?.livePair?.layout, pairSize: parsed.length }
            : {}),
        })

      // For media-bearing slides, swap in a local object URL so the projection
      // never depends on the operator tab's blob: URL (which dies when that tab
      // closes). Use the cached localized URL when we've already resolved this
      // source; otherwise rehydrate asynchronously below.
      const pendingRehydrate: { slide: Slide; sig: string }[] = []
      incoming.forEach((slide) => {
        if (!slideNeedsLocalMedia(slide)) return
        const sig = mediaSignature(slide)
        const cached = localizedLiveMedia.get(sig) ?? reusableLocalizedMedia(slide)
        if (cached) {
          if (localizedLiveMedia.has(sig)) touchLocalizedMedia(sig, cached)
          applyLocalizedMedia(slide, cached)
        } else {
          pendingRehydrate.push({ slide, sig })
        }
      })

      // Check if this is just a content update within the same slide (or the
      // same pair): same ids in the same order. One of the pair's own slides
      // going on alone carries on in the pair's place (see continueAsSolo),
      // so its video or camera is not rebuilt.
      const stageFor = (current: LivePayload) =>
        isPairPayload(current) && !isPairPayload(parsed)
          ? continueAsSolo(current, parsed as Slide) ?? parsed
          : parsed
      const isSameSlide =
        liveSlideIds(livePayload.value).join("|") ===
        liveSlideIds(stageFor(livePayload.value)).join("|")

      if (isSameSlide) {
        // For same-slide updates (verse changes), update immediately without requestAnimationFrame
        // This prevents jitter when moving between verses
        livePayload.value = stageFor(livePayload.value)
      } else {
        // For different slides, use requestAnimationFrame to batch visual updates
        requestAnimationFrame(() => {
          livePayload.value = stageFor(livePayload.value)
        })
      }

      // First time we've seen this media source: ensure a local copy exists in
      // this window (download once if needed), then re-apply with the local URL.
      pendingRehydrate.forEach(({ slide: updatedSlide, sig }) => {
        // `cacheable` is false while any page/background is still only in the
        // cloud. Caching a half-resolved slide — what a weak connection at
        // service start produces — pinned the broken URLs for the rest of the
        // session: every later broadcast for the same slide hit the cache and
        // skipped the download that would have fixed it, so the operator had to
        // reload the projection window. The retry inside useSlideMediaCache
        // calls back through `onRecovered` once the bytes finally land.
        const applyRehydrated = (rehydrated: Slide, cacheable: boolean) => {
          const localized: LocalizedMedia = {
            background: rehydrated.background,
            dataUrl: (rehydrated.data as any)?.url,
            presentationObjects: rehydrated.presentationObjects,
          }
          if (cacheable) {
            touchLocalizedMedia(sig, localized)
            lastLocalizedBySlide.delete(rehydrated.id)
            lastLocalizedBySlide.set(rehydrated.id, {
              mediaKey: slideMediaKey(rehydrated),
              media: localized,
            })
          }
          // Re-apply onto whatever is on screen now rather than adopting
          // `rehydrated` wholesale — the operator may have paged ahead while
          // the download ran, and that newer page index must win. Inside a
          // pair only the matching member changes.
          const current = livePayload.value
          const onScreen = (isPairPayload(current) ? current : [current]).find(
            (slide) => slide?.id === rehydrated.id
          )
          if (onScreen) {
            const next = { ...onScreen }
            applyLocalizedMedia(next, localized)
            livePayload.value = patchLivePayload(current, next)
          }
          // After the screen holds the new URLs, so those stay protected.
          if (cacheable) evictLocalizedMedia()
        }

        rehydrateSlideMediaWithStatus(updatedSlide, {
          allowDownload: true,
          onRecovered: (recovered) => applyRehydrated(recovered, true),
        })
          .then(({ slide: rehydrated, pendingKeys }) =>
            applyRehydrated(rehydrated, !pendingKeys.length)
          )
          .catch((err) =>
            console.warn("Live media rehydrate failed:", err)
          )
      })
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
  lastLocalizedBySlide.clear()
  document.removeEventListener("keydown", blockFindShortcut)
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
  window.removeEventListener("resize", checkFullScreen)
})
</script>

<style>
body {
  overflow: hidden;
}
</style>

<style scoped>
.window-actions {
  visibility: hidden;
  opacity: 0;
  transition: 0.3s;
}

.main:hover .window-actions,
.window-actions.menu-open {
  visibility: visible;
  opacity: 1;
}

/* Touch screens have no hover state to reveal the menu */
@media (hover: none) {
  .window-actions {
    visibility: visible;
    opacity: 1;
  }
}
</style>
