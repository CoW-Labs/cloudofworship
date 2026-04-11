import { ref, computed, onUnmounted } from 'vue'
import { useAppStore } from '~/store/app'
import { useAuthStore } from '~/store/auth'
import type { TranscriptSegment, BibleReference } from '~/types/transcript'
import { appWideActions } from '~/utils/constants'

interface TranscriptionState {
  isTranscribing: boolean
  isConnecting: boolean
  error: string | null
  segments: TranscriptSegment[]
  currentTranscript: string
  remainingSeconds: number | null
  usedSeconds: number
}

/**
 * Composable for Deepgram-powered real-time transcription (Teams plan only).
 * Streams microphone audio to the backend WebSocket proxy which relays to Deepgram.
 * Enforces a 60-minute-per-week limit server-side.
 */
export default function useDeepgramTranscription() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const config = useRuntimeConfig()

  const state = ref<TranscriptionState>({
    isTranscribing: false,
    isConnecting: false,
    error: null,
    segments: [],
    currentTranscript: '',
    remainingSeconds: null,
    usedSeconds: 0,
  })

  // Microphone loudness level, 0–100, updated every audio frame
  const micLevel = ref(0)

  let ws: WebSocket | null = null
  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let processorNode: ScriptProcessorNode | null = null
  let sessionStartTime: number | null = null
  let sessionElapsedTimer: ReturnType<typeof setInterval> | null = null
  let usageSyncTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Detect voice commands in the transcript
   */
  const detectVoiceCommand = (text: string): 'next-verse' | 'previous-verse' | null => {
    const lowerText = text.toLowerCase().trim()
    if (
      lowerText.includes('next verse') ||
      lowerText.includes('next first') ||
      lowerText === 'next' ||
      lowerText.includes('go to next verse') ||
      lowerText.includes('go next verse')
    ) {
      return 'next-verse'
    }
    if (
      lowerText.includes('previous verse') ||
      lowerText.includes('last verse') ||
      lowerText.includes('go back') ||
      lowerText.includes('go to previous verse') ||
      lowerText.includes('go to last verse') ||
      lowerText.includes('go previous verse')
    ) {
      return 'previous-verse'
    }
    return null
  }

  const executeVoiceCommand = (command: 'next-verse' | 'previous-verse') => {
    if (command === 'next-verse') {
      useGlobalEmit(appWideActions.nextVerse)
    } else if (command === 'previous-verse') {
      useGlobalEmit(appWideActions.previousVerse)
    }
  }

  const createSegmentFromText = (text: string) => {
    if (!text.trim()) return
    const cleanedText = text.trim()
    const voiceCommand = detectVoiceCommand(cleanedText)
    if (voiceCommand) executeVoiceCommand(voiceCommand)

    const references = useBibleReferenceParser(cleanedText)
    const segment: TranscriptSegment = {
      id: useObjectID(),
      text: cleanedText,
      timestamp: Date.now(),
      bibleReferences: references,
    }
    state.value.segments.push(segment)
    state.value.currentTranscript = ''
  }

  /**
   * Build the WebSocket URL pointing to our backend proxy.
   * Converts http(s) base URL → ws(s).
   */
  const buildWsUrl = (churchId: string): string => {
    const baseUrl = (config.public.BASE_URL as string) || ''
    // e.g. https://api.cloudofworship.com/api/v1 → wss://api.cloudofworship.com/api/v1
    const wsBase = baseUrl.replace(/^http/, 'ws')
    const token = useAuthToken().getToken()
    return `${wsBase}/church/${churchId}/transcription/stream?token=${token}`
  }

  /**
   * Convert Float32 PCM samples to Int16 for Deepgram (linear16 encoding).
   */
  const float32ToInt16 = (float32Array: Float32Array): ArrayBuffer => {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i] ?? 0))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array.buffer
  }

  /**
   * Fetch the current weekly usage from the API.
   */
  const fetchUsage = async () => {
    const churchId = authStore.user?.churchId
    if (!churchId) return
    try {
      const { data } = await useAPIFetch(`/church/${churchId}/transcription/usage`)
      if (data.value) {
        const usage = data.value as { used: number; remaining: number; limit: number }
        state.value.remainingSeconds = usage.remaining
        state.value.usedSeconds = usage.used
      }
    } catch (err) {
      console.error('Failed to fetch transcription usage:', err)
    }
  }

  /**
   * Start Deepgram transcription session.
   */
  const startTranscription = async () => {
    if (state.value.isTranscribing) {
      toast.add({ title: 'Already transcribing', icon: 'i-bx-info-circle' })
      return
    }

    const churchId = authStore.user?.churchId
    if (!churchId) {
      toast.add({ title: 'Church not found', icon: 'i-bx-error', color: 'red' })
      return
    }

    state.value.isConnecting = true
    state.value.error = null

    // Request mic permission
    try {
      const deviceId = appStore.currentState.defaultMicrophoneId
      const audioConstraint: MediaStreamConstraints['audio'] = deviceId
        ? { deviceId: { exact: deviceId } }
        : true
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint })
    } catch {
      state.value.isConnecting = false
      state.value.error = 'Microphone permission denied'
      toast.add({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use transcription',
        icon: 'i-bx-error',
        color: 'red',
      })
      return
    }

    // Connect to backend WebSocket proxy
    try {
      const wsUrl = buildWsUrl(churchId)
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        // Audio capture starts once the server sends "ready"
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'ready') {
            // Server is connected to Deepgram – start capturing audio
            state.value.remainingSeconds = msg.remainingSeconds
            state.value.isTranscribing = true
            state.value.isConnecting = false
            sessionStartTime = Date.now()

            sessionElapsedTimer = setInterval(() => {
              if (state.value.remainingSeconds !== null && state.value.remainingSeconds > 0) {
                state.value.remainingSeconds--
                state.value.usedSeconds++
              }
            }, 1000)

            // Re-sync remaining time from the server every 60 s to prevent drift
            usageSyncTimer = setInterval(() => {
              fetchUsage()
            }, 60_000)

            startAudioCapture()
          } else if (msg.type === 'transcript') {
            if (msg.isFinal || msg.speechFinal) {
              createSegmentFromText(msg.transcript)
            } else {
              state.value.currentTranscript = msg.transcript
            }
          } else if (msg.type === 'limit_reached') {
            toast.add({
              title: 'Weekly limit reached',
              description: 'Your 60-minute weekly AI transcription limit has been reached. It resets on Monday.',
              icon: 'i-bx-time',
              color: 'amber',
              timeout: 8000,
            })
            stopTranscription()
          } else if (msg.type === 'error') {
            state.value.error = msg.message
            toast.add({
              title: 'Transcription error',
              description: msg.message,
              icon: 'i-bx-error',
              color: 'red',
            })
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err)
        }
      }

      ws.onerror = () => {
        state.value.error = 'WebSocket connection error'
        state.value.isConnecting = false
        toast.add({
          title: 'Connection error',
          description: 'Failed to connect to transcription service',
          icon: 'i-bx-error',
          color: 'red',
        })
        cleanup()
      }

      ws.onclose = () => {
        if (state.value.isTranscribing || state.value.isConnecting) {
          cleanup()
          state.value.isTranscribing = false
          state.value.isConnecting = false
        }
      }
    } catch (err: any) {
      state.value.isConnecting = false
      state.value.error = err.message
      toast.add({
        title: 'Failed to start transcription',
        description: err.message,
        icon: 'i-bx-error',
        color: 'red',
      })
      cleanup()
    }
  }

  /**
   * Start capturing microphone audio and streaming it over the WebSocket.
   */
  const startAudioCapture = () => {
    if (!mediaStream || !ws) return

    audioContext = new AudioContext({ sampleRate: 16000 })
    const source = audioContext.createMediaStreamSource(mediaStream)
    // ScriptProcessorNode is deprecated but still broadly supported and avoids
    // AudioWorklet complexity. Buffer size 4096 gives good latency vs. overhead balance.
    processorNode = audioContext.createScriptProcessor(4096, 1, 1)

    processorNode.onaudioprocess = (e) => {
      const pcmData = e.inputBuffer.getChannelData(0)

      // Compute RMS loudness and map to 0–100
      let sum = 0
      for (let i = 0; i < pcmData.length; i++) {
        sum += (pcmData[i] ?? 0) * (pcmData[i] ?? 0)
      }
      const rms = Math.sqrt(sum / pcmData.length)
      // RMS of speech typically peaks around 0.3; clamp and scale to 0–100
      micLevel.value = Math.min(100, Math.round((rms / 0.3) * 100))

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(float32ToInt16(pcmData))
      }
    }

    source.connect(processorNode)
    processorNode.connect(audioContext.destination)
  }

  /**
   * Stop the current transcription session.
   */
  const stopTranscription = () => {
    if (!state.value.isTranscribing && !state.value.isConnecting) return

    if (state.value.currentTranscript.trim()) {
      createSegmentFromText(state.value.currentTranscript)
    }

    cleanup()
    state.value.isTranscribing = false
    state.value.isConnecting = false

    // Refresh usage from server after stopping
    fetchUsage()
  }

  /**
   * Release all resources.
   */
  const cleanup = () => {
    if (sessionElapsedTimer) {
      clearInterval(sessionElapsedTimer)
      sessionElapsedTimer = null
    }

    if (usageSyncTimer) {
      clearInterval(usageSyncTimer)
      usageSyncTimer = null
    }

    if (processorNode) {
      processorNode.disconnect()
      processorNode = null
    }

    if (audioContext) {
      audioContext.close().catch(() => { })
      audioContext = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }

    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      ws = null
    }

    micLevel.value = 0

    sessionStartTime = null
  }

  const clearTranscript = () => {
    state.value.segments = []
    state.value.currentTranscript = ''
    toast.add({ title: 'Transcript cleared', icon: 'i-bx-trash' })
  }

  const allBibleReferences = computed(() => {
    const refs: BibleReference[] = []
    for (const segment of state.value.segments) {
      refs.push(...segment.bibleReferences)
    }
    return refs
  })

  const remainingMinutes = computed(() => {
    if (state.value.remainingSeconds === null) return null
    return Math.floor(state.value.remainingSeconds / 60)
  })

  const usedMinutes = computed(() => Math.floor(state.value.usedSeconds / 60))

  // Fetch usage on composable initialisation
  fetchUsage()

  onUnmounted(() => {
    cleanup()
  })

  return {
    isTranscribing: computed(() => state.value.isTranscribing),
    isConnecting: computed(() => state.value.isConnecting),
    error: computed(() => state.value.error),
    segments: computed(() => state.value.segments),
    currentTranscript: computed(() => state.value.currentTranscript),
    remainingSeconds: computed(() => state.value.remainingSeconds),
    usedSeconds: computed(() => state.value.usedSeconds),
    remainingMinutes,
    usedMinutes,
    allBibleReferences,
    micLevel: computed(() => micLevel.value),

    startTranscription,
    stopTranscription,
    clearTranscript,
    fetchUsage,
  }
}
