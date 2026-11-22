<template>
  <UModal
    :model-value="preflightOpen"
    :ui="{
      rounded: 'rounded-2xl',
      background: 'bg-transparent dark:bg-transparent',
      ring: '',
      shadow: 'shadow-none',
      width: 'w-[94vw] sm:max-w-lg',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
    @update:model-value="(open: boolean) => !open && answerPreflight('cancel')"
  >
    <div
      class="rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden p-6"
    >
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
          Ready to go live on YouTube?
        </h4>
        <button
          class="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50 dark:text-primary-400"
          :disabled="checking"
          @click="runChecks"
        >
          Check again
        </button>
      </div>
      <p class="mt-1 text-sm text-gray-500 dark:text-[#9aa3b2]">
        A quick check of your connection and sound before the stream starts.
      </p>

      <ul class="mt-5 divide-y divide-gray-100 dark:divide-white/5">
        <li v-for="row in rows" :key="row.key" class="flex items-start gap-3 py-3">
          <span class="mt-0.5 shrink-0">
            <Icon
              v-if="row.state === 'checking'"
              name="i-lucide-loader-2"
              class="h-4 w-4 animate-spin text-gray-400"
            />
            <Icon
              v-else-if="row.state === 'ok'"
              name="i-lucide-circle-check"
              class="h-4 w-4 text-green-500"
            />
            <Icon
              v-else-if="row.state === 'warn'"
              name="i-lucide-triangle-alert"
              class="h-4 w-4 text-amber-500"
            />
            <Icon v-else name="i-lucide-circle-x" class="h-4 w-4 text-red-500" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ row.label }}
              </span>
              <span class="truncate text-right text-sm text-gray-600 dark:text-[#c4cad4]">
                {{ row.value }}
              </span>
            </div>
            <p v-if="row.hint" class="mt-0.5 text-xs text-gray-500 dark:text-[#9aa3b2]">
              {{ row.hint }}
            </p>

            <div v-if="row.key === 'quality'" class="mt-2">
              <SettingsSelect
                width="w-full sm:w-[300px]"
                :options="qualityChoices"
                :model-value="qualityChoice"
                @change="(label: string) => setQualityChoice(label)"
              />
            </div>

            <div v-if="row.key === 'audio'" class="mt-2 flex items-center gap-3">
              <SettingsSelect
                width="w-full sm:w-[220px]"
                :options="audioChoices"
                :model-value="audioChoice"
                @change="(label: string) => setAudioChoice(label)"
              />
              <div
                v-if="meterOn"
                class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
                :title="meterDb === null ? 'No sound' : `${Math.round(meterDb)} dB`"
              >
                <div
                  class="h-full rounded-full transition-[width] duration-100"
                  :class="meterDb !== null && meterDb > -6 ? 'bg-red-500' : 'bg-green-500'"
                  :style="{ width: `${meterPercent}%` }"
                />
              </div>
            </div>
          </div>
        </li>
      </ul>

      <label class="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-[#9aa3b2]">
        <UCheckbox v-model="checkBeforeStreaming" />
        Run this check before every YouTube stream
      </label>

      <div class="mt-6 flex flex-wrap items-center justify-end gap-3">
        <CowButton variant="secondary" size="md" @click="answerPreflight('cancel')">
          Cancel
        </CowButton>
        <CowButton variant="secondary" size="md" @click="answerPreflight('window-only')">
          Live window only
        </CowButton>
        <CowButton variant="primary" size="md" @click="answerPreflight('stream')">
          {{ hasProblem ? "Go live anyway" : "Go live on YouTube" }}
        </CowButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
// The pre-flight check shown before a YouTube stream starts (see the go-live
// handler in the app layout): upload speed, whether YouTube's server can be
// reached, a live meter for the chosen audio input, and the quality and
// encoder the stream will use. Nothing here blocks going live; it tells the
// operator what to fix first.
import type { StreamPlan } from "~/composables/useYoutubeStream"

type CheckState = "checking" | "ok" | "warn" | "fail"

interface Row {
  key: string
  label: string
  value: string
  state: CheckState
  hint?: string
}

