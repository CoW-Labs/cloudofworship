<template>
  <AppSection
    heading="Transcribe"
    class="transcripts-panel min-h-0"
    slot-ctn-styles="!px-0 !pb-0 overflow-hidden"
  >
    <!-- Inline header actions: session controls + more menu -->
    <template #actions>
      <div class="flex items-center gap-1">
        <!-- Mic control — collapses to a single button when idle, expands into
             a pill with pause/stop/timer once a session is running -->
        <div
          class="mic-control flex items-center rounded-full p-0.5"
          :class="[sessionPillClasses, { 'is-running': isTranscribing }]"
        >
          <UTooltip v-if="!isTranscribing" text="Start transcription">
            <UButton
              icon="i-bx-microphone"
              color="primary"
              variant="ghost"
              class="session-button"
              :loading="isConnecting"
              :disabled="isOutOfTime"
              @click.stop="startTranscription"
            />
          </UTooltip>

          <!-- Session controls slide open/closed on a single width transition -->
          <div
            class="session-controls grid"
            :class="
              isTranscribing
                ? 'grid-cols-[1fr] opacity-100'
                : 'grid-cols-[0fr] opacity-0 pointer-events-none'
            "
            :aria-hidden="!isTranscribing"
          >
            <div class="min-w-0 overflow-hidden">
              <div class="flex items-center whitespace-nowrap pr-1.5">
                <UTooltip
                  :text="
                    isPaused ? 'Resume transcription' : 'Pause transcription'
                  "
                >
                  <UButton
                    :icon="isPaused ? 'i-bx-play' : 'i-bx-pause'"
                    :color="isPaused ? 'primary' : 'gray'"
                    variant="ghost"
                    class="session-button"
                    :aria-label="
                      isPaused ? 'Resume transcription' : 'Pause transcription'
                    "
                    @click.stop="
                      isPaused ? resumeTranscription() : pauseTranscription()
                    "
                  />
                </UTooltip>

                <ConfirmDialog
                  header="Stop transcription"
                  label="Ending now summarises the transcript as it stands. Pause instead if this is just a short break."
                  button-icon="i-bx-stop"
                  button-color="red"
                  button-variant="ghost"
                  button-styles="session-button"
                  destructive
                  @confirm="stopTranscription"
                />

                <!-- Scripture search in-progress indicator -->
                <UIcon
                  v-if="isScriptureSearching"
                  name="i-bx-loader-alt"
                  class="ml-1 text-xs text-primary-400 animate-spin"
                />

                <!-- Timer / paused label — the two states cross-blur in place,
                     stacked in one grid cell so the pill never jumps width -->
                <span
                  class="session-status ml-1.5 grid"
                  :class="{
                    'has-timer': useDeepgramEngine && remainingSeconds !== null,
                  }"
                >
                  <Transition
                    enter-active-class="transition-[opacity,filter] duration-300 ease-out"
                    enter-from-class="opacity-0 blur-[3px]"
                    enter-to-class="opacity-100 blur-none"
                    leave-active-class="transition-[opacity,filter] duration-200 ease-in"
                    leave-from-class="opacity-100 blur-none"
                    leave-to-class="opacity-0 blur-[3px]"
                  >
                    <span
                      v-if="isPaused"
                      key="paused"
                      class="text-gray-600 dark:text-gray-300"
                    >
                      Paused
                    </span>
                    <span
                      v-else-if="useDeepgramEngine && remainingSeconds !== null"
                      key="remaining"
                      :class="
                        isLowOnTime
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-primary-700 dark:text-primary-300'
                      "
                    >
                      {{ remainingMinutes }}m left
                    </span>
                  </Transition>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- More actions menu -->
        <MoreActionsMenu v-slot="{ close }" flush>
          <UButton
            color="gray"
            variant="ghost"
            block
            :disabled="segments.length === 0"
            @click="
              () => {
                handleClear()
                close()
              }
            "
          >
            <template #leading><DeleteIcon class="w-4 h-4" /></template>
            Clear transcript
          </UButton>
          <UButton
            color="gray"
            variant="ghost"
            block
            :disabled="isTranscribing"
            @click="
              () => {
                if (isTranscribing) return
                emit('close')
                close()
              }
            "
          >
            <template #leading><CloseIcon class="w-4 h-4" /></template>
            {{ isTranscribing ? "Stop session to close" : "Close panel" }}
          </UButton>
        </MoreActionsMenu>
      </div>
    </template>

    <div class="flex h-full min-h-0 flex-col overflow-hidden">
      <UTabs
        :items="panelTabs"
        :model-value="activeTabIndex"
        class="px-1 bg-gray-100 dark:bg-[#222938] shrink-0"
        :ui="{
          list: {
            background: 'bg-transparent dark:bg-transparent',
            shadow: '',
            tab: {
              base: 'relative inline-flex items-center justify-center gap-1 flex-shrink-0 w-full font-medium text-xs h-7',
              active: 'text-primary-600 dark:text-primary-300',
              inactive: 'text-gray-500 dark:text-[#9aa3b2]',
            },
          },
        }"
        @change="activeTabIndex = $event"
      >
        <template #scriptures-label>
          <span>Scriptures</span>
          <span
            v-if="scriptureResults.length > 0"
            class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary-200 dark:bg-[#384155] text-primary-700 dark:text-primary-300"
          >
            {{ scriptureResults.length > 99 ? "99+" : scriptureResults.length }}
          </span>
        </template>
      </UTabs>
      <div class="relative shrink-0">
        <AudioWaveform
          :active="isTranscribing && !isPaused"
          :mic-level="micLevel"
          class="px-3 pb-1.5 bg-gray-100 dark:bg-[#222938] w-full"
        />
      </div>

      <!-- ── Transcripts pane ── -->
      <div
        v-show="activeTabIndex === 0"
        ref="transcriptContainer"
        class="transcript-content flex-1 min-h-0 p-3 overflow-y-auto"
      >
        <!-- Empty state -->
        <div
          v-if="segments.length === 0 && !currentTranscript"
          class="text-center py-6 text-gray-500 dark:text-[#9aa3b2]"
        >
          <UIcon
            name="i-material-symbols-speech-to-text"
            class="text-3xl mb-2 opacity-50"
          />
          <div
            v-if="
              useDeepgramEngine &&
              remainingSeconds !== null &&
              remainingSeconds <= 0
            "
            class="mb-3"
          >
            <UAlert
              color="amber"
              variant="subtle"
              title="Weekly limit reached"
              description="Your 60-minute transcription limit resets every Monday."
              icon="i-bx-time"
            />
          </div>
          <div
            v-else-if="!useDeepgramEngine && !isSpeechRecognitionSupported"
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
              isPaused
                ? "Paused. Press play to keep transcribing."
                : isTranscribing
                ? "Listening..."
                : "Click the microphone to start transcribing"
            }}
          </p>
          <p class="text-xs mt-1 opacity-70">
            Bible references will be highlighted automatically
          </p>
        </div>

        <!-- Segments — oldest first, newest at bottom -->
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
          <div
            v-if="currentTranscript"
            class="segment text-sm leading-relaxed text-gray-600 dark:text-[#9aa3b2] italic"
          >
            {{ currentTranscript }}<span class="animate-pulse">▌</span>
          </div>
          <!-- Always-visible anchor so the cursor is always at the very bottom -->
          <div ref="transcriptBottom" />
        </div>
      </div>

      <!-- ── Scriptures pane ── -->
      <div
        v-show="activeTabIndex === 1"
        ref="scripturesContainer"
        class="transcript-content flex-1 min-h-0 overflow-y-auto"
      >
        <!-- Empty state -->
        <div
          v-if="scriptureResults.length === 0"
          class="text-center py-6 text-gray-500 dark:text-[#9aa3b2]"
        >
          <UIcon name="i-bx-bible" class="text-3xl mb-2 opacity-50" />
          <p class="text-sm">
            {{
              isTranscribing && !isPaused
                ? "Listening for scriptures..."
                : "No scriptures detected yet"
            }}
          </p>
          <p class="text-xs mt-1 opacity-70">
            Scriptures matching the sermon will appear here automatically
          </p>
        </div>

        <!-- Results — newest first, 20 at a time -->
        <div v-else class="divide-y divide-gray-100 dark:divide-[#171d2b]">
          <button
            v-for="result in visibleScriptureResults"
            :key="result._id"
            class="w-full text-left py-3 px-3 hover:bg-white dark:hover:bg-[#2b3242] transition-colors cursor-pointer group"
            @click="handleScriptureClick(result)"
          >
            <div class="flex items-center gap-1.5 mb-0.5">
              <UIcon
                name="i-bx-bible"
                class="text-primary-500 text-sm flex-shrink-0"
              />
              <span
                class="text-xs font-semibold text-primary-600 dark:text-primary-300 group-hover:underline"
                v-html="
                  highlightText(result.displayLabel, scriptureHighlightQuery)
                "
              />
            </div>
            <p
              class="text-xs text-gray-600 dark:text-[#9aa3b2] leading-relaxed line-clamp-2"
              v-html="highlightText(result.scripture, scriptureHighlightQuery)"
            />
          </button>

          <button
            v-if="scriptureResults.length > scriptureVisibleCount"
            class="w-full text-xs text-center py-1.5 text-primary-500 dark:text-primary-300 hover:underline"
            @click="scriptureVisibleCount += 20"
          >
            See
            {{ Math.min(20, scriptureResults.length - scriptureVisibleCount) }}
            more
          </button>
        </div>
      </div>

      <!-- Feature Introduction Modal — shown once on first open -->
      <FeatureIntroductionModal
        ref="featureIntroModal"
        feature-key="transcribe-sermon"
        title="Transcribe Sermon"
      >
        <div
          class="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
        >
          <p>
            Transcribe Sermon turns your microphone into a live note-taker;
            capturing what's being said and surfacing relevant Bible passages
            automatically as you preach.
          </p>
          <ul class="space-y-2">
            <li class="flex items-start gap-2">
              <UIcon
                name="i-bx-microphone"
                class="text-primary-500 mt-0.5 shrink-0"
              />
              <span
                ><span class="font-semibold">Live transcription</span> — words
                appear in real-time as you speak, with Bible references
                highlighted.</span
              >
            </li>
            <li class="flex items-start gap-2">
              <UIcon
                name="i-bx-bible"
                class="text-primary-500 mt-0.5 shrink-0"
              />
              <span
                ><span class="font-semibold">Auto-detect scriptures</span> — any
                verse mentioned (e.g. "John 3:16") is instantly added to the
                Scriptures tab. Click it to open the slide.</span
              >
            </li>
            <li class="flex items-start gap-2">
              <UIcon
                name="i-bx-search-alt"
                class="text-primary-500 mt-0.5 shrink-0"
              />
              <span
                ><span class="font-semibold">Scripture suggestions</span> —
                related verses are surfaced even when you don't quote them
                directly
                <span class="text-xs text-gray-400">(Teams plan)</span>.</span
              >
            </li>
          </ul>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Tip: works best with a good microphone in a quiet environment.
          </p>
        </div>
      </FeatureIntroductionModal>
    </div>
  </AppSection>
