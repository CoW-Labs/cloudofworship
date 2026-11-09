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

    <!-- The camera effect, drawn from the video above (which keeps playing
         underneath). Hidden until its first frame, so where WebGL is missing
         the plain feed shows instead. Keyed by effect: a canvas whose effect
         has finished cannot draw again. -->
    <canvas
      v-if="effectDraw"
      :key="effectDraw.kind"
      ref="effectEl"
      class="absolute inset-0 h-full w-full"
      :class="[
        data?.fit === 'contain' ? 'object-contain' : 'object-cover',
        { invisible: status !== 'live' || !effectDrawing },
      ]"
      :style="data?.mirror ? 'transform: scaleX(-1)' : ''"
      aria-hidden="true"
    ></canvas>

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
            remoteState
              ? remoteCameraMessage(remoteState, remoteName)
              : status === "connecting"
              ? remoteName
                ? `Connecting to ${remoteName}'s camera…`
                : "Connecting camera…"
              : assignedOnly && status === "missing"
              ? "This slide's camera is not on this computer"
              : cameraErrorMessage(status)
          }}
        </p>
      </div>
      <p
        v-else-if="remoteHandle"
        class="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80"
      >
        From {{ remoteName }}'s computer
      </p>
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
import useCameraEffect, {
  type CameraEffectDraw,
} from "~/composables/useCameraEffect"
import {
  cameraEffectOf,
  echoSettingsOf,
  lightLeakSettingsOf,
} from "~/utils/camera"
import useCameraShare, {
  RemoteCameraError,
  type RemoteCameraHandle,
} from "~/composables/useCameraShare"
import {
  chooseCameraSource,
  remoteCameraMessage,
  type RemoteCameraState,
} from "~/utils/cameraShare"
import useCameraStream, {
  cameraCaptureIsExclusive,
  cameraErrorMessage,
  cameraErrorState,
  CameraStreamError,
  reportCameraFailure,
  type CameraDeviceMatch,
  type CameraErrorState,
  type CameraHandle,
  type CameraQuality,
  type CameraResolution,
} from "~/composables/useCameraStream"

const props = withDefaults(
  defineProps<{
    data?: CameraSlideData | null
    quality: CameraQuality
    /** Stop a camera as soon as this feed lets go of it (the camera picker). */
    releaseImmediately?: boolean
    /** How big this feed is drawn; a small inset asks the camera for less. */
    resolution?: CameraResolution
    /** Show the slide's own camera or nothing, never a stand-in (the editor). */
    assignedOnly?: boolean
    /**
     * May show the camera from a teammate's computer when it is plugged in
     * there rather than here (see useCameraShare). Operator previews only.
     */
    remote?: boolean
    /**
     * Never opens a camera on this computer: a teammate's or nothing. Where
     * one page holds the camera at a time and a camera is on the projector.
     */
    remoteOnly?: boolean
  }>(),
  { resolution: "full" }
)

const emit = defineEmits<{
  status: [status: "connecting" | "live" | CameraErrorState]
}>()

const { acquire, listCameras, localCameraMatch, onCameraDevicesChange } =
  useCameraStream()
const cameraShare = useCameraShare()
const { hasAccessToFeature } = useSubscription()

const videoEl = ref<HTMLVideoElement | null>(null)
const status = ref<"connecting" | "live" | CameraErrorState>("connecting")
const match = ref<CameraDeviceMatch>("exact")
const resolvedLabel = ref("")
// A teammate's camera: the feed showing, who sends it, or why it is not.
const remoteHandle = shallowRef<RemoteCameraHandle | null>(null)
const remoteName = ref("")
const remoteState = ref<RemoteCameraState | null>(null)
const allowsRemote = computed(() => !!props.remote || !!props.remoteOnly)
// Who last sent this slide's camera here, so a feed whose sender goes away
// waits for it instead of reaching for this computer's own devices.
let lastRemoteName = ""

// Analytics. Retries run every few seconds, so each failure reason is sent
// at most once a minute per feed, and the Teams gate once per feed.
const shareSurface = computed(() => (props.assignedOnly ? "editor" : "live-output"))
const SHARE_FAILURE_REPORT_MS = 60_000
const shareFailureReportedAt = new Map<RemoteCameraState, number>()
let teamsGateReported = false
const reportShareFailure = (reason: RemoteCameraState) => {
  if (reason === "teams") {
    if (teamsGateReported) return
    teamsGateReported = true
    usePosthogCapture("TEAMS_FEATURE_BLOCKED", { feature: "camera-share", stage: "view" })
    return
  }
  const now = Date.now()
  if (now - (shareFailureReportedAt.get(reason) ?? 0) < SHARE_FAILURE_REPORT_MS) return
  shareFailureReportedAt.set(reason, now)
  usePosthogCapture("CAMERA_SHARE_FAILED", { reason, surface: shareSurface.value })
}

