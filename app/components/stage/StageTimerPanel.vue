<template>
  <StagePanel tone="muted" class="stage-timer-panel">
    <div class="flex h-full min-h-0 items-center justify-between gap-6">
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p
          class="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/50 sm:text-xs"
        >
          {{ mode === "countdown" ? "Countdown" : "Timer" }}
        </p>
        <p
          class="font-extrabold tabular-nums leading-none"
          :class="[
            mode === 'countdown' && isCountdownFinished
              ? 'text-red-400'
              : 'text-white',
            'text-[clamp(2rem,7vh,4.5rem)]',
          ]"
        >
          {{ displayTime }}
        </p>
        <p class="truncate text-sm text-white/60 sm:text-base">
          {{ subtitle }}
        </p>
      </div>

      <!-- `.stop` on both events so tapping the controls never trips the
           page's double-click-to-fullscreen handler. -->
      <div
        v-if="mode === 'timer'"
        class="flex shrink-0 items-center gap-2 opacity-40 transition-opacity hover:opacity-100"
        @dblclick.stop
      >
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
          :aria-label="running ? 'Pause timer' : 'Start timer'"
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
          aria-label="Reset timer"
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
import { stageTimerElapsed } from "~/utils/stageTimer"

/**
 * Bottom-left panel: the countdown that is currently on screen when there is
 * one, otherwise a stopwatch the team can run for the service or a segment.
 *
 * The stopwatch itself lives in shared state (`useStageTimerSync`) so the
 * operator can start, stop and restart it from quick actions and every stage
 * screen shows the same reading. The buttons here drive that same state.
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

const elapsedMs = computed(() =>
  stageTimerElapsed(stageTimer.timer.value, now.value)
)

const countdown = computed(() =>
  props.slide?.type === slideTypes.countdown
    ? (props.slide?.data as Countdown | undefined)
    : undefined
)

const mode = computed<"countdown" | "timer">(() =>
  countdown.value?.timeLeft ? "countdown" : "timer"
)

const isCountdownFinished = computed(
  () => useTimeStringToMilli(countdown.value?.timeLeft || "00:00:00") <= 0
)

const displayTime = computed(() =>
  mode.value === "countdown"
    ? countdown.value?.timeLeft || "00:00:00"
    : useMilliToTimeString(elapsedMs.value)
)

const subtitle = computed(() => {
  if (mode.value === "countdown") {
    return countdown.value?.content || props.slide?.name || ""
  }
  if (props.slidePosition && props.slideCount) {
    return `${props.slide?.name || "Live"} • Slide ${props.slidePosition} of ${
      props.slideCount
    }`
  }
  return props.slide?.name || "No slide live"
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

// Only a running timer needs the interval; a paused one cannot change until
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