</template>

<script setup lang="ts">
import type { BibleReference } from "~/types/transcript"
import type { ScriptureResult } from "~/composables/useScriptureSearch"
import { appWideActions } from "~/utils/constants"
import { highlightText } from "~/utils/highlightText"
import { useAppStore } from "~/store/app"

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()
const appStore = useAppStore()

// ── Feature intro ──────────────────────────────────────────────────────────
const featureIntroModal = ref<{
  show: () => boolean
  hasBeenSeen: () => boolean
} | null>(null)
onMounted(() => {
  featureIntroModal.value?.show()
  usePosthogCapture("TRANSCRIPTION_PANEL_OPENED")
})

// ── Transcription ──────────────────────────────────────────────────────────
const {
  isTranscribing,
  isConnecting,
  isPaused,
  segments,
  currentTranscript,
  isSpeechRecognitionSupported,
  startTranscription,
  stopTranscription,
  pauseTranscription,
  resumeTranscription,
  clearTranscript,
  remainingMinutes,
  remainingSeconds,
  isTeamsPlan,
  useDeepgramEngine,
  micLevel,
} = useSermonTranscription()

// Below this threshold (5 mins) the session pill switches to a warning tint
const isLowOnTime = computed(
  () => remainingSeconds.value !== null && remainingSeconds.value <= 300
)

