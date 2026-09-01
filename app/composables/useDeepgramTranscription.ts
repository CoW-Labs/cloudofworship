import { ref, computed, onUnmounted } from 'vue'
import { useAppStore } from '~/store/app'
import { useAuthStore } from '~/store/auth'
import { prewarmScriptureVersion } from '~/composables/useScripture'
import type { TranscriptSegment, BibleReference } from '~/types/transcript'
import { appWideActions } from '~/utils/constants'
import { planVoiceCommand } from '~/utils/voiceCommands'

interface TranscriptionState {
  isTranscribing: boolean
  isConnecting: boolean
  error: string | null
  segments: TranscriptSegment[]
  currentTranscript: string
  remainingSeconds: number | null
  usedSeconds: number
}

interface ReferenceMessageMeta {
  isFinal?: boolean
  speechFinal?: boolean
  provisional?: boolean
  receivedAt?: number
  sentAt?: number
}

/**
 * Composable for Deepgram-powered real-time transcription (Teams plan only).
 *
 * Streams microphone audio to the backend WebSocket proxy which relays to
 * Deepgram, then pushes back four kinds of messages over the same connection:
 *   - transcript  (interim + final)
 *   - references  (Bible refs parsed server-side, on each final segment)
 *   - scriptures  (semantic matches; ignored client-side — TranscriptsPanel
 *                  runs its own HTTP scripture search keyed to displayed segments)
 *   - limit_reached / error
 *
 * Performance/reliability features:
 *   - AudioWorklet capture (off the main thread, 32 ms chunks)
 *   - KeepAlive frames during silence to prevent Deepgram timeouts
 *   - Voice commands fire on interim results with a fire-once latch
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

  const micLevel = ref(0)

  let ws: WebSocket | null = null
  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  // Allow either an AudioWorkletNode (preferred) or a ScriptProcessorNode (fallback)
  let workletNode: AudioWorkletNode | ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let sessionElapsedTimer: ReturnType<typeof setInterval> | null = null
  let usageSyncTimer: ReturnType<typeof setInterval> | null = null
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null
  let lastAudioSentAt = 0

  // Track navigation and version independently. Deepgram sends cumulative
  // interim text, so "next verse" may later become "next verse in NIV". The
  // latter should add the version without navigating a second time.
  let lastFiredNavigation: string | null = null
  let lastNavigationFiredAt = 0
  let lastFiredVersion: string | null = null
  let lastVersionFiredAt = 0
  const COMMAND_COOLDOWN_MS = 1500

  // Auto-live cooldown — prevents rapid-fire slide switches when the preacher
  // mentions several references in quick succession.
  let lastAutoLiveAt = 0
  let lastAutoLiveReference: string | null = null
  const AUTO_LIVE_COOLDOWN_MS = 1500

  const getAvailableBibleVersionsForVoice = () => {
    const settings = appStore.currentState.settings
    const availableVersions =
      settings.bibleVersions?.filter((version) =>
        version?.isDownloaded || version?.id === settings.defaultBibleVersion
      ) || []

    if (
      settings.defaultBibleVersion &&
      !availableVersions.some((version) => version?.id === settings.defaultBibleVersion)
    ) {
      availableVersions.push({
        id: settings.defaultBibleVersion,
        name: settings.defaultBibleVersion,
        isDownloaded: true,
      })
    }

    return availableVersions
  }

  /**
   * Fire the matching command, with a debounce so the same interim text
   * doesn't trigger repeatedly. Reset the latch when text changes substantially.
   */
  const maybeFireVoiceCommand = (text: string) => {
    if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return

    const plan = planVoiceCommand(text, {
      availableVersions: getAvailableBibleVersionsForVoice(),
      versionCommandsEnabled:
        appStore.currentState.settings.transcriptionVoiceBibleVersionCommands ?? true,
    })

    if (!plan) {
      lastFiredNavigation = null
      lastFiredVersion = null
      return
    }

    const now = Date.now()
    const navigationAlreadyFired =
      !!plan.navigationKey &&
      plan.navigationKey === lastFiredNavigation &&
      now - lastNavigationFiredAt < COMMAND_COOLDOWN_MS
    const versionAlreadyFired =
      !!plan.version &&
      plan.version === lastFiredVersion &&
      now - lastVersionFiredAt < COMMAND_COOLDOWN_MS

    // A navigation action carries any named version with it so the operator
    // window can move and switch translation in a single slide update.
    if (plan.navigationKey && !navigationAlreadyFired) {
      lastFiredNavigation = plan.navigationKey
      lastNavigationFiredAt = now
      if (plan.version) {
        lastFiredVersion = plan.version
        lastVersionFiredAt = now
      }

      if (plan.action === 'goto-verse-number') {
        useGlobalEmit(appWideActions.gotoVerseNumber, {
          verseNumber: plan.verseNumber,
          version: plan.version,
        })
      } else if (plan.action === 'next-verse') {
        useGlobalEmit(appWideActions.nextVerse, { version: plan.version })
      } else if (plan.action === 'previous-verse') {
        useGlobalEmit(appWideActions.previousVerse, { version: plan.version })
      }
      return
    }

    // If an earlier interim already moved the slide, apply only the version
    // newly discovered in the expanded transcript.
    if (plan.version && !versionAlreadyFired) {
      lastFiredVersion = plan.version
      lastVersionFiredAt = now
      useGlobalEmit(appWideActions.changeBibleVersion, plan.version)
    }
  }

  const createSegmentFromText = (text: string, refsFromServer?: BibleReference[]) => {
    if (!text?.trim()) return
    const cleaned = text?.trim()

    // Server-parsed references are authoritative when present.
    // Fall back to the client parser only if the server didn't send any —
    // useful during dev/local where the backend may be older.
    const references = refsFromServer && refsFromServer.length > 0
      ? refsFromServer
      : useBibleReferenceParser(cleaned)

    state.value.segments.push({
      id: useObjectID(),
      text: cleaned,
      timestamp: Date.now(),
      bibleReferences: references,
    })
    state.value.currentTranscript = ''
  }

  /**
   * Apply references parsed by the server into the most-recent matching segment
   * and automatically go live with the first reference detected.
   *
   * A cooldown prevents rapid-fire slide switches when multiple references are
   * mentioned in quick succession.
   */
  const applyServerReferences = (references: BibleReference[], meta: ReferenceMessageMeta = {}) => {
    if (!references?.length) return

    const lastSegment = state.value.segments[state.value.segments.length - 1]
    if (lastSegment) {
      lastSegment.bibleReferences = references
    }

    // Auto go-live with the first reference if cooldown has elapsed. Repeated
    // interim pushes for the same reference are ignored locally, while a later
    // final result that corrects the provisional reference is allowed through.
    const firstReference = references[0]
    if (!firstReference) return

    const nextReference = firstReference.shortLabel
    const isDuplicateReference = nextReference === lastAutoLiveReference
    if (isDuplicateReference) return
    if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return

    const now = Date.now()
    const isFinalCorrection = !meta.provisional && !!lastAutoLiveReference
    if (isFinalCorrection || now - lastAutoLiveAt >= AUTO_LIVE_COOLDOWN_MS) {
      lastAutoLiveAt = now
      lastAutoLiveReference = nextReference
      useGlobalEmit(appWideActions.updateOrCreateBible, nextReference)
    }
  }

  const buildWsUrl = (churchId: string): string => {
    const baseUrl = (config.public.BASE_URL as string) || ''
    const wsBase = baseUrl.replace(/^http/, 'ws')
    const token = useAuthToken().getToken()
    return `${wsBase}/church/${churchId}/transcription/stream?token=${token}`
  }

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

    try {
      const wsUrl = buildWsUrl(churchId)
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'ready') {
            state.value.remainingSeconds = msg.remainingSeconds
            state.value.isTranscribing = true
            state.value.isConnecting = false

            // Pre-warm the selected scripture version so the first auto-live
            // reference hits a hot cache instead of paying the IndexedDB/index
            // build cost on the critical path.
            prewarmScriptureVersion().catch(() => { })

            sessionElapsedTimer = setInterval(() => {
              if (state.value.remainingSeconds !== null && state.value.remainingSeconds > 0) {
                state.value.remainingSeconds--
                state.value.usedSeconds++
              }
            }, 1000)

            usageSyncTimer = setInterval(fetchUsage, 60_000)

            // KeepAlive — every 5s of true silence, send a frame so Deepgram
            // doesn't time out the upstream socket.
            keepAliveTimer = setInterval(() => {
              if (ws?.readyState !== WebSocket.OPEN) return
              if (Date.now() - lastAudioSentAt > 5_000) {
                ws.send(JSON.stringify({ type: 'KeepAlive' }))
              }
            }, 5_000)

            startAudioCapture()
          } else if (msg.type === 'transcript') {
            if (msg.isFinal || msg.speechFinal) {
              // Some short commands arrive as final-only results, so run the
              // same latched detector here as well as on interim text.
              maybeFireVoiceCommand(msg.transcript ?? '')
              createSegmentFromText(msg.transcript ?? '')
            } else {
              state.value.currentTranscript = msg.transcript ?? ''
              // Fire voice commands on interim for snappy response
              maybeFireVoiceCommand(msg.transcript ?? '')
            }
          } else if (msg.type === 'references') {
            applyServerReferences(msg.references, {
              isFinal: msg.isFinal,
              speechFinal: msg.speechFinal,
              provisional: msg.provisional,
              receivedAt: msg.receivedAt,
              sentAt: msg.sentAt,
            })
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
   * Start AudioWorklet-based capture. The processor runs on a dedicated audio
   * thread and posts ~32 ms Int16 PCM chunks to the main thread, which forwards
   * them over the WebSocket.
   */
  const startAudioCapture = async () => {
    if (!mediaStream || !ws) return

    audioContext = new AudioContext({ sampleRate: 16000 })

    try {
      await audioContext.audioWorklet.addModule('/audio-worklets/transcription-pcm-processor.js')
    } catch (err) {
      console.error('Failed to load AudioWorklet, falling back to ScriptProcessorNode:', err)
      startAudioCaptureFallback()
      return
    }

    // Guard: cleanup() may have nulled these while addModule was awaiting
    if (!audioContext || !mediaStream) return

    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    workletNode = new AudioWorkletNode(audioContext, 'transcription-pcm-processor')

    workletNode.port.onmessage = (e) => {
      const { audio, rms } = e.data as { audio: ArrayBuffer; rms: number }
      // RMS of speech peaks around 0.3 — clamp and scale to 0–100
      micLevel.value = Math.min(100, Math.round((rms / 0.3) * 100))

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(audio)
        lastAudioSentAt = Date.now()
      }
    }

    sourceNode.connect(workletNode)
    // We don't connect to destination — we don't want to play the mic back
  }

  /**
   * Legacy ScriptProcessorNode capture — kept for older browsers that lack
   * AudioWorklet (rare; Chrome/Edge/Firefox/Safari have all shipped it for years).
   */
  const startAudioCaptureFallback = () => {
    if (!mediaStream || !ws || !audioContext) return

    const source = audioContext.createMediaStreamSource(mediaStream)
    const processor = audioContext.createScriptProcessor(2048, 1, 1)

    processor.onaudioprocess = (e) => {
      const pcmData = e.inputBuffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < pcmData.length; i++) sum += (pcmData[i] ?? 0) ** 2
      const rms = Math.sqrt(sum / pcmData.length)
      micLevel.value = Math.min(100, Math.round((rms / 0.3) * 100))

      const int16 = new Int16Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) {
        const s = Math.max(-1, Math.min(1, pcmData[i] ?? 0))
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(int16.buffer)
        lastAudioSentAt = Date.now()
      }
    }

    source.connect(processor)
    processor.connect(audioContext.destination)
    // Store on the same slots used by the teardown path
    workletNode = processor
    sourceNode = source
  }

  const stopTranscription = () => {
    if (!state.value.isTranscribing && !state.value.isConnecting) return

    if ((state.value.currentTranscript ?? '')?.trim()) {
      createSegmentFromText(state.value.currentTranscript)
    }

    cleanup()
    state.value.isTranscribing = false
    state.value.isConnecting = false

    fetchUsage()
  }

  const cleanup = () => {
    if (sessionElapsedTimer) { clearInterval(sessionElapsedTimer); sessionElapsedTimer = null }
    if (usageSyncTimer) { clearInterval(usageSyncTimer); usageSyncTimer = null }
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null }

    if (workletNode) {
      try { workletNode.disconnect() } catch { }
      workletNode = null
    }
    if (sourceNode) {
      try { sourceNode.disconnect() } catch { }
      sourceNode = null
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
    lastFiredNavigation = null
    lastFiredVersion = null
    lastAutoLiveAt = 0
    lastAutoLiveReference = null
  }

  const clearTranscript = () => {
    state.value.segments = []
    state.value.currentTranscript = ''
    toast.add({ title: 'Transcript cleared', icon: 'i-bx-trash' })
  }

  const allBibleReferences = computed(() => {
    const refs: BibleReference[] = []
    for (const segment of state.value.segments) refs.push(...segment.bibleReferences)
    return refs
  })

  const remainingMinutes = computed(() => {
    if (state.value.remainingSeconds === null) return null
    return Math.floor(state.value.remainingSeconds / 60)
  })
  const usedMinutes = computed(() => Math.floor(state.value.usedSeconds / 60))

  // Fetch usage lazily — only when the panel is opened, not on import
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
