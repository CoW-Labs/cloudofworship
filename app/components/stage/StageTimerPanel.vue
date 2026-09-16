<template>
  <StagePanel tone="muted" class="stage-timer-panel">
    <div class="flex h-full min-h-0 items-center justify-between gap-6">
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p
          class="text-[0.65rem] font-bold uppercase tracking-[0.2em] sm:text-xs"
          :class="mode === 'stage-countdown' ? 'text-purple-300/70' : 'text-white/50'"
        >
          {{ label }}
        </p>
        <p
          class="font-extrabold tabular-nums leading-none"
          :class="[
            isFinished ? 'text-red-400' : 'text-white',
            'text-[clamp(2rem,7vh,4.5rem)]',
          ]"
        >
          {{ displayTime }}
        </p>
        <p class="truncate text-sm text-white/60 sm:text-base">
          {{ subtitle }}
        </p>
      </div>

      <!-- The live countdown belongs to the slide the operator is running, so
           it has no controls here. Everything else on this panel is the stage
           screen's own clock and can be driven from it.
           `.stop` on both events so tapping the controls never trips the
           page's double-click-to-fullscreen handler. -->
      <div
        v-if="isStageClock"
        class="flex shrink-0 items-center gap-2 opacity-40 transition-opacity hover:opacity-100"
        @dblclick.stop
      >
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
          :aria-label="running ? `Pause ${controlNoun}` : `Start ${controlNoun}`"
          @click.stop="toggle"
        >
          <UIcon
            :name="running ? 'i-bx-pause' : 'i-bx-play'"
            class="h-6 w-6"
            dynamic
          />
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
          :aria-label="`Reset ${controlNoun}`"
          @click.stop="reset"
        >
          <UIcon name="i-bx-reset" class="h-5 w-5" dynamic />
        </button>
      </div>
    </div>
  </StagePanel>
</template>

<script setup lang="ts">
import type { Countdown, Slide } from "~/types"
import {
  isStageCountdownFinished,
  stageTimerReading,
} from "~/utils/stageTimer"

/**
 * Bottom-left panel: whatever clock the stage needs most right now.
 *
 *  - **Stage countdown** — one the operator sent to this screen alone (see
 *    `useStageTimer`). It wins because it was aimed here deliberately.
 *  - **Countdown** — mirrors the countdown slide the congregation is looking
 *    at, so the band knows what the room knows.
 *  - **Timer** — the service stopwatch, when there is nothing to count down.
 *
 * The first and last are shared state, so the operator can drive them from
 * quick actions and every stage screen shows the same reading; the buttons
 * here drive that same state.
 */
const props = defineProps<{
  slide?: Slide | null
  /** 1-based position of the live slide in the schedule. */
  slidePosition?: number
  slideCount?: number
}>()

const stageTimer = useStageTimerSync()
const running = computed(() => stageTimer.isRunning.value)

// A ticking clock reference rather than a ticking counter: the reading is
// always derived from the shared start time, so a tick the browser throttled
// or skipped corrects itself on the next one instead of losing time.
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const liveCountdown = computed(() =>
  props.slide?.type === slideTypes.countdown
    ? (props.slide?.data as Countdown | undefined)
    : undefined
)

const mode = computed<"stage-countdown" | "countdown" | "timer">(() => {
  if (stageTimer.isCountdown.value) return "stage-countdown"
  if (liveCountdown.value?.timeLeft) return "countdown"
  return "timer"
})

/** True for the two clocks this screen owns and can control. */
const isStageClock = computed(() => mode.value !== "countdown")
const controlNoun = computed(() =>
  mode.value === "stage-countdown" ? "countdown" : "timer"
)

const label = computed(() =>
  mode.value === "stage-countdown"
    ? "Stage Countdown"
    : mode.value === "countdown"
    ? "Countdown"
    : "Timer"
)

const isFinished = computed(() =>
  mode.value === "stage-countdown"
    ? isStageCountdownFinished(stageTimer.timer.value, now.value)
    : mode.value === "countdown"
    ? useTimeStringToMilli(liveCountdown.value?.timeLeft || "00:00:00") <= 0
    : false
)

const displayTime = computed(() =>
  mode.value === "countdown"
    ? liveCountdown.value?.timeLeft || "00:00:00"
    : useMilliToTimeString(stageTimerReading(stageTimer.timer.value, now.value))
)

// What the slide-and-position line says, used whenever the clock itself has
// nothing of its own to say.
const slideSubtitle = computed(() => {
  if (props.slidePosition && props.slideCount) {
    return `${props.slide?.name || "Live"} • Slide ${props.slidePosition} of ${
      props.slideCount
    }`
  }
  return props.slide?.name || "No slide live"
})

const subtitle = computed(() => {
  if (mode.value === "stage-countdown") {
    return stageTimer.timer.value.message || slideSubtitle.value
  }
  if (mode.value === "countdown") {
    return liveCountdown.value?.content || props.slide?.name || ""
  }
  return slideSubtitle.value
})

const stopTicking = () => {
  if (ticker) clearInterval(ticker)
  ticker = null
}

const startTicking = () => {
  if (ticker) return
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 250)
}

// Only a running clock needs the interval; a paused one cannot change until
// somebody sends a command, which updates the shared state on its own.
watch(
  running,
  (isRunning) => {
    now.value = Date.now()
    if (isRunning) startTicking()
    else stopTicking()
  },
  { immediate: true }
)

const toggle = () => stageTimer.toggle()
const reset = () => stageTimer.reset()

onBeforeUnmount(stopTicking)
</script>
