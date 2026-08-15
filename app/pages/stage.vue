<template>
  <div
    class="stage-page flex h-[100vh] max-h-[100vh] flex-col overflow-hidden bg-black"
    @dblclick="toggleFullScreen"
  >
    <div
      v-if="!isFullScreen && !isTauri"
      class="banner flex h-[52px] shrink-0 items-center justify-center bg-primary-100 bg-opacity-70 text-center text-black"
    >
      <div class="banner-text flex items-center gap-6 text-base">
        <span
          ><span class="font-bold">Double click</span> anywhere to go full
          screen — this is the stage display</span
        >
        •
        <span class="flex items-center gap-2 font-bold"
          ><Logo class="mb-2 w-[34px]" /> Cloud of Worship</span
        >
      </div>
    </div>

    <main
      class="grid min-h-0 flex-1 gap-4 p-4 sm:gap-6 sm:p-6"
      :class="
        stackedLayout
          ? 'grid-cols-1 grid-rows-[1fr_1fr_auto_auto]'
          : 'grid-cols-2 grid-rows-[1fr_minmax(110px,0.3fr)]'
      "
    >
      <StagePanel label="Now" tone="now" class="min-h-0">
        <template v-if="nowLabel" #header>
          <p
            class="line-clamp-2 text-[clamp(1.75rem,4.5vh,3rem)] font-bold uppercase leading-tight tracking-[0.06em] text-white/70"
          >
            {{ nowLabel }}
          </p>
        </template>

        <StageAutoText v-if="nowText" :text="nowText" />
        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-3 text-center text-white/40"
        >
          <UIcon :name="placeholderIcon" class="h-10 w-10" dynamic />
          <p class="text-xl font-semibold">{{ nowPlaceholder }}</p>
        </div>
      </StagePanel>

      <StagePanel label="Next" tone="next" class="min-h-0">
        <template v-if="nextLabel" #header>
          <p
            class="line-clamp-2 text-[clamp(1.75rem,4.5vh,3rem)] font-bold uppercase leading-tight tracking-[0.06em] text-purple-300/90"
          >
            {{ nextLabel }}
          </p>
        </template>

        <StageAutoText v-if="nextText" :text="nextText" />
        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-3 text-center text-purple-300/40"
        >
          <UIcon :name="nextPlaceholderIcon" class="h-10 w-10" dynamic />
          <p class="text-xl font-semibold">{{ nextPlaceholder }}</p>
        </div>
      </StagePanel>

      <StageTimerPanel
        :slide="liveSlide"
        :slide-position="slidePosition"
        :slide-count="slideCount"
        class="min-h-0"
      />
      <StageClockPanel class="min-h-0" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"
import type {
  LiveBroadcastEnvelope,
  SlideOverlayBroadcast,
} from "~/composables/useBroadcastPost"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"
import { slideToPlainLabel, slideToPlainText } from "~/utils/slideText"

definePageMeta({
  layout: "stage",
})

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const { isTauri } = useTauri()

const liveSlide = ref<Slide | null>(null)
const isFullScreen = ref(false)
const lastBroadcastTs = ref(0)
const viewportWidth = ref(1280)

// The stage screen is often a TV in portrait or a tablet on a music stand;
// below this the four panels stack instead of sitting two-up.
const stackedLayout = computed(() => viewportWidth.value < 900)

// ── What is on screen now ──────────────────────────────────────────────────
const nowText = computed(() => slideToPlainText(liveSlide.value))

const nowPlaceholder = computed(() => {
  if (!liveSlide.value) return "Nothing is live yet"
  if (liveSlide.value.type === slideTypes.media) return "Media is playing"
  if (liveSlide.value.type === slideTypes.presentation) {
    const pages = liveSlide.value.presentationObjects?.length || 0
    const page = (liveSlide.value.presentationPageIndex ?? 0) + 1
    return pages ? `Presentation — page ${page} of ${pages}` : "Presentation"
  }
  return liveSlide.value.name || "Nothing is live yet"
})

const placeholderIcon = computed(() => {
  if (liveSlide.value?.type === slideTypes.media) return "i-bx-play-circle"
  if (liveSlide.value?.type === slideTypes.presentation) return "i-bx-slideshow"
  return "i-bx-tv"
})

// ── What is coming next ────────────────────────────────────────────────────
// `scheduleSlides` is the open schedule's slides only — `activeSlides` spans
// every schedule loaded this session. Shared from the composable so the filter
// runs once for the whole page.
const { nextContent, scheduleSlides } = useStageNextContent(liveSlide)

const nextText = computed(() => nextContent.value?.text || "")

const nextLabel = computed(() => {
  const next = nextContent.value
  if (!next) return ""
  // A new slide is a bigger jump than the next verse of what is already up, so
  // name it — "Up next: Hymn 24" reads very differently to "Verse 3".
  if (next.source === "slide") return `Up next • ${next.slideName}`
  return [next.slideName, next.label].filter(Boolean).join(" • ")
})