const {
  preflightOpen,
  answerPreflight,
  checkBeforeStreaming,
  qualityChoices,
  qualityChoice,
  setQualityChoice,
  qualityIsUpscaled,
  sourceHeight,
  quality,
  audioChoices,
  audioChoice,
  setAudioChoice,
  audioDevice,
  audioDeviceName,
  meterDb,
  getPlan,
  checkYoutube,
  measureUploadMbps,
  startAudioMeter,
  stopAudioMeter,
  listAudioDevices,
} = useYoutubeStream()

// Quieter than this counts as "no sound yet" (room noise on a muted input).
const SOUND_THRESHOLD_DB = -50
// How long to listen before warning that no sound came through.
const LISTEN_FOR_MS = 5000
// The meter shows the top 60 dB.
const METER_FLOOR_DB = -60

const plan = ref<StreamPlan | null>(null)
// The measured speed is kept apart from its verdict, so changing the quality
// re-judges the same measurement against the new bitrate.
const upload = ref<{ state: "checking" | "done" | "error"; mbps?: number; error?: string }>({
  state: "checking",
})
const youtube = ref<{ state: CheckState; ms?: number; error?: string }>({
  state: "checking",
})
const meterOn = ref(false)
const heardSound = ref(false)
const listenedLongEnough = ref(false)
let listenTimer: ReturnType<typeof setTimeout> | null = null
// Each run of the checks gets an id, so a slow answer from an earlier run
// can't overwrite a newer one.
let run = 0

const neededMbps = computed(() =>
  plan.value ? (plan.value.videoKbps + plan.value.audioKbps) / 1000 : 2.6
)

const checking = computed(
  () => upload.value.state === "checking" || youtube.value.state === "checking"
)

const restartMeter = async () => {
  heardSound.value = false
  listenedLongEnough.value = false
  if (listenTimer) clearTimeout(listenTimer)
  listenTimer = setTimeout(() => (listenedLongEnough.value = true), LISTEN_FOR_MS)
  try {
    meterOn.value = await startAudioMeter()
  } catch (error) {
    console.warn("Audio meter failed to start:", error)
    meterOn.value = false
  }
}

const runChecks = async () => {
  const id = ++run
  upload.value = { state: "checking" }
  youtube.value = { state: "checking" }
  await listAudioDevices()
  void restartMeter()

  getPlan()
    .then((result) => id === run && (plan.value = result))
    .catch((error) => console.warn("Couldn't read the stream plan:", error))

  checkYoutube()
    .then((ms) => id === run && (youtube.value = { state: "ok", ms }))
    .catch((error) => {
      if (id === run) youtube.value = { state: "fail", error: String(error) }
    })

  measureUploadMbps()
    .then((mbps) => {
      if (id === run) upload.value = { state: "done", mbps }
    })
    .catch((error) => {
      if (id === run) upload.value = { state: "error", error: String(error) }
    })
}

watch(preflightOpen, (open) => {
  if (open) {
    void runChecks()
    return
  }
  run++
  if (listenTimer) clearTimeout(listenTimer)
  meterOn.value = false
  void stopAudioMeter()
})

// Picking another quality re-reads the plan: the bitrate it needs changes the
// internet verdict, and the encoder can differ by codec.
watch(quality, () => {
  if (!preflightOpen.value) return
  getPlan()
    .then((result) => (plan.value = result))
    .catch((error) => console.warn("Couldn't read the stream plan:", error))
})

// Seen once per run of the check, not on every re-render.
watch(
  () => preflightOpen.value && qualityIsUpscaled.value,
  (shown) => {
    if (shown) {
      usePosthogCapture("STREAM_QUALITY_UPSCALE_WARNING_SHOWN", {
        quality: quality.value,
        sourceHeight: sourceHeight.value,
      })
    }
  }
)

// Picking another input restarts the meter on it.
watch(audioDevice, () => {
  if (preflightOpen.value) void restartMeter()
})

watch(meterDb, (db) => {
  if (db !== null && db > SOUND_THRESHOLD_DB) heardSound.value = true
})

