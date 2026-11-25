<template>
  <Transition name="broadcast-bar" :css="!settings.reduceEffects">
    <div
      v-if="showStream || showNdi"
      class="flex shrink-0 items-center gap-4 border-t border-gray-200 bg-white py-2 pl-4 pr-[4.5rem] text-xs [--bar-bg:#ffffff] dark:border-white/10 dark:bg-[#131a27] dark:[--bar-bg:#131a27]"
    >
      <!-- Only the readouts scroll, and fade at whichever edge has more past it.
           The mixer stays put on the right. -->
      <div class="relative min-w-0 flex-1">
        <div
          ref="scrollStrip"
          class="cow-scroll-strip cow-scroll-strip--bare overflow-x-auto"
        >
          <div class="flex w-max items-center gap-6">
            <div v-if="showStream" class="flex shrink-0 items-center gap-3">
              <span class="flex w-[5.25rem] items-center gap-1.5 whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                <span class="h-2 w-2 shrink-0 rounded-full" :class="streamHealth.dot" />
                {{ streamHealth.label }}
              </span>
              <span
                v-if="isRecording && !isRecordOnly"
                class="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-red-600 dark:text-red-400"
                title="Saving a copy of this stream on this computer"
              >
                <span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
                REC
              </span>
              <span
                v-if="liveWindowHidden"
                class="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-amber-600 dark:text-amber-400"
                title="The live window is on another desktop, so macOS stops painting it and the video freezes. Put it on a second screen or stay on its desktop."
              >
                <Icon name="i-ph-warning" class="h-3.5 w-3.5 shrink-0" />
                Live window hidden: video frozen
              </span>
              <!-- Only the number boxes have a fixed width, so the words next to
                   them sit snug and nothing moves sideways as values change. -->
              <span class="whitespace-nowrap text-gray-500 dark:text-[#9aa3b2]">
                <template v-if="streamStats">
                  <span class="inline-block w-[4.6ch] tabular-nums">{{ kbpsParts(streamStats.bitrateKbps).value }}</span>{{ kbpsParts(streamStats.bitrateKbps).unit }}
                  <template v-if="!isRecordOnly">
                    <span class="text-gray-400 dark:text-[#6b7280]">/ {{ formatKbps(streamStats.targetKbps) }} target</span>
                  </template>
                </template>
                <template v-else>—</template>
              </span>
              <span class="whitespace-nowrap text-gray-500 dark:text-[#9aa3b2]">
                <span class="inline-block w-[2ch] text-right tabular-nums">{{ streamStats ? Math.round(streamStats.fps) : "—" }}</span> fps
              </span>
              <span
                class="whitespace-nowrap text-gray-500 dark:text-[#9aa3b2]"
                :class="{ 'text-amber-600 dark:text-amber-400': (streamStats?.delayedPercent ?? 0) > 2 }"
              >
                <span class="inline-block min-w-[2ch] text-right tabular-nums">{{ streamStats?.framesDelayed ?? 0 }}</span> delayed (<span class="inline-block w-[3ch] text-right tabular-nums">{{ (streamStats?.delayedPercent ?? 0).toFixed(1) }}</span>%)
              </span>
              <span class="flex w-[5.75rem] items-center gap-1.5 whitespace-nowrap text-gray-500 dark:text-[#9aa3b2]">
                Audio
                <span
                  v-if="streamStats?.audioDb === null || streamStats?.audioDb === undefined || streamStats.audioDb <= SILENT_DB"
                  class="text-gray-900 dark:text-white"
                >
                  No sound
                </span>
                <span v-else class="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <span
                    class="block h-full w-full origin-left rounded-full transition-transform duration-300"
                    :class="streamStats.audioDb > -6 ? 'bg-red-500' : 'bg-green-500'"
                    :style="{ transform: `scaleX(${audioPercent / 100})` }"
                  />
                </span>
              </span>
            </div>

            <div v-if="showStream && showNdi" class="h-4 w-px shrink-0 bg-gray-200 dark:bg-white/10" />

            <div v-if="showNdi" class="flex shrink-0 items-center gap-3">
              <span class="flex w-[10.25rem] items-center gap-1.5 whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                <span class="h-2 w-2 shrink-0 rounded-full" :class="ndiPhaseDotClass" />
                <span class="truncate">NDI {{ ndiPhaseLabel }}</span>
              </span>
              <span class="w-[7.75rem] truncate tabular-nums text-gray-500 dark:text-[#9aa3b2]">{{ ndiResolution }}</span>
              <span class="w-[4.4rem] whitespace-nowrap tabular-nums text-gray-500 dark:text-[#9aa3b2]">
                {{ ndiStatus.connectionCount }} receiver{{ ndiStatus.connectionCount === 1 ? "" : "s" }}
              </span>
            </div>
          </div>
        </div>
        <CowScrollFade :start="fadeStart" :end="fadeEnd" color="var(--bar-bg)" />
      </div>

      <template v-if="showMixer">
        <div class="h-4 w-px shrink-0 bg-gray-200 dark:bg-white/10" />
        <CoWPopover
          v-model:open="mixerOpen"
          placement="top"
          :boundary="boundary"
          :max-width="320"
          :max-height="480"
          class="shrink-0"
        >
          <CowButton variant="secondary" size="2xs" class="!px-3 !py-1 text-xs" aria-label="Open the audio mixer">
            <Icon name="i-ph-faders" class="h-3.5 w-3.5" />
            Mixer
          </CowButton>
          <template #panel>
            <div class="p-4">
              <AudioMixerPanel />
            </div>
          </template>
        </CoWPopover>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// Compact, always-visible digest of the two broadcast composables' state,
