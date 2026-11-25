<template>
  <div class="w-72 text-sm">
    <div class="flex items-center justify-between gap-3">
      <span class="font-semibold text-gray-900 dark:text-white">Audio mixer</span>
      <span class="text-xs text-gray-500 dark:text-[#9aa3b2]">Stays on this device</span>
    </div>

    <ul class="mt-3 flex flex-col gap-4">
      <li v-for="row in rows" :key="row.source">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
            <Icon :name="row.icon" class="h-4 w-4" />
            {{ row.label }}
          </span>
          <div class="flex items-center gap-2">
            <span class="w-9 text-right text-xs tabular-nums text-gray-500 dark:text-[#9aa3b2]">
              {{ row.muted ? "Off" : `${Math.round(row.gain * 100)}%` }}
            </span>
            <UButton
              color="gray"
              variant="ghost"
              size="2xs"
              :icon="row.muted ? row.mutedIcon : row.icon"
              :disabled="!row.present"
              :aria-label="`${row.muted ? 'Unmute' : 'Mute'} ${row.label}`"
              :title="row.muted ? 'Unmute' : 'Mute'"
              @click="toggleMute(row.source, !row.muted)"
            />
          </div>
        </div>

        <CoWSlider
          class="mt-2"
          :model-value="Math.round(row.gain * 100)"
          :min="0"
          :max="MIXER_MAX_PERCENT"
          :step="1"
          :disabled="!row.present"
          :aria-label="`${row.label} level`"
          @update:model-value="(value: number) => mixer.setGain(row.source, value / 100)"
          @change="onLevelChanged(row.source)"
        />

        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div
            class="h-full w-full origin-left rounded-full transition-transform duration-100"
            :class="row.db !== null && row.db > -6 ? 'bg-red-500' : 'bg-green-500'"
            :style="{ transform: `scaleX(${percent(row.db) / 100})` }"
          />
        </div>
        <p v-if="!row.present" class="mt-1.5 text-xs text-gray-500 dark:text-[#9aa3b2]">
          {{ row.missing }}
        </p>
      </li>
    </ul>

    <div class="mt-4 border-t border-gray-200 pt-3 dark:border-white/10">
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-[#9aa3b2]">
        <span>On the stream</span>
        <span class="w-16 text-right tabular-nums">{{ masterLabel }}</span>
      </div>
      <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          class="h-full w-full origin-left rounded-full transition-transform duration-100"
          :class="(live?.master ?? MIXER_SILENT_DB) > -6 ? 'bg-red-500' : 'bg-green-500'"
          :style="{ transform: `scaleX(${percent(live?.master ?? null) / 100})` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// The audio mixer panel: one level, mute and meter per source (the
// microphone, and the sound this app plays), plus the mix that goes out.
// It sits in a popover on the broadcast status bar. The meters only run while
// it is open: the desktop app sends no level readings otherwise.
import {
  useAudioMixer,
  MIXER_MAX_PERCENT,
  MIXER_SILENT_DB,
  type MixerSourceName,
} from "~/composables/useAudioMixer"

const mixer = useAudioMixer()
const { state, live } = mixer

let stopWatching: (() => void) | null = null
let closed = false

onMounted(async () => {
  usePosthogCapture("AUDIO_MIXER_OPENED")
  await mixer.refresh()
  const stop = await mixer.watchLevels()
  if (closed) stop()
  else stopWatching = stop
})

onBeforeUnmount(() => {
  closed = true
  stopWatching?.()
})

const percent = (db: number | null) => {
  if (db === null || db <= MIXER_SILENT_DB) return 0
  return Math.round(Math.min(1, (db - MIXER_SILENT_DB) / -MIXER_SILENT_DB) * 100)
}

const rows = computed(() => [
  {
    source: "mic" as MixerSourceName,
    label: "Microphone",
    icon: "i-ph-microphone",
    mutedIcon: "i-ph-microphone-slash",
    present: state.value.mic?.present ?? false,
    gain: mixer.gainOf("mic"),
    muted: mixer.mutedOf("mic"),
    db: live.value?.mic ?? null,
    missing: "No microphone chosen. Pick one in Live Stream Settings.",
  },
  {
    source: "app" as MixerSourceName,
    label: "App audio",
    icon: "i-ph-speaker-high",
    mutedIcon: "i-ph-speaker-slash",
    present: state.value.app?.present ?? false,
    gain: mixer.gainOf("app"),
    muted: mixer.mutedOf("app"),
    db: live.value?.app ?? null,
    missing:
      state.value.appReason ||
      "Not captured. Allow Screen Recording for Cloud of Worship, then restart it.",
  },
])

const masterLabel = computed(() => {
  const db = live.value?.master
  return db === undefined || db <= MIXER_SILENT_DB ? "No sound" : `${Math.round(db)} dB`
})

const toggleMute = (source: MixerSourceName, muted: boolean) => {
  void mixer.setMuted(source, muted)
  usePosthogCapture("AUDIO_MIXER_MUTE_CHANGED", { source, muted })
}

// Fires when the handle is let go, not on every step of the drag.
const onLevelChanged = (source: MixerSourceName) =>
  usePosthogCapture("AUDIO_MIXER_LEVEL_CHANGED", {
    source,
    percent: Math.round(mixer.gainOf(source) * 100),
  })
</script>
