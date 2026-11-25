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
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
            Pre-stream checks
          </h4>
          <p
            class="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-[#9aa3b2]"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="dotClass(summary.state)"
            />
            {{ summary.text }}
          </p>
        </div>
        <div class="-mr-1.5 -mt-1 flex items-center gap-0.5">
          <button
            class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
            title="Check again"
            aria-label="Check again"
            :disabled="checking"
            @click="runChecks"
          >
            <Icon
              name="i-lucide-refresh-cw"
              class="h-4 w-4"
              :class="{ 'animate-spin': checking }"
            />
          </button>
          <button
            class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-white"
            title="Cancel"
            aria-label="Cancel"
            @click="answerPreflight('cancel')"
          >
            <Icon name="i-lucide-x" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul
        class="mt-4 divide-y divide-gray-100 border-b border-gray-100 dark:divide-white/5 dark:border-white/5"
      >
        <li v-for="row in rows" :key="row.key" class="py-3">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <span
                class="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-white"
              >
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="dotClass(row.state)"
                />
                <span class="flex items-baseline gap-2">
                  {{ row.label }}
                  <button
                    v-if="row.key === 'youtube'"
                    type="button"
                    class="text-xs font-normal text-primary-600 hover:underline dark:text-primary-400"
                    @click="updateStreamKey"
                  >
                    Update stream key
                  </button>
                </span>
              </span>
              <p
                v-if="row.hint && row.state !== 'ok'"
                class="mt-0.5 pl-5 text-xs"
                :class="
                  row.state === 'fail'
                    ? 'text-red-500'
                    : row.state === 'warn'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-500 dark:text-[#9aa3b2]'
                "
              >
                {{ row.hint }}
              </p>
            </div>
            <SettingsSelect
              v-if="row.key === 'quality'"
              width="w-[210px]"
              :options="qualityChoices"
              :model-value="qualityChoice"
              @change="(label: string) => setQualityChoice(label)"
            />
            <SettingsSelect
              v-else-if="row.key === 'audio'"
              width="w-[210px]"
              :options="audioChoices"
              :model-value="audioChoice"
              @change="(label: string) => setAudioChoice(label)"
            />
            <span
              v-else
              class="w-44 shrink-0 truncate text-right text-sm tabular-nums text-gray-500 dark:text-[#9aa3b2]"
            >
              {{ row.value }}
            </span>
          </div>
          <Hint v-if="row.key === 'quality' && bitrateHint" class="ml-5 mt-3">
            Bitrate is how much video data you send each second. For
            <strong class="font-semibold text-gray-900 dark:text-[#F8F9FB]">{{
              bitrateHint.quality
            }}</strong
            >, aim for
            <strong class="font-semibold text-gray-900 dark:text-[#F8F9FB]"
              >{{ bitrateHint.low }} to {{ bitrateHint.high }} Mbps</strong
            >. Lower looks soft, higher needs a faster upload.
          </Hint>
          <div
            v-if="row.key === 'audio' && meterOn"
            class="ml-5 mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
            :title="meterDb === null ? 'No sound' : `${Math.round(meterDb)} dB`"
          >
            <div
              class="h-full rounded-full transition-[width] duration-100"
              :class="
                meterDb !== null && meterDb > -6 ? 'bg-red-500' : 'bg-green-500'
              "
              :style="{ width: `${meterPercent}%` }"
            />
          </div>
        </li>
      </ul>

      <label
        class="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        <UCheckbox v-model="recordLocally" @update:model-value="onRecordChanged" />
        Also record this stream on this computer
      </label>
      <label
        class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        <UCheckbox v-model="checkBeforeStreaming" />
        Check before every stream
      </label>

      <div class="mt-8 flex items-center justify-end gap-3">
        <CowButton
          variant="secondary"
          size="md"
          @click="answerPreflight('window-only')"
        >
          {{ recordLocally ? "Live window and record" : "Live window only" }}
        </CowButton>
        <CowButton
          variant="primary"
          size="md"
          @click="answerPreflight('stream')"
        >
          {{ hasProblem ? "Go live anyway" : "Go live" }}
        </CowButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
// The pre-flight check shown before a stream starts (see the go-live
// handler in the app layout): upload speed, whether YouTube's server can be
// reached, a live meter for the chosen audio input, and the quality and
// encoder the stream will use. Nothing here blocks going live; it tells the
// operator what to fix first.
import type { StreamPlan } from "~/composables/useStreamOutput"
import { appWideActions } from "~/utils/constants"

const onRecordChanged = (on: boolean) =>
  usePosthogCapture("STREAM_RECORDING_CHANGED", { on })

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
  recordLocally,
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
} = useStreamOutput()

// Quieter than this counts as "no sound yet" (room noise on a muted input).
const SOUND_THRESHOLD_DB = -50
// How long to listen before warning that no sound came through.
const LISTEN_FOR_MS = 5000
// The meter shows the top 60 dB.
const METER_FLOOR_DB = -60