// shown at the bottom of the Control Center so an operator can see stream
// health without opening Settings. Mirrors the health/formatting logic in
// StreamStats.vue and DisplaySettings.vue's NDI card, just laid out
// as a single-line strip instead of a popover/settings panel.
import { useAudioMixer } from "~/composables/useAudioMixer"
import useScrollEdgeFade from "~/composables/useScrollEdgeFade"

const { isTauri } = useTauri()
const { settings } = usePerformanceSettings()
const { isStreaming, isRecording, isRecordOnly, stats: streamStats, status: streamStatus } = useStreamOutput()
// The readouts scroll when the window is narrow; their edges fade like the
// editor toolbars do.
const scrollStrip = ref<HTMLElement | null>(null)
const { start: fadeStart, end: fadeEnd } = useScrollEdgeFade(scrollStrip)
const { status: ndiStatus } = useNdiBroadcast()

const showStream = computed(() => isTauri && isStreaming.value)

// A live window on another desktop is not painted by macOS, so the stream and
// the recording freeze. Ask every few seconds while a session runs, and say so.
const liveWindowHidden = ref(false)
const checkLiveWindow = async () => {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    const visible = await invoke<boolean | null>("stream_live_window_visible")
    liveWindowHidden.value = visible === false
  } catch {
    liveWindowHidden.value = false
  }
}
let liveWindowTimer: ReturnType<typeof setInterval> | undefined
watch(
  showStream,
  (streaming) => {
    clearInterval(liveWindowTimer)
    liveWindowHidden.value = false
    if (!streaming) return
    void checkLiveWindow()
    liveWindowTimer = setInterval(checkLiveWindow, 3000)
  },
  { immediate: true }
)
onBeforeUnmount(() => clearInterval(liveWindowTimer))
// The mixer only exists while a stream runs, and only where the desktop app
// has one (macOS for now); `active` comes from the app itself.
const mixerState = useAudioMixer()
const mixerOpen = ref(false)
// The popover opens upward from the bar and is kept inside the window.
const boundary = ref<HTMLElement | null>(null)
onMounted(() => {
  boundary.value = document.body
})
const showMixer = computed(() => showStream.value && mixerState.state.value.active)
watch(
  showStream,
  (streaming) => {
    if (streaming) void mixerState.refresh()
  },
  { immediate: true }
)

const showNdi = computed(
  () => isTauri && ["starting", "broadcasting"].includes(ndiStatus.value.phase)
)

const SILENT_DB = -60
const SETTLE_SECS = 5
const MIN_HEALTHY_FPS = 25
const MAX_HEALTHY_DELAYED_PERCENT = 2

const streamHealth = computed(() => {
  if (streamStatus.value.phase === "reconnecting") {
    return { label: "Retrying", dot: "bg-amber-500 animate-pulse" }
  }
  const current = streamStats.value
  if (current && current.uptimeSecs > SETTLE_SECS) {
    if (current.fps < MIN_HEALTHY_FPS || current.delayedPercent > MAX_HEALTHY_DELAYED_PERCENT) {
      return { label: "Struggling", dot: "bg-amber-500" }
    }
  }
  return { label: isRecordOnly.value ? "Recording" : "Live", dot: "bg-green-500" }
})

const audioPercent = computed(() => {
  const db = streamStats.value?.audioDb
  if (db === null || db === undefined) return 0
  return Math.round(Math.min(1, Math.max(0, (db - SILENT_DB) / -SILENT_DB)) * 100)
})

const formatKbps = (kbps: number) =>
  kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`

// The number and its unit apart, so only the number needs a fixed box.
const kbpsParts = (kbps: number) =>
  kbps >= 1000
    ? { value: (kbps / 1000).toFixed(1), unit: " Mbps" }
    : { value: String(Math.round(kbps)), unit: " kbps" }

const ndiPhaseLabel = computed(() => {
  if (ndiStatus.value.stalled) return "broadcasting last frame"
  return {
    idle: "not broadcasting",
    starting: "starting",
    broadcasting: "broadcasting",
    error: "needs attention",
    unsupported: "unsupported on this system",
  }[ndiStatus.value.phase]
})

const ndiPhaseDotClass = computed(() => ({
  "bg-gray-400": ndiStatus.value.phase === "idle",
  "bg-amber-500 animate-pulse": ndiStatus.value.phase === "starting",
  "bg-green-500": ndiStatus.value.phase === "broadcasting" && !ndiStatus.value.stalled,
  "bg-amber-500": ndiStatus.value.phase === "broadcasting" && ndiStatus.value.stalled,
  "bg-red-500": ndiStatus.value.phase === "error",
  "bg-gray-500": ndiStatus.value.phase === "unsupported",
}))

const ndiResolution = computed(() =>
  ndiStatus.value.width && ndiStatus.value.height
    ? `${ndiStatus.value.width} x ${ndiStatus.value.height} at ${ndiStatus.value.fps} fps`
    : `Waiting for live output at ${ndiStatus.value.fps} fps`
)
</script>

<style scoped>
/* Slides up from the bottom edge. Only transform and opacity move, so the
   browser animates it on the GPU and never re-lays-out the three panels per
   frame. With Reduce effects on, the script turns the classes off; with the
   system's reduced-motion setting, the media query below does. */
.broadcast-bar-enter-active {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease-out;
}
.broadcast-bar-leave-active {
  transition:
    transform 160ms ease-in,
    opacity 120ms ease-in;
}
.broadcast-bar-enter-from,
.broadcast-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .broadcast-bar-enter-active,
  .broadcast-bar-leave-active {
    transition: none;
  }
}
</style>
