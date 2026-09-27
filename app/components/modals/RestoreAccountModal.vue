<template>
  <UModal
    v-model="visible"
    :ui="{
      width: 'sm:max-w-[420px]',
      background: '',
      ring: '',
      shadow: '',
      rounded: 'rounded-2xl',
      padding: 'p-0',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
  >
    <!-- Compact sibling of FeatureIntroductionModal — same shell, smaller body. -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div
        class="flex items-center justify-between gap-4 pt-3 pb-2.5 pl-4 pr-3"
      >
        <span
          class="flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-red-500" />
          Requires attention
        </span>
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Close"
          @click="close"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <!-- The story reveals line by line after a short "typing" beat. Clicking
           the card skips straight to the end. -->
      <div
        class="relative mx-2.5 mb-2.5 p-5 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d]"
        :class="skipped && 'is-skipped'"
        @click="skipStory"
      >
        <Transition name="typing">
          <div
            v-if="phase === 'typing'"
            class="absolute left-5 top-5 flex h-[25px] items-center gap-1"
            aria-hidden="true"
          >
            <span
              v-for="i in 3"
              :key="i"
              class="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-[#8a93a6]"
              :style="{ animationDelay: `${(i - 1) * 160}ms` }"
            />
          </div>
        </Transition>

        <p
          v-for="(line, index) in story"
          :key="line.text"
          ref="paragraphEls"
          class="story-paragraph"
          :class="[
            index < revealedCount && 'is-shown',
            line.heading
              ? 'text-[20px] font-bold leading-[1.25] tracking-[-0.01em] [--word-final:#0f172a] dark:[--word-final:#fff]'
              : 'mt-2.5 text-[14px] leading-[1.55] [--word-final:rgb(var(--color-gray-600))] dark:[--word-final:#cfd5e1]',
          ]"
          :aria-label="line.text"
        >
          <template v-for="(word, w) in line.text.split(' ')" :key="w">
            <span class="story-word" aria-hidden="true">{{ word }}</span
            >{{ " " }}
          </template>
        </p>

        <div
          class="story-line flex flex-wrap items-center justify-end gap-2 mt-5"
          :class="phase === 'done' && 'is-shown'"
          :inert="phase !== 'done'"
        >
          <CowButton variant="secondary" size="sm" @click.stop="close">
            Not now
          </CowButton>
          <CowButton variant="primary" size="sm" @click.stop="restore">
            Restore Teams
          </CowButton>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: []; restore: [] }>()

// Only shown to churches that once had Teams, so it speaks to what Teams
// gave them. No numbers or teammate counts: it has to land for a solo
// operator on Teams and a ten-person media team alike.
const story = [
  { text: "Remember those Sunday mornings?", heading: true },
  {
    text: "Every operator on their own machine, so nobody has to lean over whoever is running the live screen?",
  },
  {
    text: "Over 13,000 songs to search, with more added all the time?",
  },
  {
    text: "That's the communal effect that Teams gives your service unit.",
  },
]

const TYPING_MS = 1400
// Wave shape: each visual line starts a beat after the one above it, and
// words ripple left to right within a line.
const LINE_STAGGER_MS = 120
const WORD_STAGGER_MS = 55
const WORD_ANIMATION_MS = 900
// Pause after a paragraph finishes, scaled so longer ones get read.
const readingPause = (text: string) => 300 + text.split(" ").length * 45

const phase = ref<"typing" | "telling" | "done">("typing")
const revealedCount = ref(0)
const skipped = ref(false)
const paragraphEls = ref<HTMLElement[]>([])
let timers: ReturnType<typeof setTimeout>[] = []

const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}

// Lays the delays out by where each word actually wrapped, so the wave runs
// diagonally down the paragraph whatever the modal width. Returns how long
// the whole paragraph takes to settle.
const stageWave = (paragraph: HTMLElement) => {
  const words = [...paragraph.querySelectorAll<HTMLElement>(".story-word")]
  let row = -1
  let col = 0
  let lastTop: number | null = null
  let longest = 0

  words.forEach((word) => {
    if (word.offsetTop !== lastTop) {
      lastTop = word.offsetTop
      row++
      col = 0
    }
    const delay = row * LINE_STAGGER_MS + col * WORD_STAGGER_MS
    word.style.setProperty("--word-delay", `${delay}ms`)
    longest = Math.max(longest, delay)
    col++
  })

  return longest + WORD_ANIMATION_MS
}

const skipStory = () => {
  clearTimers()
  skipped.value = true
  revealedCount.value = story.length
  phase.value = "done"
}

const revealParagraph = (index: number) => {
  const paragraph = paragraphEls.value[index]
  const duration = paragraph ? stageWave(paragraph) : WORD_ANIMATION_MS
  phase.value = "telling"
  revealedCount.value = index + 1

  const settleAt = duration + readingPause(story[index]!.text)
  if (index + 1 < story.length) {
    timers.push(setTimeout(() => revealParagraph(index + 1), settleAt))
  } else {
    timers.push(setTimeout(() => (phase.value = "done"), duration))
  }
}

const playStory = () => {
  clearTimers()
  skipped.value = false
  revealedCount.value = 0
  phase.value = "typing"

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    skipStory()
    return
  }

  timers.push(setTimeout(() => revealParagraph(0), TYPING_MS))
}

watch(
  () => props.visible,
  (isVisible) => (isVisible ? playStory() : clearTimers()),
  { immediate: true }
)

onBeforeUnmount(clearTimers)

const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    if (!value) emit("close")
  },
})

const close = () => emit("close")

const restore = () => {
  emit("restore")
  emit("close")
}
</script>

<style scoped>
/* Words start invisible and tinted with the brand purple, then settle into
   the paragraph's own colour (set per paragraph via --word-final). */
.story-word {
  opacity: 0;
}

.story-paragraph.is-shown .story-word {
  animation: word-in 900ms ease-out var(--word-delay, 0ms) both;
}

@keyframes word-in {
  0% {
    opacity: 0;
    color: rgb(var(--color-primary-300));
  }
  35% {
    opacity: 1;
    color: rgb(var(--color-primary-500));
  }
  100% {
    opacity: 1;
    color: var(--word-final);
  }
}

.is-skipped .story-word {
  animation: none;
  opacity: 1;
  color: var(--word-final);
}

.story-line {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 500ms ease, transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.story-line.is-shown {
  opacity: 1;
  transform: none;
}

.typing-dot {
  animation: typing-bounce 1s ease-in-out infinite;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.typing-leave-active {
  transition: opacity 200ms ease;
}

.typing-leave-to {
  opacity: 0;
}
</style>