onBeforeUnmount(() => {
  if (listenTimer) clearTimeout(listenTimer)
})

const meterPercent = computed(() => {
  if (meterDb.value === null) return 0
  const ratio = (meterDb.value - METER_FLOOR_DB) / -METER_FLOOR_DB
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100)
})

const formatMbps = (mbps: number) => (mbps >= 10 ? Math.round(mbps) : mbps.toFixed(1))

const internetRow = computed<Row>(() => {
  const { mbps, error } = upload.value
  const needs = `needs about ${formatMbps(neededMbps.value)} Mbps`
  if (upload.value.state === "checking") {
    return { key: "internet", label: "Internet", value: "Testing…", state: "checking" }
  }
  if (mbps === undefined) {
    return {
      key: "internet",
      label: "Internet",
      value: "Couldn't test",
      state: "warn",
      hint: error ? `The speed test didn't finish (${error}).` : undefined,
    }
  }
  // Headroom matters: other devices share the church's connection.
  const state: CheckState =
    mbps >= neededMbps.value * 1.5 ? "ok" : mbps >= neededMbps.value ? "warn" : "fail"
  return {
    key: "internet",
    label: "Internet",
    value: `${formatMbps(mbps)} Mbps upload`,
    state,
    hint:
      state === "ok"
        ? undefined
        : state === "warn"
          ? `Just enough (${needs}). Pause big uploads or downloads on this network.`
          : `Too slow for a smooth stream (${needs}). Viewers will see buffering.`,
  }
})

const youtubeRow = computed<Row>(() => {
  const { state, ms, error } = youtube.value
  if (state === "checking") return { key: "youtube", label: "YouTube", value: "Connecting…", state }
  if (state === "ok") return { key: "youtube", label: "YouTube", value: `Reachable (${ms} ms)`, state }
  return {
    key: "youtube",
    label: "YouTube",
    value: "Not reachable",
    state,
    hint: error || "Check this computer's internet connection.",
  }
})

const audioRow = computed<Row>(() => {
  const base = { key: "audio", label: "Audio" }
  if (audioDevice.value === "") {
    return { ...base, value: "No audio", state: "warn", hint: "The stream will be silent." }
  }
  const name = audioDeviceName.value ?? "Default input"
  if (!meterOn.value) {
    return { ...base, value: name, state: "warn", hint: "Couldn't listen to this input." }
  }
  if (heardSound.value) return { ...base, value: name, state: "ok" }
  if (!listenedLongEnough.value) {
    return { ...base, value: name, state: "checking", hint: "Listening… make some sound." }
  }
  return {
    ...base,
    value: name,
    state: "warn",
    hint: "No sound is coming through. Check the input, or pick your mixer below.",
  }
})

const qualityRow = computed<Row>(() => {
  if (!plan.value) return { key: "quality", label: "Quality", value: "…", state: "checking" }
  const { height, fps, videoKbps, audioKbps } = plan.value
  return {
    key: "quality",
    label: "Quality",
    value: `${height === 2160 ? "4K" : `${height}p`} · ${fps} fps · ${formatMbps((videoKbps + audioKbps) / 1000)} Mbps`,
    state: qualityIsUpscaled.value ? "warn" : "ok",
    hint: qualityIsUpscaled.value
      ? `Your live window is ${sourceHeight.value}p, so this is an upscale. It won't look sharper than ${sourceHeight.value}p.`
      : undefined,
  }
})

const encoderRow = computed<Row>(() => {
  if (!plan.value) return { key: "encoder", label: "Encoder", value: "…", state: "checking" }
  return {
    key: "encoder",
    label: "Encoder",
    value: plan.value.encoder,
    state: plan.value.hardwareEncoder ? "ok" : "warn",
    hint: plan.value.hardwareEncoder
      ? undefined
      : "This computer will encode in software, which can slow it down.",
  }
})

const rows = computed(() => [
  internetRow.value,
  youtubeRow.value,
  audioRow.value,
  qualityRow.value,
  encoderRow.value,
])

const hasProblem = computed(() => rows.value.some((row) => row.state === "fail"))
</script>