const isOutOfTime = computed(
  () =>
    useDeepgramEngine.value &&
    remainingSeconds.value !== null &&
    remainingSeconds.value <= 0
)

// Idle = bare button, running = tinted pill (muted while paused, red when the
// weekly allowance is nearly spent).
const sessionPillClasses = computed(() => {
  if (!isTranscribing.value) return ""
  if (isPaused.value)
    return "bg-gray-500/10 ring-1 ring-gray-500/20 dark:bg-white/5 dark:ring-white/10"
  if (isLowOnTime.value)
    return "bg-red-500/10 ring-1 ring-red-500/20 dark:bg-red-400/10 dark:ring-red-400/20"
  return "bg-primary-500/10 ring-1 ring-primary-500/20 dark:bg-primary-400/10 dark:ring-primary-400/25"
})

// ── Tabs ───────────────────────────────────────────────────────────────────
const panelTabs = [
  { label: "Transcripts", key: "transcripts" },
  { label: "Scriptures", key: "scriptures" },
]
const activeTabIndex = ref(0)

// ── Scripture search ───────────────────────────────────────────────────────
// Search the exact transcript segments rendered in the panel for both engines.
// (The Deepgram backend still pushes its own scripture matches, but the client
// ignores them — the panel keeps segment boundaries authoritative by querying
// with each displayed segment instead.)
const {
  results: httpScriptureResults,
  isSearching: isScriptureSearching,
  search: searchScriptures,
  clearResults: clearHttpScriptureResults,
} = useScriptureSearch()

