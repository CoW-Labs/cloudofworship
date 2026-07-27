import { computed, onUnmounted, ref } from "vue"
import { useAppStore } from "~/store/app"

export interface DestinationStatus {
  platform: string
  status: "pending" | "connecting" | "live" | "error"
  error?: string
}

export type YoutubeStreamingStatus =
  | "idle"
  | "requesting-media"
  | "connecting"
  | "live"
  | "error"
  | "ended"

interface YoutubeStreamingState {
  status: YoutubeStreamingStatus
  destinations: DestinationStatus[]
  error: string | null
  sessionId: string | null
}

const displayMediaOptions: DisplayMediaStreamOptions = {
  video: { displaySurface: "tab" } as MediaTrackConstraints,
  audio: { suppressLocalAudioPlayback: true } as MediaTrackConstraints,
  // @ts-expect-error — Chrome-only getDisplayMedia options, not yet in the DOM lib types
  preferCurrentTab: true,
  selfBrowserSurface: "include",
  systemAudio: "include",
  surfaceSwitching: "exclude",
  monitorTypeSurfaces: "exclude",
}

const ICE_GATHERING_TIMEOUT_MS = 10000
const STATUS_POLL_INTERVAL_MS = 3000
const MAX_CONSECUTIVE_POLL_FAILURES = 5

