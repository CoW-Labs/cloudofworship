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
            'text-[clamp(1.25rem,min(7vh,6vw),4.5rem)]',
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
  normaliseStageTimer,
  stageTimerReading,
} from "~/utils/stageTimer"
import {
  stageStreamCountdownLeft,
  type StageStreamClock,
} from "~/utils/stageStream"

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
  /**
   * `/stagestream`: read the console's timer and countdown from the stream
   * instead of this window's own. Decided once, when the panel mounts — a
   * streamed panel never syncs or drives a local timer, and shows no controls,
   * since the phone reading it is not the one running the service.
   */
  stream?: StageStreamClock | null
}>()

const isStream = !!props.stream
const stageTimer = isStream ? null : useStageTimerSync()

const timer = computed(() =>
  props.stream ? normaliseStageTimer(props.stream.timer) : stageTimer!.timer.value
)

// The stream's clock readings are all on the sending console's clock.
const clockNow = () => Date.now() + (props.stream?.offsetMs || 0)

// A ticking clock reference rather than a ticking counter: the reading is
// always derived from the shared start time, so a tick the browser throttled
// or skipped corrects itself on the next one instead of losing time.
const now = ref(clockNow())
let ticker: ReturnType<typeof setInterval> | null = null

/** The countdown slide on screen, as the panel shows it. */
const liveCountdown = computed<Pick<Countdown, "timeLeft" | "content"> | undefined>(() => {
  if (props.stream) {
    const countdown = props.stream.countdown
    if (!countdown) return undefined
    return {
      timeLeft: useMilliToTimeString(
        stageStreamCountdownLeft(countdown, props.stream.sentAt, now.value)
      ),
      content: countdown.content,
    }
  }
  return props.slide?.type === slideTypes.countdown
    ? (props.slide?.data as Countdown | undefined)
    : undefined
})

const running = computed(
  () => timer.value.running || !!props.stream?.countdown?.running
)

const mode = computed<"stage-countdown" | "countdown" | "timer">(() => {
  if (timer.value.mode === "countdown") return "stage-countdown"
  if (liveCountdown.value?.timeLeft) return "countdown"
  return "timer"
})

/** True for the two clocks this screen owns and can control. */
const isStageClock = computed(() => !isStream && mode.value !== "countdown")
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
    ? isStageCountdownFinished(timer.value, now.value)
    : mode.value === "countdown"
    ? useTimeStringToMilli(liveCountdown.value?.timeLeft || "00:00:00") <= 0
    : false
)

const displayTime = computed(() =>
  mode.value === "countdown"
    ? liveCountdown.value?.timeLeft || "00:00:00"
    : useMilliToTimeString(stageTimerReading(timer.value, now.value))
)

// What the slide-and-position line says, used whenever the clock itself has
// nothing of its own to say.
const slideName = computed(() =>
  props.stream ? props.stream.slideName : props.slide?.name || ""
)

const slideSubtitle = computed(() => {
  if (props.slidePosition && props.slideCount) {
    return `${slideName.value || "Live"} • Slide ${props.slidePosition} of ${
      props.slideCount
    }`
  }
  return slideName.value || "No slide live"
})

const subtitle = computed(() => {
  if (mode.value === "stage-countdown") {
    return timer.value.message || slideSubtitle.value
  }
  if (mode.value === "countdown") {
    return liveCountdown.value?.content || slideName.value
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
    now.value = clockNow()
  }, 250)
}

// Only a running clock needs the interval; a paused one cannot change until
// somebody sends a command, which updates the shared state on its own.
watch(
  running,
  (isRunning) => {
    now.value = clockNow()
    if (isRunning) startTicking()
    else stopTicking()
  },
  { immediate: true }
)

const toggle = () => stageTimer?.toggle()
const reset = () => stageTimer?.reset()

// A new stream message can move the offset or the countdown without changing
// whether anything is running, so take a fresh reading rather than wait a tick.
watch(
  () => props.stream,
  () => {
    now.value = clockNow()
  }
)

onBeforeUnmount(stopTicking)
</script>
