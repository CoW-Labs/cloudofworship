<template>
  <div
    class="stage-page relative flex h-[100vh] max-h-[100vh] flex-col overflow-hidden bg-black"
    @dblclick="toggleFullScreen"
    @contextmenu.prevent="windowMenuRef?.open()"
  >
    <!-- WINDOW ACTIONS — hidden until the mouse is on this screen, so nothing
         sits over the stage display while the band is reading it. -->
    <div
      class="window-actions absolute right-3 top-3 z-20"
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
      v-if="!isFullScreen && !isTauri"
      floating
      label="Stage Display"
      :active="!!liveSlide"
      hint="anywhere to go full screen and hide this bar"
      @fullscreen="toggleFullScreen"
    />

    <StageBoard
      :now="nowView"
      :next="nextView"
      :clear-banner="!isFullScreen && !isTauri"
    >
      <template #timer>
        <StageTimerPanel
          :slide="liveSlide"
          :slide-position="slidePosition"
          :slide-count="slideCount"
          class="min-h-0"
        />
      </template>
    </StageBoard>
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
import { stageNextView, stageNowView } from "~/utils/stageView"

definePageMeta({
  layout: "stage",
})

// Same late-plan re-check as `/mobile`: the middleware gate only fires once the
// church has loaded, so this moves a Starter church to the upgrade wall when
// the plan lands after the route has resolved.
const { isTeamsPlan, isPlanKnown, isPaywallEnabled } = useSubscription()
watch(
  [isTeamsPlan, isPlanKnown, isPaywallEnabled],
  ([isTeams, planKnown, paywallEnabled]) => {
    if (planKnown && !isTeams && paywallEnabled) navigateTo("/stage-upgrade")
  },
  { immediate: true }
)

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)
const { isTauri } = useTauri()

const liveSlide = ref<Slide | null>(null)
const windowMenuOpen = ref(false)
const windowMenuRef = ref<{ open: () => void; close: () => void } | null>(null)
const { closeWindow } = useCloseDisplayWindow("stage display")
const isFullScreen = ref(false)
const lastBroadcastTs = ref(0)

// ── What is on screen now ──────────────────────────────────────────────────
const nowView = computed(() => stageNowView(liveSlide.value))

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

const nextView = computed(() => stageNextView(liveSlide.value, nextContent.value))

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
const nowLabel = computed(() => nowView.value.label)

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

let cleanupShortcut: (() => void) | null = null

onMounted(() => {
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
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  window.removeEventListener("mozfullscreenchange", checkFullScreen)
  window.removeEventListener("MSFullscreenChange", checkFullScreen)
})
</script>

<style scoped>
.window-actions {
  visibility: hidden;
  opacity: 0;
  transition: 0.3s;
}

.stage-page:hover .window-actions,
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