watch(status, (value) => emit("status", value), { immediate: true })

const effectEl = ref<HTMLCanvasElement | null>(null)
const effectDraw = computed((): CameraEffectDraw | null => {
  switch (cameraEffectOf(props.data)) {
    case "main-character-echo":
      return {
        kind: "main-character-echo",
        settings: echoSettingsOf(props.data),
      }
    case "light-leak":
      return { kind: "light-leak", settings: lightLeakSettingsOf(props.data) }
    default:
      return null
  }
})
// The projector refreshes the person outline up to 15 times a second; the
// operator's previews make do with 5, as they are small and share the
// operator's computer with everything else.
const DETECTION_INTERVAL_MS = { output: 1000 / 15, preview: 1000 / 5 }
const { drawing: effectDrawing } = useCameraEffect(
  videoEl,
  effectEl,
  computed(() => ({
    effect: effectDraw.value,
    mirrored: !!props.data?.mirror,
    detectionIntervalMs: DETECTION_INTERVAL_MS[props.quality],
  }))
)

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

// A teammate's camera that was busy or out of reach is tried again now and
// then; one that is paused or gone waits for its computer's next announcement.
// Its own timer: a failure sets this state and `status` in the same step, and
// the status watcher above clears `retryTimer` whenever status changes.
const REMOTE_RETRY_MS = 15_000
// A feed that stopped (this computer or its sender reconnected) tries again
// almost at once, showing "Connecting" rather than a failure.
const REMOTE_QUICK_RETRY_MS = 300
let remoteRetryTimer: ReturnType<typeof setTimeout> | null = null
const clearRemoteRetry = () => {
  if (remoteRetryTimer) clearTimeout(remoteRetryTimer)
  remoteRetryTimer = null
}
watch(remoteState, (value) => {
  if (value === "busy" || value === "unreachable") {
    clearRemoteRetry()
    remoteRetryTimer = setTimeout(() => start(), REMOTE_RETRY_MS)
  }
})

const detachRemote = () => {
  remoteHandle.value?.release()
  remoteHandle.value = null
}

const detach = () => {
  stopMuteWatch()
  handle?.release(releaseOptions())
  handle = null
  detachRemote()
  if (videoEl.value) videoEl.value.srcObject = null
}

const showStream = (stream: MediaStream) => {
  const element = videoEl.value
  if (element && element.srcObject !== stream) {
    element.srcObject = stream
    element.play().catch(() => {})
  }
}

/**
 * Shows a teammate's camera when that beats this computer's own (see
 * chooseCameraSource). True when it handled the slide, so the caller does not
 * open a camera here.
 */
