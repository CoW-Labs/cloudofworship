<template>
  <div class="camera-feed absolute inset-0 overflow-hidden bg-black">
    <video
      ref="videoEl"
      autoplay
      muted
      playsinline
      disablepictureinpicture
      class="h-full w-full"
      :class="[
        data?.fit === 'contain' ? 'object-contain' : 'object-cover',
        { invisible: status !== 'live' },
      ]"
      :style="data?.mirror ? 'transform: scaleX(-1)' : ''"
    ></video>

    <!-- The projector stays plain black on failure: the operator sees the
         reason in their Live Output preview instead of the congregation. -->
    <template v-if="quality === 'preview'">
      <div
        v-if="status !== 'live'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-white/80"
      >
        <CameraIcon
          class="h-7 w-7"
          :class="status === 'connecting' ? 'animate-pulse' : 'text-white/60'"
        />
        <p class="text-xs font-medium leading-snug">
          {{
            status === "connecting"
              ? "Connecting camera…"
              : cameraErrorMessage(status)
          }}
        </p>
      </div>
      <p
        v-else-if="match === 'fallback'"
        class="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-amber-200"
        :title="`Showing ${resolvedLabel || 'another camera'}`"
      >
        Using a different camera
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CameraSlideData } from "~/types"
import CameraIcon from "~/components/svgs/CameraIcon.vue"
import useCameraStream, {
  cameraCaptureIsExclusive,
  cameraErrorMessage,
  cameraErrorState,
  type CameraDeviceMatch,
  type CameraErrorState,
  type CameraHandle,
  type CameraQuality,
} from "~/composables/useCameraStream"

const props = defineProps<{
  data?: CameraSlideData | null
  quality: CameraQuality
  /** Stop a camera as soon as this feed lets go of it (the camera picker). */
  releaseImmediately?: boolean
}>()

const emit = defineEmits<{
  status: [status: "connecting" | "live" | CameraErrorState]
}>()

const { acquire, onCameraDevicesChange } = useCameraStream()

const videoEl = ref<HTMLVideoElement | null>(null)
const status = ref<"connecting" | "live" | CameraErrorState>("connecting")
const match = ref<CameraDeviceMatch>("exact")
const resolvedLabel = ref("")

watch(status, (value) => emit("status", value), { immediate: true })

let handle: CameraHandle | null = null
let token = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopMuteWatch: () => void = () => {}

const releaseOptions = () => ({ immediate: !!props.releaseImmediately })

// Nothing tells the projector when OBS or Zoom lets go of the camera, or when
// a missing one comes back without a devicechange, so it looks again every few
// seconds. Not on "denied": that needs the operator, and retrying could put a
// permission prompt on the projector.
const RETRY_MS = 5_000
const clearRetry = () => {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}
watch(status, (value) => {
  clearRetry()
  if (
    props.quality === "output" &&
    (value === "in-use" || value === "missing" || value === "error")
  ) {
    retryTimer = setTimeout(() => start(), RETRY_MS)
  }
})

const detach = () => {
  stopMuteWatch()
  handle?.release(releaseOptions())
  handle = null
  if (videoEl.value) videoEl.value.srcObject = null
}

const attach = (next: CameraHandle) => {
  handle = next
  match.value = next.match
  resolvedLabel.value = next.deviceLabel
  const element = videoEl.value
  if (element && element.srcObject !== next.stream) {
    element.srcObject = next.stream
    // safePlayMedia skips elements without a `src`, which a srcObject feed
    // never has. Muted autoplay is always allowed; this only nudges it.
    element.play().catch(() => {})
  }
  next.onEnded(() => {
    if (handle !== next) return
    handle = null
    if (videoEl.value) videoEl.value.srcObject = null
    status.value = "missing"
  })
  // Safari's engine (and the macOS app) mutes this page's camera for good when
  // another page opens it. Let go and report it; on the projector the retry
  // then opens a fresh stream, which takes the camera back.
  stopMuteWatch()
  const track = next.stream.getVideoTracks()[0]
  if (track && cameraCaptureIsExclusive()) {
    const onMute = () => {
      if (handle !== next) return
      detach()
      status.value = "in-use"
    }
    track.addEventListener("mute", onMute)
    stopMuteWatch = () => track.removeEventListener("mute", onMute)
  }
  status.value = "live"
}

const start = async () => {
  const mine = ++token
  stopMuteWatch()
  const previous = handle
  handle = null
  if (!props.data) {
    previous?.release(releaseOptions())
    status.value = "missing"
    return
  }
  if (!previous) status.value = "connecting"
  try {
    // Acquire before releasing the old handle, so a re-resolve that lands on
    // the same device reuses its stream instead of reopening it.
    const next = await acquire(props.data)
    previous?.release(releaseOptions())
    if (mine !== token) {
      next.release(releaseOptions())
      return
    }
    attach(next)
  } catch (error) {
    previous?.release(releaseOptions())
    if (mine !== token) return
    if (videoEl.value) videoEl.value.srcObject = null
    status.value = cameraErrorState(error)
  }
}

watch(
  () => [props.data?.deviceId, props.data?.deviceLabel],
  () => start()
)

// A camera plugged back in recovers a failed feed, and the slide's own camera
// coming back replaces a stand-in.
let stopDeviceWatch: () => void = () => {}

onMounted(() => {
  start()
  stopDeviceWatch = onCameraDevicesChange(() => {
    if (status.value === "connecting") return
    if (status.value !== "live" || match.value === "fallback") start()
  })
})

onBeforeUnmount(() => {
  token += 1
  clearRetry()
  stopDeviceWatch()
  detach()
})
</script>