// All calls go through this app's own backend (see /streaming/* on the main
// API), which holds the streaming platform's per-church API key server-side
// and auto-provisions it on first use — the browser never sees that key at
// all, only this app's normal JWT auth (handled by useAPIFetch already).
export const useYoutubeStreaming = (options?: { onStatusChange?: (state: YoutubeStreamingState) => void }) => {
  const appStore = useAppStore()
  const toast = useToast()

  let pc: RTCPeerConnection | null = null
  let displayStream: MediaStream | null = null
  let micStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let micSourceNode: MediaStreamAudioSourceNode | null = null
  let gainNode: GainNode | null = null
  let audioDestNode: MediaStreamAudioDestinationNode | null = null
  let statusPollTimer: ReturnType<typeof setInterval> | null = null
  let consecutivePollFailures = 0
  let lastToastedError: string | null = null
  let stoppedIntentionally = false

  const state = ref<YoutubeStreamingState>({
    status: "idle",
    destinations: [],
    error: null,
    sessionId: null,
  })

  const status = computed(() => state.value.status)
  const destinations = computed(() => state.value.destinations)
  const error = computed(() => state.value.error)
  const sessionId = computed(() => state.value.sessionId)

  const emitStatusChange = () => {
    options?.onStatusChange?.(state.value)
  }

  const cleanup = () => {
    if (statusPollTimer) {
      clearInterval(statusPollTimer)
      statusPollTimer = null
    }
    consecutivePollFailures = 0
    lastToastedError = null

    if (pc) {
      try { pc.close() } catch { }
      pc = null
    }
    if (micSourceNode) {
      try { micSourceNode.disconnect() } catch { }
      micSourceNode = null
    }
    if (gainNode) {
      try { gainNode.disconnect() } catch { }
      gainNode = null
    }
    if (audioDestNode) {
      try { audioDestNode.disconnect() } catch { }
      audioDestNode = null
    }
    if (audioContext) {
      audioContext.close().catch(() => { })
      audioContext = null
    }
    if (displayStream) {
      displayStream.getTracks().forEach((t) => t.stop())
      displayStream = null
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop())
      micStream = null
    }

    window.removeEventListener("beforeunload", beforeUnloadHandler)
  }

  const beforeUnloadHandler = () => {
    // Best-effort only — the browser gives us no reliable way to await a
    // fetch here. If the DELETE doesn't land, the backend session simply
    // reads as stale/errored on its next status poll — not a crash risk.
    if (state.value.sessionId) {
      useAPIFetch(`/streaming/sessions/${state.value.sessionId}/ingest`, { method: "DELETE" }).catch(() => { })
    }
  }

  const pollStatus = async () => {
    if (!state.value.sessionId) return
    try {
      const { data, error: fetchError } = await useAPIFetch<{ data: { destinations: DestinationStatus[] } }>(
        `/streaming/sessions/${state.value.sessionId}`
      )
      if (fetchError.value) throw fetchError.value
      consecutivePollFailures = 0

      const dests: DestinationStatus[] = data.value?.data?.destinations || []
      state.value.destinations = dests

      const hasError = dests.some((d) => d.status === "error")
      const hasLive = dests.some((d) => d.status === "live")

      if (hasError) {
        state.value.status = "error"
        const errMessage = dests.find((d) => d.status === "error")?.error || "Streaming destination error"
        state.value.error = errMessage
        if (lastToastedError !== errMessage) {
          lastToastedError = errMessage
          toast.add({
            title: "Streaming error",
            description: errMessage,
            icon: "i-bx-error-circle",
            color: "red",
          })
        }
      } else if (hasLive) {
        state.value.status = "live"
        state.value.error = null
      } else {
        state.value.status = "connecting"
      }

      emitStatusChange()
    } catch {
      consecutivePollFailures++
      if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        state.value.status = "error"
        state.value.error = "Lost connection to streaming server"
        toast.add({
          title: "Lost connection to streaming server",
          icon: "i-bx-error-circle",
          color: "red",
        })
        emitStatusChange()
      }
    }
  }

  const start = async () => {
    stoppedIntentionally = false

    state.value.status = "requesting-media"
    state.value.error = null
    emitStatusChange()

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
    } catch (err: any) {
      state.value.status = "error"
      state.value.error = "Screen share permission denied"
      emitStatusChange()
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        toast.add({
          title: "Screen share permission denied",
          description: "Streaming needs permission to capture this tab",
          icon: "i-bx-error-circle",
          color: "red",
        })
      } else {
        toast.add({
          title: "Failed to start screen capture",
          icon: "i-bx-error-circle",
          color: "red",
        })
      }
      return
    }

    try {
      const deviceId = appStore.currentState.defaultMicrophoneId
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
    } catch (err: any) {
      displayStream?.getTracks().forEach((t) => t.stop())
      displayStream = null
      state.value.status = "error"
      state.value.error = "Microphone permission denied"
      emitStatusChange()
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        toast.add({
          title: "Microphone permission denied",
          description: "Streaming needs microphone access to include audio",
          icon: "i-bx-error-circle",
          color: "red",
        })
      } else {
        toast.add({
          title: "Failed to access microphone",
          icon: "i-bx-error-circle",
          color: "red",
        })
      }
      return
    }

    audioContext = new AudioContext()
    micSourceNode = audioContext.createMediaStreamSource(micStream)
    gainNode = audioContext.createGain()
    audioDestNode = audioContext.createMediaStreamDestination()
    micSourceNode.connect(gainNode)
    gainNode.connect(audioDestNode)

    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })

    displayStream.getVideoTracks().forEach((track) => pc!.addTrack(track, displayStream!))
    audioDestNode.stream.getAudioTracks().forEach((track) => pc!.addTrack(track, audioDestNode!.stream))

    pc.onconnectionstatechange = () => {
      if (stoppedIntentionally) return
      if (pc?.connectionState === "failed" || pc?.connectionState === "closed") {
        state.value.status = "error"
        state.value.error = "Connection to streaming server lost"
        emitStatusChange()
        toast.add({
          title: "Streaming connection lost",
          icon: "i-bx-error-circle",
          color: "red",
        })
        cleanup()
      }
    }

    try {
      const { data, error: fetchError } = await useAPIFetch<{ data: { id: string } }>("/streaming/sessions", {
        method: "POST",
      })
      if (fetchError.value || !data.value?.data?.id) throw fetchError.value || new Error("no session id returned")
      state.value.sessionId = data.value.data.id
    } catch {
      toast.add({
        title: "Failed to create streaming session",
        icon: "i-bx-error-circle",
        color: "red",
      })
      state.value.status = "error"
      state.value.error = "Failed to create streaming session"
      emitStatusChange()
      cleanup()
      return
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      await new Promise<void>((resolve, reject) => {
        if (pc!.iceGatheringState === "complete") {
          resolve()
          return
        }
        const timeout = setTimeout(() => {
          pc?.removeEventListener("icegatheringstatechange", onChange)
          reject(new Error("ICE gathering timed out"))
        }, ICE_GATHERING_TIMEOUT_MS)
        const onChange = () => {
          if (pc?.iceGatheringState === "complete") {
            clearTimeout(timeout)
            pc?.removeEventListener("icegatheringstatechange", onChange)
            resolve()
          }
        }
        pc!.addEventListener("icegatheringstatechange", onChange)
      })

      const { data: answerSdp, error: ingestError } = await useAPIFetch<string>(
        `/streaming/sessions/${state.value.sessionId}/ingest`,
        {
          method: "POST",
          body: pc.localDescription!.sdp,
          headers: { "Content-Type": "application/sdp" },
          responseType: "text",
        }
      )
      if (ingestError.value || !answerSdp.value) throw ingestError.value || new Error("no answer sdp returned")
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp.value })
    } catch {
      toast.add({
        title: "Failed to connect to streaming server",
        icon: "i-bx-error-circle",
        color: "red",
      })
      state.value.status = "error"
      state.value.error = "Failed to negotiate streaming connection"
      emitStatusChange()
      cleanup()
      return
    }

    state.value.status = "connecting"
    emitStatusChange()

    window.addEventListener("beforeunload", beforeUnloadHandler)

    statusPollTimer = setInterval(pollStatus, STATUS_POLL_INTERVAL_MS)
    pollStatus()
  }

  const stop = async () => {
    stoppedIntentionally = true
    const currentSessionId = state.value.sessionId
    if (currentSessionId) {
      try {
        await useAPIFetch(`/streaming/sessions/${currentSessionId}/ingest`, { method: "DELETE" })
      } catch {
        // best-effort teardown, ignore failure
      }
    }
    cleanup()
    state.value.status = "ended"
    emitStatusChange()
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    status,
    destinations,
    error,
    sessionId,
    start,
    stop,
  }
}