const startRemote = async (mine: number, previous: CameraHandle | null) => {
  const data = props.data!
  const found = cameraShare.hostFor(data)
  const local = await localCameraMatch(data)
  if (mine !== token) {
    previous?.release(releaseOptions())
    return true
  }
  const source = chooseCameraSource(local, found)

  const fail = (state: RemoteCameraState, name = "") => {
    previous?.release(releaseOptions())
    detachRemote()
    if (videoEl.value) videoEl.value.srcObject = null
    remoteName.value = name
    remoteState.value = state
    status.value = "error"
    reportShareFailure(state)
  }

  if (source === "local" || !found) {
    if (!props.remoteOnly) {
      // Its sender went away and this computer does not have the camera
      // (or has never been allowed to look): wait for the sender to come
      // back rather than open, or ask permission for, a camera here.
      if (!found && lastRemoteName && (local === "unknown" || local === "none")) {
        fail("offline", lastRemoteName)
        return true
      }
      return false
    }
    // The camera is here but must stay closed, or it is nowhere.
    fail(local === "exact" || local === "label" ? "paused" : "missing")
    return true
  }
  if (!hasAccessToFeature("camera-share")) {
    fail("teams", found.host.userName)
    return true
  }
  if (found.host.paused) {
    fail("paused", found.host.userName)
    return true
  }

  remoteName.value = found.host.userName
  remoteState.value = null
  const wasShowing = !!remoteHandle.value
  if (!wasShowing) status.value = "connecting"
  const startedAt = performance.now()
  try {
    // The same camera again shares its connection, so nothing reconnects.
    const next = await cameraShare.acquireRemote(found)
    previous?.release(releaseOptions())
    if (mine !== token) {
      next.release()
      return true
    }
    detachRemote()
    remoteHandle.value = next
    if (!wasShowing) {
      usePosthogCapture("CAMERA_SHARE_CONNECTED", {
        surface: shareSurface.value,
        match: found.match,
        msToVideo: Math.round(performance.now() - startedAt),
        // Back after its sender or this computer dropped, not a first view.
        resumed: !!lastRemoteName,
      })
    }
    lastRemoteName = next.userName
    match.value = "exact"
    showStream(next.stream)
    next.onEnded(() => {
      if (remoteHandle.value !== next) return
      detachRemote()
      if (videoEl.value) videoEl.value.srcObject = null
      remoteState.value = null
      status.value = "connecting"
      clearRemoteRetry()
      remoteRetryTimer = setTimeout(() => start(), REMOTE_QUICK_RETRY_MS)
    })
    status.value = "live"
  } catch (error) {
    previous?.release(releaseOptions())
    if (mine !== token) return true
    fail(
      error instanceof RemoteCameraError ? error.state : "unreachable",
      found.host.userName
    )
  }
  return true
}

const attach = (next: CameraHandle) => {
  detachRemote()
  remoteState.value = null
  remoteName.value = ""
  handle = next
  next.setResolution(props.resolution)
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
    reportCameraFailure(props.quality, new CameraStreamError("missing"), props.data)
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
      reportCameraFailure(props.quality, new CameraStreamError("in-use"), props.data)
    }
    track.addEventListener("mute", onMute)
    stopMuteWatch = () => track.removeEventListener("mute", onMute)
  }
  status.value = "live"
}

const start = async () => {
  const mine = ++token
  // Whatever retry was waiting, this is it.
  clearRemoteRetry()
  stopMuteWatch()
  const previous = handle
  handle = null
  if (!props.data) {
    previous?.release(releaseOptions())
    status.value = "missing"
    return
  }
  if (allowsRemote.value && (await startRemote(mine, previous))) return
  if (mine !== token) {
    previous?.release(releaseOptions())
    return
  }
  remoteState.value = null
  remoteName.value = ""
  if (!previous) status.value = "connecting"
  try {
    // Acquire before releasing the old handle, so a re-resolve that lands on
    // the same device reuses its stream instead of reopening it.
    let next: CameraHandle
    try {
      next = await acquire(props.data, { assignedOnly: props.assignedOnly })
    } catch (error) {
      // Before permission the camera list has no names, so the stored id was
      // tried blind (ids differ between browsers and the desktop app). Ask
      // for permission, which names the cameras, then look again by name.
      if (!props.assignedOnly || cameraErrorState(error) !== "missing") throw error
      await listCameras()
      if (mine !== token) throw error
      next = await acquire(props.data, { assignedOnly: true })
    }
    previous?.release(releaseOptions())
    if (mine !== token) {
      next.release(releaseOptions())
      return
    }
    attach(next)
  } catch (error) {
    previous?.release(releaseOptions())
    if (mine !== token) return
    detachRemote()
    if (videoEl.value) videoEl.value.srcObject = null
    status.value = cameraErrorState(error)
    reportCameraFailure(props.quality, error, props.data)
  }
}

watch(
  () => [props.data?.deviceId, props.data?.deviceLabel],
  () => {
    lastRemoteName = ""
    start()
  }
)

watch(
  () => props.resolution,
  (resolution) => handle?.setResolution(resolution)
)

// A teammate's computer appearing, going, or pausing its camera.
watch(
  () => {
    if (!allowsRemote.value) return ""
    const found = cameraShare.hostFor(props.data)
    return found
      ? `${found.host.socketId}|${found.match}|${found.host.paused}`
      : ""
  },
  (now, before) => {
    if (now === before) return
    // Also while connecting: the teammates' list usually lands a moment after
    // the feed mounts, when it has already started on this computer's devices
    // (and may be waiting on a permission prompt it no longer needs).
    if (status.value !== "live" || match.value === "fallback" || remoteHandle.value) {
      start()
    }
  }
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
  clearRemoteRetry()
  stopDeviceWatch()
  detach()
})
</script>
