import { ref, computed, onUnmounted } from 'vue'
import { useAppStore } from '~/store/app'
import type { TranscriptSegment, BibleReference } from '~/types/transcript'
import { appWideActions } from '~/utils/constants'

interface TranscriptionState {
  isTranscribing: boolean
  isConnecting: boolean
  error: string | null
  segments: TranscriptSegment[]
  currentTranscript: string
}

// Type definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}

/**
 * Composable for real-time sermon transcription using Web Speech API
 * Provides offline speech-to-text with automatic Bible reference detection
 */
export default function useSermonTranscription() {
  const appStore = useAppStore()
  const toast = useToast()

  // State
  const state = ref<TranscriptionState>({
    isTranscribing: false,
    isConnecting: false,
    error: null,
    segments: [],
    currentTranscript: '',
  })

  // Web Speech API recognition instance
  let recognition: SpeechRecognition | null = null
  let finalTranscriptBuffer = ''

  /**
   * Check if Web Speech API is supported
   */
  const isSpeechRecognitionSupported = (): boolean => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }

  /**
   * Detect voice commands in the transcript
   * Returns the command type if found, null otherwise
   */
  const detectVoiceCommand = (text: string): 'next-verse' | 'previous-verse' | null => {
    const lowerText = text.toLowerCase().trim()
    
    // Check for "next verse" command
    if (
      lowerText.includes('next verse') ||
      lowerText.includes('next first') || // Speech recognition might mishear
      lowerText === 'next' ||
      lowerText.includes('go to next verse') ||
      lowerText.includes('go next verse')
    ) {
      return 'next-verse'
    }
    
    // Check for "previous verse" command
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

  /**
   * Execute a voice command
   */
  const executeVoiceCommand = (command: 'next-verse' | 'previous-verse') => {
    if (command === 'next-verse') {
      // Emit the next verse event
      useGlobalEmit(appWideActions.nextVerse)
      console.log('Voice command: next verse')
    } else if (command === 'previous-verse') {
      // Emit the previous verse event
      useGlobalEmit(appWideActions.previousVerse)
      console.log('Voice command: previous verse')
    }
  }

  /**
   * Start transcription session
   */
  const startTranscription = async () => {
    if (state.value.isTranscribing) {
      toast.add({ title: 'Already transcribing', icon: 'i-bx-info-circle' })
      return
    }

    // Check browser support
    if (!isSpeechRecognitionSupported()) {
      state.value.error = 'Speech recognition is not supported in this browser'
      toast.add({
        title: 'Browser not supported',
        description: 'Please use Chrome, Edge, or Safari for speech recognition',
        icon: 'i-bx-error',
        color: 'red'
      })
      return
    }

    state.value.isConnecting = true
    state.value.error = null

    try {
      // Request microphone permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop())
      } catch (permissionError: any) {
        state.value.isConnecting = false
        state.value.error = 'Microphone permission denied'
        toast.add({
          title: 'Microphone access denied',
          description: 'Please allow microphone access to use transcription',
          icon: 'i-bx-error',
          color: 'red'
        })
        return
      }

      // Initialize Web Speech API
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      recognition = new SpeechRecognitionAPI()

      // Configure recognition
      recognition.continuous = true // Keep listening continuously
      recognition.interimResults = true // Get interim results as user speaks
      recognition.lang = 'en-US' // Set language to English
      recognition.maxAlternatives = 1 // Only need the best match

      // Handle recognition results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        
        // Process all results from the current session
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript

          if (result.isFinal) {
            // Final result - add to buffer and create segment
            finalTranscriptBuffer += transcript + ' '
            createSegmentFromText(transcript)
          } else {
            // Interim result - show live
            interimTranscript += transcript
          }
        }

        // Update current transcript with interim results
        state.value.currentTranscript = interimTranscript
      }

      // Handle recognition start
      recognition.onstart = () => {
        state.value.isTranscribing = true
        state.value.isConnecting = false
        console.log('Speech recognition started')
      }

      // Handle recognition end
      recognition.onend = () => {
        // If still supposed to be transcribing, restart (for continuous mode)
        if (state.value.isTranscribing) {
          try {
            recognition?.start()
          } catch (err) {
            console.log('Recognition restart failed:', err)
          }
        }
      }

      // Handle errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        
        // Don't stop on 'no-speech' error, just log it
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing...')
          return
        }

        // Handle other errors
        if (event.error === 'aborted') {
          // User stopped it, don't show error
          return
        }

        // Handle permission errors specifically
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          state.value.error = 'Microphone permission denied'
          state.value.isTranscribing = false
          state.value.isConnecting = false
          toast.add({
            title: 'Microphone access denied',
            description: 'Please allow microphone access in your browser settings',
            icon: 'i-bx-error',
            color: 'red'
          })
          return
        }

        state.value.error = event.error
        
        if (event.error !== 'network') {
          toast.add({
            title: 'Transcription error',
            description: event.message || event.error,
            icon: 'i-bx-error',
            color: 'red'
          })
        }
      }

      // Start recognition
      recognition.start()
      
      toast.add({ 
        title: 'Transcription started', 
        description: 'Listening for speech...',
        icon: 'i-bx-microphone' 
      })
    } catch (err: any) {
      console.error('Failed to start transcription:', err)
      state.value.error = err.message || 'Failed to start transcription'
      state.value.isConnecting = false
      toast.add({
        title: 'Failed to start transcription',
        description: err.message,
        icon: 'i-bx-error',
        color: 'red'
      })
      cleanup()
    }
  }

  /**
   * Create a segment from finalized text
   */
  const createSegmentFromText = (text: string) => {
    if (!text.trim()) return

    const cleanedText = text.trim()
    
    // Check for voice commands first
    const voiceCommand = detectVoiceCommand(cleanedText)
    if (voiceCommand) {
      executeVoiceCommand(voiceCommand)
      // Still add to transcript so user can see what was said
    }
    
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
   * Stop transcription session
   */
  const stopTranscription = () => {
    if (!state.value.isTranscribing && !state.value.isConnecting) return

    // Finalize any remaining transcript
    if (state.value.currentTranscript.trim()) {
      createSegmentFromText(state.value.currentTranscript)
    }

    cleanup()

    state.value.isTranscribing = false
    state.value.isConnecting = false

    toast.add({ title: 'Transcription stopped', icon: 'i-bx-stop' })
  }

  /**
   * Clean up resources
   */
  const cleanup = () => {
    if (recognition) {
      try {
        recognition.stop()
      } catch (err) {
        console.log('Error stopping recognition:', err)
      }
      recognition = null
    }
    finalTranscriptBuffer = ''
  }

  /**
   * Clear transcript segments
   */
  const clearTranscript = () => {
    state.value.segments = []
    state.value.currentTranscript = ''
    toast.add({ title: 'Transcript cleared', icon: 'i-bx-trash' })
  }

  /**
   * Get all Bible references from the transcript
   */
  const allBibleReferences = computed(() => {
    const refs: BibleReference[] = []
    for (const segment of state.value.segments) {
      refs.push(...segment.bibleReferences)
    }
    return refs
  })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    isTranscribing: computed(() => state.value.isTranscribing),
    isConnecting: computed(() => state.value.isConnecting),
    error: computed(() => state.value.error),
    segments: computed(() => state.value.segments),
    currentTranscript: computed(() => state.value.currentTranscript),
    allBibleReferences,
    isSpeechRecognitionSupported: isSpeechRecognitionSupported(),

    // Actions
    startTranscription,
    stopTranscription,
    clearTranscript,
  }
}

