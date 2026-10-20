// Frontend control for the desktop (Tauri) YouTube streaming feature. Talks to
// the Rust `stream` module's stream_start/stream_stop/stream_status commands and
// listens on the `stream://status` event. Mirrors useNdiBroadcast's shape:
// module-shared reactive state (so the panel and any indicator stay in sync),
// desktop-only, dynamic Tauri imports so it's a no-op in the plain web build.
//
// The "live-window" source captures the live output window's real content.
// On macOS Rust captures it natively by window ID (no picker). Where that isn't
// available yet, the page captures it instead (getDisplayMedia — the OS window
// picker), records it with the chosen audio input (MediaRecorder) and streams
// the recording to Rust. Either way FFmpeg encodes and pushes it to YouTube,
// and the capture follows the window, not a spot on the screen.

export type StreamPhase = "idle" | "live" | "reconnecting" | "error"
export type StreamSource = "live-window" | "screen" | "test"

export interface StreamStatus {
  phase: StreamPhase
  error: string | null
}

export interface AudioDevice {
  index: string
  name: string
}

const idleStatus = (): StreamStatus => ({ phase: "idle", error: null })

const messageOf = (error: unknown): string =>
  typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "Streaming failed unexpectedly."

// One shared status listener across all callers (the event is app-wide).
let sharedStatusListener: Promise<void> | null = null

// The operator's stream setup survives restarts. It stays on this device only
// (the settings panel says so) — never synced to the account.
const SETTINGS_KEY = "cow-youtube-stream-settings"
interface SavedSettings {
  streamKey?: string
  streamOnGoLive?: boolean
  audioDevice?: string | null
  source?: StreamSource
}
let settingsHydrated = false

const readSavedSettings = (): SavedSettings => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as SavedSettings
  } catch {
    return {}
  }
}

// The running in-page capture (one per app), kept outside reactive state.
interface Capture {
  recorder: MediaRecorder
  tracks: MediaStreamTrack[]
}
let capture: Capture | null = null

const stopCapture = () => {
  const current = capture
  capture = null
  if (!current) return
  if (current.recorder.state !== "inactive") current.recorder.stop()
  current.tracks.forEach((track) => track.stop())
}

// WebKit records fragmented MP4 (hardware H.264); Chromium-based webviews
// (Windows) record WebM. FFmpeg autodetects either.
const RECORDING_TYPES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm",
]

const pickRecordingType = () =>
  RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))

// getDisplayMedia must come from a click; when Go Live's window opening has
// used up that click, the caller offers a button instead (see needsPicker).
const isGestureError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "InvalidAccessError" || /gesture/i.test(error.message))

