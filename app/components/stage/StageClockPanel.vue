<template>
  <StagePanel tone="muted" class="stage-clock-panel">
    <div class="flex h-full min-h-0 flex-col justify-center gap-1">
      <p
        class="flex items-baseline gap-2 font-extrabold tabular-nums leading-none text-white"
      >
        <span class="text-[clamp(2rem,7vh,4.5rem)]">{{ time }}</span>
        <span class="text-[clamp(0.9rem,2.5vh,1.5rem)] text-white/60">{{
          meridiem
        }}</span>
      </p>
      <p class="truncate text-sm text-white/60 sm:text-base">{{ date }}</p>
    </div>
  </StagePanel>
</template>

<script setup lang="ts">
/**
 * Bottom-right panel. `useLiveClock` is minute-resolution (it exists to keep
 * slide previews cheap); a stage clock is watched while someone counts down
 * the end of a segment, so it ticks every second here instead.
 */
const time = ref("")
const meridiem = ref("")
const date = ref("")

let ticker: ReturnType<typeof setInterval> | null = null

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
})
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
})

const update = () => {
  const now = new Date()
  const parts = timeFormatter.formatToParts(now)
  meridiem.value =
    parts.find((part) => part.type === "dayPeriod")?.value?.toUpperCase() || ""
  time.value = parts
    .filter((part) => part.type !== "dayPeriod" && part.type !== "literal")
    .map((part) => part.value)
    .join(":")
  date.value = dateFormatter.format(now)
}

onMounted(() => {
  update()
  ticker = setInterval(update, 1000)
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  ticker = null
})
</script>
