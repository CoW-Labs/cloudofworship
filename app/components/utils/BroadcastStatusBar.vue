<template>
  <Transition name="broadcast-bar" :css="!settings.reduceEffects">
    <div
      v-if="showStream || showNdi"
      class="flex shrink-0 items-center gap-6 overflow-x-auto border-t border-gray-200 bg-white px-4 py-2 text-xs dark:border-white/10 dark:bg-[#131a27]"
    >
      <div v-if="showStream" class="flex shrink-0 items-center gap-4">
        <span class="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
          <span class="h-2 w-2 rounded-full" :class="streamHealth.dot" />
          {{ streamHealth.label }}
        </span>
        <span class="text-gray-500 dark:text-[#9aa3b2]">
          {{ streamStats ? formatKbps(streamStats.bitrateKbps) : "—" }}
          <span v-if="streamStats" class="text-gray-400 dark:text-[#6b7280]">
            / {{ formatKbps(streamStats.targetKbps) }} target
          </span>
        </span>
        <span class="text-gray-500 dark:text-[#9aa3b2]">
          {{ streamStats ? Math.round(streamStats.fps) : "—" }} fps
        </span>
        <span
          class="text-gray-500 dark:text-[#9aa3b2]"
          :class="{ 'text-amber-600 dark:text-amber-400': (streamStats?.delayedPercent ?? 0) > 2 }"
        >
          {{ streamStats?.framesDelayed ?? 0 }} delayed ({{ (streamStats?.delayedPercent ?? 0).toFixed(1) }}%)
        </span>
        <span class="flex items-center gap-1.5 text-gray-500 dark:text-[#9aa3b2]">
          Audio
          <span
            v-if="streamStats?.audioDb === null || streamStats?.audioDb === undefined || streamStats.audioDb <= SILENT_DB"
            class="text-gray-900 dark:text-white"
          >
            No sound
          </span>
          <span v-else class="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <span
              class="block h-full rounded-full transition-[width] duration-300"
              :class="streamStats.audioDb > -6 ? 'bg-red-500' : 'bg-green-500'"
              :style="{ width: `${audioPercent}%` }"
            />
          </span>
        </span>
      </div>

      <div v-if="showStream && showNdi" class="h-4 w-px shrink-0 bg-gray-200 dark:bg-white/10" />

      <div v-if="showNdi" class="flex shrink-0 items-center gap-4">
        <span class="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
          <span class="h-2 w-2 rounded-full" :class="ndiPhaseDotClass" />
          NDI {{ ndiPhaseLabel }}
        </span>
        <span class="text-gray-500 dark:text-[#9aa3b2]">{{ ndiResolution }}</span>
        <span class="text-gray-500 dark:text-[#9aa3b2]">
          {{ ndiStatus.connectionCount }} receiver{{ ndiStatus.connectionCount === 1 ? "" : "s" }}
        </span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// Compact, always-visible digest of the two broadcast composables' state,
// shown at the bottom of the Control Center so an operator can see stream
// health without opening Settings. Mirrors the health/formatting logic in
// StreamStats.vue and DisplaySettings.vue's NDI card, just laid out
// as a single-line strip instead of a popover/settings panel.
const { isTauri } = useTauri()
const { settings } = usePerformanceSettings()
const { isStreaming, stats: streamStats, status: streamStatus } = useStreamOutput()
const { status: ndiStatus } = useNdiBroadcast()

const showStream = computed(() => isTauri && isStreaming.value)
const showNdi = computed(
  () => isTauri && ["starting", "broadcasting"].includes(ndiStatus.value.phase)
)

const SILENT_DB = -60
const SETTLE_SECS = 5
const MIN_HEALTHY_FPS = 25
const MAX_HEALTHY_DELAYED_PERCENT = 2

const streamHealth = computed(() => {
  if (streamStatus.value.phase === "reconnecting") {
    return { label: "Reconnecting", dot: "bg-amber-500 animate-pulse" }
  }
  const current = streamStats.value
  if (current && current.uptimeSecs > SETTLE_SECS) {
    if (current.fps < MIN_HEALTHY_FPS || current.delayedPercent > MAX_HEALTHY_DELAYED_PERCENT) {
      return { label: "Struggling", dot: "bg-amber-500" }
    }
  }
  return { label: "Live", dot: "bg-green-500" }
})

const audioPercent = computed(() => {
  const db = streamStats.value?.audioDb
  if (db === null || db === undefined) return 0
  return Math.round(Math.min(1, Math.max(0, (db - SILENT_DB) / -SILENT_DB)) * 100)
})

const formatKbps = (kbps: number) =>
  kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`

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