export const useYoutubeStream = () => {
  const { isTauri } = useTauri()
  const isDesktop = isTauri && import.meta.client

  const status = useState<StreamStatus>("yt-stream-status", idleStatus)
  const isInvoking = useState<boolean>("yt-stream-pending", () => false)
  const streamKey = useState<string>("yt-stream-key", () => "")
  const source = useState<StreamSource>("yt-stream-source", () => "live-window")
  // When true, going live (opening the projection window) also starts the
  // YouTube stream automatically — one action, no separate trip to the panel.
  const streamOnGoLive = useState<boolean>("yt-stream-on-go-live", () => false)
  const audioDevices = useState<AudioDevice[]>("yt-stream-audio-devices", () => [])
  // The chosen audio input's index; "" means "no audio", null means "default".
  const audioDevice = useState<string | null>("yt-stream-audio-device", () => null)
  // True when starting failed only because the window picker needs a fresh
  // click; the UI then shows a "choose the live window" button.
  const needsPicker = useState<boolean>("yt-stream-needs-picker", () => false)

  if (isDesktop && !settingsHydrated) {
    settingsHydrated = true
    const saved = readSavedSettings()
    if (typeof saved.streamKey === "string") streamKey.value = saved.streamKey
    if (typeof saved.streamOnGoLive === "boolean") streamOnGoLive.value = saved.streamOnGoLive
    if (saved.audioDevice !== undefined) audioDevice.value = saved.audioDevice
    if (saved.source === "live-window" || saved.source === "test") source.value = saved.source
    watch([streamKey, streamOnGoLive, audioDevice, source], () => {
      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            streamKey: streamKey.value,
            streamOnGoLive: streamOnGoLive.value,
            audioDevice: audioDevice.value,
            source: source.value,
          } satisfies SavedSettings)
        )
      } catch {
        // Storage can be unavailable; the settings then last for this session.
      }
    })
  }

  const hasStreamKey = computed(() => !!streamKey.value.trim())

  // Reconnecting still counts as an active session (show Stop, not Go live).
  const isStreaming = computed(
    () => status.value.phase === "live" || status.value.phase === "reconnecting"
  )

  // Raw bytes (a Uint8Array) are sent as a binary IPC body, not JSON.
  const invokeTauri = async <T>(command: string, args?: Record<string, unknown> | Uint8Array) => {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(command, args)
  }

  const listAudioDevices = async () => {
    if (!isDesktop) return
    try {
      audioDevices.value = await invokeTauri<AudioDevice[]>("stream_audio_devices")
      // Drop a stale selection that no longer matches a connected device.
      if (
        audioDevice.value &&
        audioDevice.value !== "" &&
        !audioDevices.value.some((d) => d.index === audioDevice.value)
      ) {
        audioDevice.value = null
      }
    } catch (error) {
      console.error("Failed to list audio devices:", error)
    }
  }

  const initialize = async () => {
    if (!isDesktop) return
    try {
      if (!sharedStatusListener) {
        sharedStatusListener = import("@tauri-apps/api/event")
          .then(({ listen }) =>
            listen<StreamStatus>("stream://status", (message) => {
              status.value = message.payload
              // The backend ended the session (gave up, or the feed broke):
              // release the window capture and the microphone too.
              if (message.payload.phase === "idle" || message.payload.phase === "error") {
                stopCapture()
              }
            })
          )
          .then(() => undefined)
          .catch((error) => {
            sharedStatusListener = null
            throw error
          })
      }
      await sharedStatusListener
      status.value = await invokeTauri<StreamStatus>("stream_status")
      await listAudioDevices()
    } catch (error) {
      console.error("Failed to initialize YouTube stream status:", error)
    }
  }

  // The selected input as a browser audio track. The picker lists FFmpeg's
  // device names, which match the browser's device labels, so map by name.
  const openAudio = async (): Promise<MediaStreamTrack | null> => {
    if (audioDevice.value === "") return null
    const constraints: MediaTrackConstraints = {
      // Worship audio is music: keep the browser's voice-call processing off.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
    const wanted = audioDevices.value.find((d) => d.index === audioDevice.value)?.name
    if (wanted) {
      // Labels are only visible after a permission grant, so ask once first.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach((track) => track.stop())
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audioinput"
      )
      const match =
        inputs.find((d) => d.label === wanted) ??
        inputs.find((d) => d.label.includes(wanted) || wanted.includes(d.label))
      if (match) constraints.deviceId = { exact: match.deviceId }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
    return stream.getAudioTracks()[0] ?? null
  }

  // Captures the live window in-page and streams the recording to the backend.
  const startLiveWindowCapture = async () => {
    const recordingType = typeof MediaRecorder !== "undefined" && pickRecordingType()
    if (!recordingType || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("This app version can't record the live window.")
    }

    let video: MediaStream
    try {
      video = await navigator.mediaDevices.getDisplayMedia({
        // A hint only: browsers still let the operator pick a whole screen.
        video: { frameRate: 30, displaySurface: "window" } as MediaTrackConstraints,
        audio: false,
      })
    } catch (error) {
      if (isGestureError(error)) {
        needsPicker.value = true
        throw new Error("Choose the live output window to start the YouTube stream.")
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error("Window sharing was cancelled, so the stream didn't start.")
      }
      throw error
    }
    // A whole-screen share streams everything the operator does (switching
    // desktops, other apps), so insist on the live window itself.
    const surface = (video.getVideoTracks()[0]?.getSettings() as { displaySurface?: string })
      ?.displaySurface
    if (surface === "monitor") {
      video.getTracks().forEach((track) => track.stop())
      needsPicker.value = true
      throw new Error(
        "That shared the whole screen. Choose the “Cloud of Worship - Live Output” window instead."
      )
    }
    needsPicker.value = false

    const tracks = [...video.getVideoTracks()]
    try {
      const audio = await openAudio()
      if (audio) tracks.push(audio)
    } catch (error) {
      tracks.forEach((track) => track.stop())
      throw new Error(`Couldn't open the audio input: ${messageOf(error)}`)
    }

    const started = await invokeTauri<StreamStatus>("stream_start", {
      streamKey: streamKey.value,
      source: "browser",
      audioDevice: null,
    }).catch((error) => {
      tracks.forEach((track) => track.stop())
      throw error
    })

    const recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: recordingType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    })
    // Chunks must reach FFmpeg in order, so each send waits for the previous.
    let sending = Promise.resolve()
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return
      sending = sending
        .then(async () => {
          if (capture?.recorder !== recorder) return
          const bytes = new Uint8Array(await event.data.arrayBuffer())
          await invokeTauri("stream_feed", bytes)
        })
        .catch((error) => console.warn("YouTube feed chunk failed:", error))
    }
    // The operator clicked "Stop sharing" in the OS: that ends the broadcast.
    video.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (capture?.recorder === recorder) end()
    })

    capture = { recorder, tracks }
    recorder.start(250)
    return started
  }

  // Native capture by window ID; falls back to the in-page picker capture on
  // systems where the backend doesn't support it yet.
  const startNativeWindowCapture = async () => {
    try {
      return await invokeTauri<StreamStatus>("stream_start", {
        streamKey: streamKey.value,
        source: "native-window",
        audioDevice: audioDevice.value,
      })
    } catch (error) {
      if (!messageOf(error).includes("isn't available on this OS")) throw error
      return startLiveWindowCapture()
    }
  }

  const start = async () => {
    if (!isDesktop) return status.value
    isInvoking.value = true
    try {
      stopCapture()
      if (source.value === "live-window") {
        status.value = await startNativeWindowCapture()
      } else {
        status.value = await invokeTauri<StreamStatus>("stream_start", {
          streamKey: streamKey.value,
          source: source.value,
          audioDevice: audioDevice.value,
        })
      }
    } catch (error) {
      stopCapture()
      status.value = { phase: "error", error: messageOf(error) }
    } finally {
      isInvoking.value = false
    }
    return status.value
  }

  const stop = async () => {
    if (!isDesktop) return status.value
    isInvoking.value = true
    needsPicker.value = false
    stopCapture()
    try {
      status.value = await invokeTauri<StreamStatus>("stream_stop")
    } catch (error) {
      status.value = { phase: "error", error: messageOf(error) }
    } finally {
      isInvoking.value = false
    }
    return status.value
  }

  // Ending the broadcast is one action for the operator: it closes the live
  // window too, and closing the live window stops the stream (app layout).
  // A test-pattern run has no window to close, so it just stops.
  const end = () => {
    if (source.value === "test") return void stop()
    useGlobalEmit(appWideActions.closeLiveWindow)
  }

  return {
    status: readonly(status),
    isInvoking: readonly(isInvoking),
    isStreaming,
    streamKey,
    hasStreamKey,
    source,
    streamOnGoLive,
    audioDevices,
    audioDevice,
    needsPicker: readonly(needsPicker),
    listAudioDevices,
    initialize,
    start,
    stop,
    end,
  }
}