const plan = ref<StreamPlan | null>(null)
// The measured speed is kept apart from its verdict, so changing the quality
// re-judges the same measurement against the new bitrate.
const upload = ref<{
  state: "checking" | "done" | "error"
  mbps?: number
  error?: string
}>({
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
  listenTimer = setTimeout(
    () => (listenedLongEnough.value = true),
    LISTEN_FOR_MS
  )
  try {
    meterOn.value = await startAudioMeter()
  } catch (error) {
    console.warn("Audio meter failed to start:", error)
    meterOn.value = false
  }
}

// Closes the check, then opens the stream key. Going live waits until the
// operator starts it again, so the new key is what the stream uses.
const updateStreamKey = () => {
  usePosthogCapture("STREAM_KEY_UPDATE_LINK_CLICKED", { from: "preflight" })
  answerPreflight("cancel")
  useGlobalEmit(appWideActions.openSettings, "Live Stream Settings")
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

const formatMbps = (mbps: number) =>
  mbps >= 10 ? Math.round(mbps) : mbps.toFixed(1)

// Whole numbers drop the decimal: "9", not "9.0".
const formatRangeMbps = (kbps: number) => {
  const mbps = kbps / 1000
  return Number.isInteger(mbps) ? `${mbps}` : mbps.toFixed(1)
}

// What to aim for at the chosen quality: half the tier's target up to the
// target itself. Below that the picture turns soft, above it the upload
// has to keep up.
const bitrateHint = computed(() => {
  if (!plan.value) return null
  const { height, fps, videoKbps } = plan.value
  return {
    quality: `${height === 2160 ? "4K" : `${height}p`} ${fps} fps`,
    low: formatRangeMbps(videoKbps / 2),
    high: formatRangeMbps(videoKbps),
  }
})

const internetRow = computed<Row>(() => {
  const { mbps, error } = upload.value
  const needs = `needs about ${formatMbps(neededMbps.value)} Mbps`
  if (upload.value.state === "checking") {
    return {
      key: "internet",
      label: "Internet",
      value: "Testing…",
      state: "checking",
    }
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
    mbps >= neededMbps.value * 1.5
      ? "ok"
      : mbps >= neededMbps.value
      ? "warn"
      : "fail"
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
  if (state === "checking")
    return { key: "youtube", label: "YouTube", value: "Connecting…", state }
  if (state === "ok")
    return {
      key: "youtube",
      label: "YouTube",
      value: `Reachable (${ms} ms)`,
      state,
    }
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
    return {
      ...base,
      value: "No audio",
      state: "warn",
      hint: "The stream will be silent.",
    }
  }
  const name = audioDeviceName.value ?? "Default input"
  if (!meterOn.value) {
    return {
      ...base,
      value: name,
      state: "warn",
      hint: "Couldn't listen to this input.",
    }
  }
  if (heardSound.value) return { ...base, value: name, state: "ok" }
  if (!listenedLongEnough.value) {
    return {
      ...base,
      value: name,
      state: "checking",
      hint: "Listening… make some sound.",
    }
  }
  return {
    ...base,
    value: name,
    state: "warn",
    hint: "No sound is coming through. Check the input, or pick your mixer below.",
  }
})

const qualityRow = computed<Row>(() => {
  if (!plan.value)
    return { key: "quality", label: "Quality", value: "…", state: "checking" }
  const { height, fps, videoKbps, audioKbps } = plan.value
  return {
    key: "quality",
    label: "Quality",
    value: `${
      height === 2160 ? "4K" : `${height}p`
    } · ${fps} fps · ${formatMbps((videoKbps + audioKbps) / 1000)} Mbps`,
    state: qualityIsUpscaled.value ? "warn" : "ok",
    hint: qualityIsUpscaled.value
      ? `Your live window is ${sourceHeight.value}p, so this is an upscale. It won't look sharper than ${sourceHeight.value}p.`
      : undefined,
  }
})

const encoderRow = computed<Row>(() => {
  if (!plan.value)
    return { key: "encoder", label: "Encoder", value: "…", state: "checking" }
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

const hasProblem = computed(() =>
  rows.value.some((row) => row.state === "fail")
)

const dotClass = (state: CheckState) =>
  ({
    checking: "animate-pulse bg-gray-300 dark:bg-gray-500",
    ok: "bg-green-500",
    warn: "bg-amber-500",
    fail: "bg-red-500",
  }[state])

const summary = computed<{ state: CheckState; text: string }>(() => {
  if (checking.value) return { state: "checking", text: "Checking your setup…" }
  if (hasProblem.value)
    return { state: "fail", text: "Something needs fixing first" }
  if (rows.value.some((row) => row.state === "warn")) {
    return { state: "warn", text: "Ready, with a few things to look at" }
  }
  return { state: "ok", text: "All good. Ready when you are" }
})
</script>
