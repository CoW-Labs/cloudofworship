<template>
  <!-- The server refused this schedule: nothing will ever arrive, so say why
       rather than leave the band looking at a screen waiting for an operator. -->
  <LivestreamUnavailable
    v-if="tierRestricted"
    title="This stage display isn't active"
  />
  <div
    v-else
    class="stage-page relative flex h-[100vh] max-h-[100vh] flex-col overflow-hidden bg-black"
    @dblclick="toggleFullScreen"
  >
    <DisplayWindowBanner
      v-if="!isFullScreen"
      floating
      label="Stage Display"
      :active="state.isLive"
      hint="anywhere to go full screen and hide this bar"
      @fullscreen="toggleFullScreen"
    />

    <StageBoard
      :now="state.now"
      :next="state.next"
      :clear-banner="!isFullScreen"
    >
      <template #timer>
        <StageTimerPanel
          :stream="clock"
          :slide-position="state.position"
          :slide-count="state.count"
          class="min-h-0"
        />
      </template>
    </StageBoard>

    <DisplayConnectionStatus
      :status="connectionStatus"
      :below-banner="!isFullScreen"
    />
  </div>
</template>

<script setup lang="ts">
import {
  emptyStageStreamState,
  isStageStreamState,
  stageStreamClockOffset,
  type StageStreamClock,
  type StageStreamState,
} from "~/utils/stageStream"
import {
  exitFullscreenSafely,
  requestFullscreenSafely,
} from "~/utils/browserSafety"

/**
 * The stage display over the network — for the band's phone, a tablet on a
 * music stand, or a TV that is nowhere near the operator's computer.
 *
 * `/stage` reads the operator's own browser state, so it only works on a second
 * window of the same machine. This page has none of that: it is opened from a
 * link with nothing but a schedule id, and draws exactly what the console that
 * is running the service sends it (see useStageStreamFeed). It never sees a
 * slide, only NOW, NEXT, the position and the clocks.
 *
 * Teams-gated on the server, the same way as /livestream.
 */
definePageMeta({
  layout: "stage",
})

const route = useRoute()
const scheduleId = route.params.schedule_id as string

const state = shallowRef<StageStreamState>(emptyStageStreamState())
const offsetMs = ref(0)
const tierRestricted = ref(false)
const isFullScreen = ref(false)
const connectionStatus = ref<
  "connecting" | "connected" | "disconnected" | "failed"
>("connecting")

const clock = computed<StageStreamClock>(() => ({
  timer: state.value.timer,
  countdown: state.value.countdown,
  slideName: state.value.slideName,
  sentAt: state.value.sentAt,
  offsetMs: offsetMs.value,
}))

useHead({
  title: computed(() =>
    state.value.now.label
      ? `${state.value.now.label} • Stage Display`
      : "Stage Display - Cloud of Worship"
  ),
  meta: [{ name: "robots", content: "noindex" }],
})

// ── Stage feed ─────────────────────────────────────────────────────────────
const socketManager = useSocketIO({
  scheduleId,
  // Names this page to the server: it is refused unless the church is on
  // Teams, and it is put in a room that only ever receives the stage state.
  client: "stagestream",
  maxRetries: 30,
  baseRetryDelay: 1000,
  maxRetryDelay: 30000,
  connectionTimeout: 10000,
  onMessage: (event, message) => {
    if (event !== "stage-state" || !isStageStreamState(message?.data)) return
    offsetMs.value = stageStreamClockOffset(message.data)
    state.value = message.data
  },
  onTierRestricted: () => {
    tierRestricted.value = true
    // A refused socket never reports a connection problem, so clear the
    // reconnecting chip that would otherwise sit over the wall.
    connectionStatus.value = "connected"
    usePosthogCapture("STAGESTREAM_TIER_RESTRICTED", { scheduleId })
  },
  onConnected: () => {
    connectionStatus.value = "connected"
  },
  onDisconnected: () => {
    connectionStatus.value = "disconnected"
  },
  onError: () => {
    connectionStatus.value = "disconnected"
  },
  onMaxRetriesReached: () => {
    connectionStatus.value = "failed"
  },
})

watch(
  () => socketManager.isConnectedRef?.value,
  (isConnected) => {
    if (isConnected) connectionStatus.value = "connected"
    else if (socketManager.isReconnecting?.value) {
      connectionStatus.value = "disconnected"
    }
  }
)

// ── Keep the screen awake ──────────────────────────────────────────────────
// A phone or tablet left on a music stand dims and locks within a minute or
// two. The lock is dropped whenever the page is hidden, so take it again each
// time it comes back.
let wakeLock: WakeLockSentinel | null = null

const requestWakeLock = async () => {
  if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) {
    return
  }
  try {
    wakeLock = await navigator.wakeLock.request("screen")
  } catch {
    // Refused (battery saver, an iframe without permission). The screen may
    // sleep, which is no worse than a browser without the API at all.
  }
}

const onVisibilityChange = () => {
  if (document.visibilityState === "visible") void requestWakeLock()
}

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
  socketManager.connect()

  window.addEventListener("fullscreenchange", checkFullScreen)
  window.addEventListener("webkitfullscreenchange", checkFullScreen)
  document.addEventListener("visibilitychange", onVisibilityChange)
  checkFullScreen()
  void requestWakeLock()

  cleanupShortcut = useRegisteredShortcut(shortcutIds.fullscreen, toggleFullScreen)
})

onBeforeUnmount(() => {
  socketManager.disconnect()
  cleanupShortcut?.()
  void wakeLock?.release().catch(() => {})
  wakeLock = null
  window.removeEventListener("fullscreenchange", checkFullScreen)
  window.removeEventListener("webkitfullscreenchange", checkFullScreen)
  document.removeEventListener("visibilitychange", onVisibilityChange)
})
</script>
