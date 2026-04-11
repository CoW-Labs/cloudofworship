<template>
  <div
    class="transcripts-panel relative border border-primary-100 dark:border-primary-800 rounded-lg overflow-hidden bg-white dark:bg-primary-950 mb-4"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 pt-2 bg-primary-100 dark:bg-primary-800 relative"
    >
      <!-- Left: title + AI badge -->
      <div class="flex items-center gap-2">
        <UIcon name="i-material-symbols-speech-to-text" class="text-lg" />
        <span class="font-medium text-sm">Transcribe</span>
        <!-- <UBadge
          v-if="isTeamsPlan"
          label="AI"
          color="primary"
          variant="solid"
          size="xs"
        /> -->
      </div>

      <!-- Right: mic trigger group + more menu -->
      <div class="flex items-center gap-1">
        <!-- Mic trigger group — hover/click reveals the timer, then the mic button -->
        <div
          class="flex items-center gap-0 cursor-pointer"
          tabindex="0"
          :class="{
            'bg-primary-500 rounded-lg text-white pr-2': isTranscribing,
          }"
          @click.stop="toggleTranscription"
        >
          <!-- Remaining time slides in from the left -->

          <UTooltip
            :text="
              isTranscribing ? 'Stop transcription' : 'Start transcription'
            "
          >
            <UButton
              :icon="isTranscribing ? 'i-bx-stop' : 'i-bx-microphone'"
              :color="isTranscribing ? 'red' : showTimer ? 'black' : 'primary'"
              variant="ghost"
              size="xs"
              :loading="isConnecting"
              :disabled="
                isTeamsPlan &&
                remainingSeconds !== null &&
                remainingSeconds <= 0 &&
                !isTranscribing
              "
              @click.stop="toggleTranscription"
            />
          </UTooltip>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-x-2"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-2"
          >
            <span
              v-if="isTranscribing && isTeamsPlan && remainingSeconds !== null"
              class="text-xs px-0.5 py-0.5 rounded select-none"
              :class="remainingSeconds <= 300 ? 'text-red-500' : 'text-white  '"
            >
              {{ remainingMinutes }}m left
            </span>
          </Transition>
        </div>

        <!-- More actions popover -->
        <UPopover mode="click" :popper="{ placement: 'bottom-end' }">
          <UButton
            icon="i-bx-dots-vertical-rounded"
            color="gray"
            variant="ghost"
            size="xs"
          />
          <template #panel="{ close }">
            <div class="p-1 flex flex-col gap-0.5 min-w-[160px]">
              <UButton
                icon="i-lucide-trash"
                color="gray"
                variant="ghost"
                size="xs"
                class="justify-start"
                :disabled="segments.length === 0"
                @click="
                  () => {
                    handleClear()
                    close()
                  }
                "
              >
                Clear transcript
              </UButton>
              <UButton
                icon="i-bx-x"
                color="gray"
                variant="ghost"
                size="xs"
                class="justify-start"
                @click="
                  () => {
                    $emit('close')
                    close()
                  }
                "
              >
                Close panel
              </UButton>
            </div>
          </template>
        </UPopover>
      </div>
    </div>

    <UTabs
      :items="panelTabs"
      :model-value="activeTabIndex"
      class="px-1 bg-primary-100 dark:bg-primary-800"
      :ui="{
        list: {
          background: 'bg-transparent dark:bg-transparent',
          shadow: '',
          tab: {
            base: 'relative inline-flex items-center justify-center gap-1 flex-shrink-0 w-full font-medium text-xs h-7',
            active: 'text-primary-600 dark:text-primary-400',
            inactive: 'text-gray-500 dark:text-gray-400',
          },
        },
      }"
      @change="activeTabIndex = $event"
    >
      <template #scriptures-label>
        <span>Scriptures</span>
        <span
          v-if="scriptureResults.length > 0"
          class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary-200 dark:bg-primary-700 text-primary-700 dark:text-primary-300"
        >
          {{ scriptureResults.length > 99 ? "99+" : scriptureResults.length }}
        </span>
      </template>
    </UTabs>
    <div class="relative">
      <AudioWaveform
        :active="isTranscribing"
        :mic-level="micLevel"
        class="px-3 pb-1.5 bg-primary-100 dark:bg-primary-800 w-full"
      />
    </div>

    <!-- ── Transcripts pane ── -->
    <div
      v-show="activeTabIndex === 0"
      ref="transcriptContainer"
      class="transcript-content p-3 overflow-y-auto h-[160px] 2xl:h-[250px]"
    >
      <!-- Empty state -->
      <div
        v-if="segments.length === 0 && !currentTranscript"
        class="text-center py-6 text-gray-500 dark:text-gray-400"
      >
        <UIcon
          name="i-material-symbols-speech-to-text"
          class="text-3xl mb-2 opacity-50"
        />
        <div
          v-if="
            isTeamsPlan && remainingSeconds !== null && remainingSeconds <= 0
          "
          class="mb-3"
        >
          <UAlert
            color="amber"
            variant="subtle"
            title="Weekly limit reached"
            description="Your 60-minute AI transcription limit resets every Monday."
            icon="i-bx-time"
          />
        </div>
        <div
          v-else-if="!isTeamsPlan && !isSpeechRecognitionSupported"
          class="mb-3"
        >
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
          {{
            isTeamsPlan
              ? "AI-powered · Bible references highlighted automatically"
              : "Bible references will be highlighted automatically"
          }}
        </p>
      </div>

      <!-- Segments — newest first -->
      <div v-else class="space-y-3">
        <div
          v-if="currentTranscript"
          class="segment text-sm leading-relaxed text-gray-600 dark:text-gray-400 italic"
        >
          {{ currentTranscript }}<span class="animate-pulse">▌</span>
        </div>
        <div
          v-for="segment in [...segments].reverse()"
          :key="segment.id"
          class="segment text-sm leading-relaxed"
        >
          <TranscriptText
            :text="segment.text"
            :bible-references="segment.bibleReferences"
            @reference-click="handleReferenceClick"
          />
        </div>
      </div>
    </div>

    <!-- ── Scriptures pane ── -->
    <div
      v-show="activeTabIndex === 1"
      ref="scripturesContainer"
      class="transcript-content overflow-y-auto h-[160px] 2xl:h-[250px]"
    >
      <!-- Empty state -->
      <div
        v-if="scriptureResults.length === 0"
        class="text-center py-6 text-gray-500 dark:text-gray-400"
      >
        <UIcon name="i-bx-bible" class="text-3xl mb-2 opacity-50" />
        <p class="text-sm">
          {{
            isTranscribing
              ? "Listening for scriptures..."
              : "No scriptures detected yet"
          }}
        </p>
        <p class="text-xs mt-1 opacity-70">
          Scriptures matching the sermon will appear here automatically
        </p>
      </div>

      <!-- Results — newest first, 20 at a time -->
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <button
          v-for="result in visibleScriptureResults"
          :key="result._id"
          class="w-full text-left py-3 px-3 hover:bg-primary-50 dark:hover:bg-primary-900 transition-colors cursor-pointer group"
          @click="handleScriptureClick(result)"
        >
          <div class="flex items-center gap-1.5 mb-0.5">
            <UIcon
              name="i-bx-bible"
              class="text-primary-500 text-sm flex-shrink-0"
            />
            <span
              class="text-xs font-semibold text-primary-600 dark:text-primary-400 group-hover:underline"
            >
              {{ result.displayLabel }}
            </span>
          </div>
          <p
            class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2"
          >
            {{ result.scripture }}
          </p>
        </button>

        <button
          v-if="scriptureResults.length > scriptureVisibleCount"
          class="w-full text-xs text-center py-1.5 text-primary-500 dark:text-primary-400 hover:underline"
          @click="scriptureVisibleCount += 20"
        >
          See
          {{ Math.min(20, scriptureResults.length - scriptureVisibleCount) }}
          more
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BibleReference } from "~/types/transcript"
import type { ScriptureResult } from "~/composables/useScriptureSearch"
import { appWideActions } from "~/utils/constants"
import useBibleReferenceParser from "~/composables/useBibleReferenceParser"

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

