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
import { useAuthStore } from "~/store/auth"
import type { Slide } from "~/types"
import type {
  LiveBroadcastEnvelope,
  LiveSlideChangedNotification,
  SlideOverlayBroadcast,
} from "~/composables/useBroadcastPost"
import { resolveLiveSlideBroadcast } from "~/composables/useBroadcastPost"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"
import { slideToPlainLabel, slideToPlainText } from "~/utils/slideText"

definePageMeta({
  layout: "stage",
})

const appStore = useAppStore()
const authStore = useAuthStore()
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
const indexedScheduleSlides = ref<Slide[]>([])
let scheduleReadGeneration = 0

const hydrateStageSchedule = async (scheduleId?: string) => {
  const requestGeneration = ++scheduleReadGeneration
  if (!scheduleId) {
    indexedScheduleSlides.value = []
    return
  }
  try {
    const storedSlides = await useSlideRepository().getScheduleSlides(scheduleId)
    if (
      requestGeneration === scheduleReadGeneration &&
      currentState.value.activeSchedule?._id === scheduleId
    ) {
      indexedScheduleSlides.value = storedSlides
    }
  } catch (error) {
    if (requestGeneration === scheduleReadGeneration) {
      indexedScheduleSlides.value = []
      console.warn("Unable to hydrate the stage schedule from IndexedDB:", error)
    }
  }
}

watch(
  () => currentState.value.activeSchedule?._id,
  (scheduleId) => void hydrateStageSchedule(scheduleId),
  { immediate: true }
)
const cleanupSlideDatabaseNotifications = useSlideDatabaseNotifications(() =>
  void hydrateStageSchedule(currentState.value.activeSchedule?._id)
)

const { nextContent, scheduleSlides } = useStageNextContent(
  liveSlide,
  indexedScheduleSlides
)

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
// Restore the projected snapshot by its lightweight shared live slide id.
let restoreGeneration = 0
const restoreProjectedSlide = async (liveId: string | null) => {
  const requestGeneration = ++restoreGeneration
  if (!liveId) {
    liveSlide.value = null
    return
  }
  const record = await useLiveProjectionRepository().getCurrent()
  if (
    requestGeneration === restoreGeneration &&
    isRestorableLiveProjection(record, {
      expectedSlideId: liveId,
      churchId: authStore.user?.churchId,
    })
  ) {
    lastBroadcastTs.value = Math.max(lastBroadcastTs.value, record!.updatedAt)
    liveSlide.value = record!.slide
  }
}

watch(
  () => currentState.value.liveSlideId,
  (liveId) => {
    void restoreProjectedSlide(liveId).catch((error) =>
      console.warn("Unable to restore the stage projection from IndexedDB:", error)
    )
  },
  { immediate: true }
)

// The broadcast carries the *projected* version of the slide (current verse,
// current hymn chunk, ticking countdown), so it wins over the stored copy.
const cleanupBroadcast = useBroadcastMessage(async (data) => {
  try {
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

    // Overlays (alerts, lower thirds) don't change what the stage sees
    if (
      payload?.action === appWideActions.showSlideOverlay ||
      payload?.action === appWideActions.removeSlideOverlay
    ) {
      return
    }

    // Drop messages that arrive out of order
    if (envelope.ts < lastBroadcastTs.value) return

    const resolved = await resolveLiveSlideBroadcast(payload)
    if (!resolved.matched || envelope.ts < lastBroadcastTs.value) return
    lastBroadcastTs.value = envelope.ts
    liveSlide.value = resolved.slide
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

  cleanupShortcut = useRegisteredShortcut(shortcutIds.fullscreen, toggleFullScreen)
})

onBeforeUnmount(() => {
  cleanupBroadcast()
  cleanupSlideDatabaseNotifications()
  cleanupShortcut?.()
  window.removeEventListener("resize", onResize)
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>
