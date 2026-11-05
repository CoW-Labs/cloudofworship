<template>
  <div class="w-64 text-sm">
    <div class="flex items-center justify-between gap-3">
      <span class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
        <span class="h-2 w-2 rounded-full" :class="health.dot" />
        {{ health.label }}
      </span>
      <span class="tabular-nums text-xs text-gray-500 dark:text-[#9aa3b2]">
        {{ stats ? formatUptime(stats.uptimeSecs) : "" }}
      </span>
    </div>
    <p v-if="health.hint" class="mt-1 text-xs text-gray-500 dark:text-[#9aa3b2]">
      {{ health.hint }}
    </p>

    <dl v-if="stats" class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      <dt class="text-gray-500 dark:text-[#9aa3b2]">Sending</dt>
      <dd class="text-right tabular-nums text-gray-900 dark:text-white">
        {{ formatKbps(stats.bitrateKbps) }}
      </dd>
      <dt class="text-gray-500 dark:text-[#9aa3b2]">Frame rate</dt>
      <dd class="text-right tabular-nums text-gray-900 dark:text-white">
        {{ Math.round(stats.fps) }} fps
      </dd>
      <dt class="text-gray-500 dark:text-[#9aa3b2]">Delayed frames</dt>
      <dd class="text-right tabular-nums text-gray-900 dark:text-white">
        {{ stats.framesDelayed }} ({{ stats.delayedPercent.toFixed(1) }}%)
      </dd>
      <dt class="text-gray-500 dark:text-[#9aa3b2]">Reconnects</dt>
      <dd class="text-right tabular-nums text-gray-900 dark:text-white">
        {{ stats.reconnects }}
      </dd>
      <dt class="text-gray-500 dark:text-[#9aa3b2]">Audio</dt>
      <dd class="flex items-center justify-end gap-2">
        <span
          v-if="stats.audioDb === null || stats.audioDb <= SILENT_DB"
          class="text-gray-900 dark:text-white"
        >
          No sound
        </span>
        <span
          v-else
          class="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
          :title="`${Math.round(stats.audioDb)} dB`"
        >
          <span
            class="block h-full rounded-full transition-[width] duration-300"
            :class="stats.audioDb > -6 ? 'bg-red-500' : 'bg-green-500'"
            :style="{ width: `${audioPercent}%` }"
          />
        </span>
      </dd>
    </dl>
    <p v-else class="mt-3 text-xs text-gray-500 dark:text-[#9aa3b2]">Waiting for stats…</p>
  </div>
</template>

<script setup lang="ts">
// Live numbers for the running YouTube stream (emitted once a second by the
// desktop app's stats reporter). "Sending" drops well below the target on still
// slides, which is normal: the encoder only spends data on what changes, so
// health is judged by frame rate, delayed frames and reconnects instead.
const { stats, status } = useYoutubeStream()

// Quieter than this reads as silence.
const SILENT_DB = -60
// Ignore the first seconds while the encoder and connection settle.
const SETTLE_SECS = 5
const MIN_HEALTHY_FPS = 25
const MAX_HEALTHY_DELAYED_PERCENT = 2

const health = computed(() => {
  if (status.value.phase === "reconnecting") {
    return {
      label: "Reconnecting",
      dot: "bg-amber-500 animate-pulse",
      hint: "The connection to YouTube dropped. Retrying automatically.",
    }
  }
  const current = stats.value
  if (current && current.uptimeSecs > SETTLE_SECS) {
    if (current.fps < MIN_HEALTHY_FPS || current.delayedPercent > MAX_HEALTHY_DELAYED_PERCENT) {
      return {
        label: "Struggling",
        dot: "bg-amber-500",
        hint: "Frames are arriving late. Viewers may see stutter; close other heavy apps.",
      }
    }
  }
  return { label: "Live on YouTube", dot: "bg-green-500", hint: "" }
})

const audioPercent = computed(() => {
  const db = stats.value?.audioDb
  if (db === null || db === undefined) return 0
  return Math.round(Math.min(1, Math.max(0, (db - SILENT_DB) / -SILENT_DB)) * 100)
})

const formatKbps = (kbps: number) =>
  kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`

const formatUptime = (total: number) => {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}
</script>