// ── Transcription ──────────────────────────────────────────────────────────
const {
  isTranscribing,
  isConnecting,
  segments,
  currentTranscript,
  isSpeechRecognitionSupported,
  startTranscription,
  stopTranscription,
  clearTranscript,
  remainingMinutes,
  remainingSeconds,
  isTeamsPlan,
  micLevel,
} = useSermonTranscription()

// ── Tabs ───────────────────────────────────────────────────────────────────
const panelTabs = [
  { label: "Transcripts", key: "transcripts" },
  { label: "Scriptures", key: "scriptures" },
]
const activeTabIndex = ref(0)

// ── Timer reveal ───────────────────────────────────────────────────────────
const showTimer = ref(false)
watch(isTranscribing, (val) => {
  if (!val) showTimer.value = false
})

// ── Scripture search ───────────────────────────────────────────────────────
const {
  results: scriptureResults,
  debouncedSearch,
  addFromBibleReferences,
  clearResults: clearScriptureResults,
} = useScriptureSearch()

const scriptureVisibleCount = ref(20)
const visibleScriptureResults = computed(() =>
  [...scriptureResults.value].reverse().slice(0, scriptureVisibleCount.value)
)

// Track which segment ids have already been parsed so we only process new ones
const parsedSegmentIds = new Set<string>()

watch(
  () => segments.value.length,
  () => {
    for (const segment of segments.value) {
      if (parsedSegmentIds.has(segment.id)) continue
      parsedSegmentIds.add(segment.id)

      // Client-side: extract bible references directly from the transcript text
      const refs = useBibleReferenceParser(segment.text)
      if (refs.length > 0) addFromBibleReferences(refs)
    }

    // Also fire the debounced backend search with the last 3 segments
    const combinedText = segments.value
      .slice(-3)
      .map((s) => s.text)
      .join(" ")
    if (combinedText.trim()) debouncedSearch(combinedText)
  },
  { immediate: true }
)

// ── DOM refs ───────────────────────────────────────────────────────────────
const transcriptContainer = ref<HTMLElement | null>(null)
const scripturesContainer = ref<HTMLElement | null>(null)

// ── Actions ────────────────────────────────────────────────────────────────
const toggleTranscription = () =>
  isTranscribing.value ? stopTranscription() : startTranscription()

const handleClear = () => {
  clearTranscript()
  clearScriptureResults()
  parsedSegmentIds.clear()
  scriptureVisibleCount.value = 20
}

const handleReferenceClick = (reference: BibleReference) =>
  useGlobalEmit(appWideActions.updateOrCreateBible, reference.shortLabel)

const handleScriptureClick = (result: ScriptureResult) =>
  useGlobalEmit(appWideActions.updateOrCreateBible, result.shortLabel)
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