// Slides with no words of their own — media, presentation pages — still have
// something worth naming, so fall back to their label rather than claiming the
// schedule has ended.
const nextPlaceholder = computed(() => {
  if (!liveSlide.value) return "Waiting for the operator"
  const next = nextContent.value
  if (!next) return "End of schedule"
  return next.label || next.slideName || "End of schedule"
})

const nextPlaceholderIcon = computed(() =>
  nextContent.value ? "i-bx-slideshow" : "i-bx-check-circle"
)

// ── Schedule position, shown alongside the timer ────────────────────────────
// "Slide 4 of 12" has to count today's service, not every slide the session
// has ever loaded, so both read the schedule-scoped list. A live slide from
// another schedule finds no index and reports 0, which the timer panel already
// treats as "no position to show".
const slideCount = computed(() => scheduleSlides.value.length)
const slidePosition = computed(() => {
  if (!liveSlide.value) return 0
  const index = scheduleSlides.value.findIndex(
    (slide) => slide.id === liveSlide.value?.id
  )
  return index === -1 ? 0 : index + 1
})

// Surfaced through the document title so an operator can tell stage windows
// apart in a taskbar full of browser windows.
const nowLabel = computed(() => slideToPlainLabel(liveSlide.value))

useHead({
  title: computed(() =>
    nowLabel.value
      ? `${nowLabel.value} • Stage Display`
      : "Stage Display - Cloud of Worship"
  ),
  meta: [
    {
      name: "description",
      content:
        "Confidence monitor for worship teams and speakers — shows the lyrics or verse on screen now, what is coming next, a timer and the clock.",
    },
    { property: "og:title", content: "Stage Display - Cloud of Worship" },
    { name: "robots", content: "noindex" },
  ],
  link: [
    { rel: "stylesheet", href: "/css/fonts.css" },
    { rel: "stylesheet", href: "/css/main.css" },
  ],
})

// ── Live slide feed ────────────────────────────────────────────────────────
// Adopt whatever is already live when this window opens, and keep following
// the shared store — pinia-shared-state mirrors `liveSlideId` from the
// operator window, which covers slide changes made before this page loaded.
const adoptFromStore = () => {
  const liveId = currentState.value.liveSlideId
  if (!liveId) {
    liveSlide.value = null
    return
  }
  if (liveSlide.value?.id === liveId) return
  // Deliberately searches every loaded slide rather than the open schedule:
  // going live from one service and then opening another to prepare is normal,
  // and the projector still shows the first one. Scoping this would blank the
  // stage while something is genuinely on screen. Only the schedule-derived
  // panels (NEXT, slide position) are filtered.
  liveSlide.value =
    (currentState.value.activeSlides || []).find(
      (slide) => slide.id === liveId
    ) || null
}

watch(
  [() => currentState.value.liveSlideId, () => currentState.value.activeSlides],
  adoptFromStore,
  { immediate: true }
)

// The broadcast carries the *projected* version of the slide (current verse,
// current hymn chunk, ticking countdown), so it wins over the stored copy.
const cleanupBroadcast = useBroadcastMessage((data) => {
  try {
    const envelope = (typeof data === "string" ? JSON.parse(data) : data) as
      | LiveBroadcastEnvelope<Slide | null | string | SlideOverlayBroadcast>
      | undefined
    if (!envelope || typeof envelope.ts !== "number") return

    const payload =
      typeof envelope.payload === "string"
        ? JSON.parse(envelope.payload)
        : envelope.payload

    // Overlays (alerts, lower thirds) don't change what the stage sees
    if (
      payload?.action === appWideActions.showSlideOverlay ||
      payload?.action === appWideActions.removeSlideOverlay
    ) {
      return
    }

    // Drop messages that arrive out of order
    if (envelope.ts < lastBroadcastTs.value) return
    lastBroadcastTs.value = envelope.ts

    liveSlide.value = (payload as Slide | null) ?? null
  } catch (error) {
    console.error("Stage display failed to parse broadcast message:", error)
  }
})

// ── Full screen ────────────────────────────────────────────────────────────
const checkFullScreen = () => {
  isFullScreen.value = Boolean(document.fullscreenElement)
}

const toggleFullScreen = () => {
  if (document.fullscreenElement) {
    exitFullscreenSafely()
  } else {
    requestFullscreenSafely(document.documentElement)
  }
}

const onResize = () => {
  viewportWidth.value = window.innerWidth
}

let cleanupShortcut: (() => void) | null = null

onMounted(() => {
  onResize()
  window.addEventListener("resize", onResize)
  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  window.addEventListener("mozfullscreenchange", checkFullScreen)
  window.addEventListener("MSFullscreenChange", checkFullScreen)
  checkFullScreen()

  cleanupShortcut = useCreateShortcut("f", toggleFullScreen)
})

onBeforeUnmount(() => {
  cleanupBroadcast()
  cleanupShortcut?.()
  window.removeEventListener("resize", onResize)
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>
