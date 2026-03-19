<template>
  <div class="transcripts-panel">
    <!-- Header -->
    <div
      class="flex items-center justify-between p-3 bg-primary-100 dark:bg-primary-800"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-material-symbols-speech-to-text" class="text-lg" />
        <span class="font-medium text-sm">Transcripts</span>
        
        <!-- Waveform when transcribing -->
        <AudioWaveform v-if="isTranscribing" :active="isTranscribing" :bars="5" />
        
        <!-- LIVE indicator -->
        <LiveSlideIndicator v-if="isTranscribing" :visible="isTranscribing" />
      </div>
      <div class="flex items-center gap-1">
        <!-- Start/Stop Button -->
        <UTooltip
          :text="isTranscribing ? 'Stop transcription' : 'Start transcription'"
        >
          <UButton
            :icon="isTranscribing ? 'i-bx-stop' : 'i-bx-microphone'"
            :color="isTranscribing ? 'red' : 'primary'"
            variant="ghost"
            size="xs"
            :loading="isConnecting"
            @click="toggleTranscription"
          />
        </UTooltip>
        <!-- Clear Button -->
        <UTooltip text="Clear transcript">
          <UButton
            icon="i-bx-trash"
            color="gray"
            variant="ghost"
            size="xs"
            :disabled="segments.length === 0"
            @click="handleClear"
          />
        </UTooltip>
        <!-- Close Button -->
        <UTooltip text="Close transcripts panel">
          <UButton
            icon="i-bx-x"
            color="gray"
            variant="ghost"
            size="xs"
            @click="$emit('close')"
          />
        </UTooltip>
      </div>
    </div>

    <!-- Transcript Content -->
    <div
      ref="transcriptContainer"
      class="transcript-content p-3 overflow-y-auto h-[160px]"
    >
      <!-- Empty State -->
      <div
        v-if="segments.length === 0 && !currentTranscript"
        class="text-center py-6 text-gray-500 dark:text-gray-400"
      >
        <UIcon
          name="i-material-symbols-speech-to-text"
          class="text-3xl mb-2 opacity-50"
        />

        <!-- Browser not supported warning -->
        <div v-if="!isSpeechRecognitionSupported" class="mb-3">
          <UAlert
            color="amber"
            variant="subtle"
            title="Browser not supported"
            description="Speech recognition requires Chrome, Edge, or Safari"
            icon="i-bx-error"
          />
        </div>

        <p class="text-sm">
          {{
            isTranscribing
              ? "Listening..."
              : "Click the microphone to start transcribing"
          }}
        </p>
        <p class="text-xs mt-1 opacity-70">
          Bible references will be highlighted automatically
        </p>
      </div>

      <!-- Transcript Segments -->
      <div v-else class="space-y-3">
        <div
          v-for="segment in segments"
          :key="segment.id"
          class="segment text-sm leading-relaxed"
        >
          <TranscriptText
            :text="segment.text"
            :bible-references="segment.bibleReferences"
            @reference-click="handleReferenceClick"
          />
        </div>

        <!-- Current (live) transcript -->
        <div
          v-if="currentTranscript"
          class="segment text-sm leading-relaxed text-gray-600 dark:text-gray-400 italic"
        >
          {{ currentTranscript }}
          <span class="animate-pulse">▌</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BibleReference } from "~/types/transcript"
import { appWideActions } from "~/utils/constants"

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const {
  isTranscribing,
  isConnecting,
  segments,
  currentTranscript,
  isSpeechRecognitionSupported,
  startTranscription,
  stopTranscription,
  clearTranscript,
} = useSermonTranscription()

const transcriptContainer = ref<HTMLElement | null>(null)

// Auto-scroll to bottom when new content arrives
watch([segments, currentTranscript], () => {
  nextTick(() => {
    if (transcriptContainer.value) {
      transcriptContainer.value.scrollTop =
        transcriptContainer.value.scrollHeight
    }
  })
})

const toggleTranscription = () => {
  if (isTranscribing.value) {
    stopTranscription()
  } else {
    startTranscription()
  }
}

const handleClear = () => {
  clearTranscript()
  // Reset the tracked Bible slide when clearing transcript
  transcriptBibleSlideId.value = null
}

const handleReferenceClick = (reference: BibleReference) => {
  console.log("Bible reference clicked:", reference)
  
  // Use updateOrCreateBible event - it will reuse existing Bible slide or create a new one
  useGlobalEmit(appWideActions.updateOrCreateBible, reference.shortLabel)
}

/**
 * Find an existing Bible slide in the current schedule
 * Prioritizes the tracked slide from transcripts, otherwise finds any Bible slide
 */
const findExistingBibleSlide = (): Slide | null => {
  const activeSlides = appStore.currentState?.activeSlides || []
  
  // First, check if the tracked slide still exists
  if (transcriptBibleSlideId.value) {
    const trackedSlide = activeSlides.find(
      (slide: Slide) => slide.id === transcriptBibleSlideId.value && slide.type === slideTypes.bible
    )
    if (trackedSlide) {
      return trackedSlide
    }
  }
  
  // Otherwise, find any existing Bible slide (prefer the active/live one)
  const liveSlideId = appStore.currentState?.liveSlideId
  const liveSlide = activeSlides.find(
    (slide: Slide) => slide.id === liveSlideId && slide.type === slideTypes.bible
  )
  if (liveSlide) {
    transcriptBibleSlideId.value = liveSlide.id
    return liveSlide
  }
  
  // Fall back to any Bible slide
  const anyBibleSlide = activeSlides.find((slide: Slide) => slide.type === slideTypes.bible)
  if (anyBibleSlide) {
    transcriptBibleSlideId.value = anyBibleSlide.id
    return anyBibleSlide
  }
  
  return null
}
</script>

<style scoped>
.transcript-content {
  scrollbar-width: thin;
}

.transcript-content::-webkit-scrollbar {
  width: 4px;
}

.transcript-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}
</style>
