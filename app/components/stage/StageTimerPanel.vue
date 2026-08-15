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

/**
 * Bottom-left panel: the countdown that is currently on screen when there is
 * one, otherwise a stopwatch the team can run for the service or a segment.
 */
const props = defineProps<{
  slide?: Slide | null
  /** 1-based position of the live slide in the schedule. */
  slidePosition?: number
  slideCount?: number
}>()

const running = ref(false)
const elapsedMs = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null
let startedAt = 0

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

const toggle = () => {
  if (running.value) {
    running.value = false
    stopTicking()
    return
  }

  running.value = true
  // Tracking against a wall-clock start keeps a long service timer accurate,
  // which a per-tick += 1000 would not be.
  startedAt = Date.now() - elapsedMs.value
  ticker = setInterval(() => {
    elapsedMs.value = Date.now() - startedAt
  }, 250)
}

const reset = () => {
  elapsedMs.value = 0
  startedAt = Date.now()
}

onBeforeUnmount(stopTicking)
</script>