const scriptureResults = computed(() => httpScriptureResults.value)

const scriptureVisibleCount = ref(20)
const visibleScriptureResults = computed(() =>
  scriptureResults.value.slice(0, scriptureVisibleCount.value)
)

// Highlight query: last 8 words from the most recent transcript segment
const scriptureHighlightQuery = computed(() => {
  const lastSegment = segments.value.at(-1)
  if (!lastSegment?.text) return ""
  return lastSegment.text?.trim().split(/\s+/).slice(-8).join(" ")
})

// Track which segment ids have already been parsed so we only process new ones
const parsedSegmentIds = new Set<string>()
let lastLocalAutoLiveAt = 0
let lastLocalAutoLiveReference: string | null = null
const LOCAL_AUTO_LIVE_COOLDOWN_MS = 1500

const maybeAutoOpenLocalReference = (reference: BibleReference) => {
  if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return
  if (reference.shortLabel === lastLocalAutoLiveReference) return

  const now = Date.now()
  if (now - lastLocalAutoLiveAt < LOCAL_AUTO_LIVE_COOLDOWN_MS) return

  lastLocalAutoLiveAt = now
  lastLocalAutoLiveReference = reference.shortLabel
  useGlobalEmit(appWideActions.updateOrCreateBible, reference.shortLabel)
}

watch(
  () => segments.value.length,
  () => {
    for (const segment of segments.value) {
      if (parsedSegmentIds.has(segment.id)) continue
      parsedSegmentIds.add(segment.id)

      if (segment.bibleReferences.length > 0) {
        const firstReference = segment.bibleReferences[0]
        if (
          firstReference &&
          isTranscribing.value &&
          !useDeepgramEngine.value
        ) {
          maybeAutoOpenLocalReference(firstReference)
        }
      }

      // Replace the visible scriptures with this segment's matches. The parsed
      // references are passed in so they merge into the same atomic update
      // (shown ahead of fuzzy matches) instead of being clobbered by the async
      // response.
      if (segment.text?.trim() || segment.bibleReferences.length > 0) {
        searchScriptures(segment.text ?? "", segment.bibleReferences)
      }
    }
  },
  { immediate: true }
)

// ── DOM refs ───────────────────────────────────────────────────────────────
const transcriptContainer = ref<HTMLElement | null>(null)
const transcriptBottom = ref<HTMLElement | null>(null)
const scripturesContainer = ref<HTMLElement | null>(null)

// Auto-scroll transcript to bottom when new content arrives (newest at bottom)
const scrollTranscriptToBottom = () => {
  nextTick(() => {
    transcriptBottom.value?.scrollIntoView({ behavior: "smooth" })
  })
}

watch(() => segments.value.length, scrollTranscriptToBottom)
watch(currentTranscript, scrollTranscriptToBottom)

// ── Actions ────────────────────────────────────────────────────────────────
const handleClear = () => {
  // `clearTranscript()` from useSermonTranscription clears both segments AND
  // the Deepgram-path scripture results (handled inside the composable).
  clearTranscript()
  // Also reset the HTTP-path scripture results used by the free / Web Speech path.
  clearHttpScriptureResults()
  parsedSegmentIds.clear()
  lastLocalAutoLiveAt = 0
  lastLocalAutoLiveReference = null
  scriptureVisibleCount.value = 20
}

const handleReferenceClick = (reference: BibleReference) => {
  usePosthogCapture("TRANSCRIPTION_BIBLE_REFERENCE_CLICKED", {
    reference: reference.shortLabel,
  })
  useGlobalEmit(appWideActions.updateOrCreateBible, reference.shortLabel)
}

const handleScriptureClick = (result: ScriptureResult) => {
  usePosthogCapture("TRANSCRIPTION_SCRIPTURE_SUGGESTION_CLICKED", {
    reference: result.shortLabel,
    displayLabel: result.displayLabel,
  })
  useGlobalEmit(appWideActions.updateOrCreateBible, result.shortLabel)
}
</script>

<style scoped>
/* Session controls open/close on a single width transition. Animating
   grid-template-columns from 0fr → 1fr lets the pill grow to whatever the
   buttons and timer actually measure, with no hardcoded width. */
.mic-control {
  --ease-session: cubic-bezier(0.32, 0.72, 0, 1);
  transition: background-color 320ms var(--ease-session),
    box-shadow 320ms var(--ease-session);
}

.session-controls {
  transition: grid-template-columns 380ms var(--ease-session),
    opacity 180ms var(--ease-session);
}

/* One geometry for every button in the pill (mic, pause, stop) so their round
   hover states are identical circles that sit inside the pill's ring. The stop
   trigger is rendered by ConfirmDialog, hence :deep(). */
.mic-control :deep(.session-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  width: 1.5rem;
  padding: 0;
  border-radius: 9999px;
}

.mic-control :deep(.session-button > span) {
  height: 0.875rem;
  width: 0.875rem;
}

/* Timer and "Paused" share a single grid cell so they cross-blur in place
   instead of shifting the pill as one replaces the other. */
.session-status {
  justify-items: center;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.session-status > span {
  grid-area: 1 / 1;
}

/* Reserve the width of the widest countdown ("175m left") so the pill holds
   its size when the shorter "Paused" label takes over. */
.session-status.has-timer {
  min-width: 3.5rem;
}

/* Opening: let the pill start widening before the controls fade in.
   Closing: fade out first so nothing clips as the width collapses. */
.mic-control.is-running .session-controls {
  transition-delay: 0ms, 140ms;
}

@media (prefers-reduced-motion: reduce) {
  .mic-control,
  .session-controls {
    transition-duration: 0ms;
    transition-delay: 0ms;
  }
}

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
