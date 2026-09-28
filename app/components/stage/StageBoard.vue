<template>
  <main
    class="grid min-h-0 flex-1 gap-4 px-4 pb-4 sm:gap-6 sm:px-6 sm:pb-6"
    :class="[
      LAYOUT_GRID[layout],
      // Room for the floating DisplayWindowBanner, which would otherwise sit
      // over the NOW and NEXT headers. Top padding is set only here so no
      // shorthand elsewhere can override it.
      clearBanner ? 'pt-[84px]' : 'pt-4 sm:pt-6',
    ]"
  >
    <!-- Every row or column given to a clock is taken from the words, so on a
         small screen the clocks move out of their way: stacked, they share the
         last row; short, they share a narrow column on the right. -->
    <StagePanel
      label="Now"
      tone="now"
      class="min-h-0"
      :class="PANEL_SPAN[layout]"
    >
      <template v-if="now.label" #header>
        <p
          class="line-clamp-2 text-[clamp(1rem,min(4.5vh,5.5vw),3rem)] font-bold uppercase leading-tight tracking-[0.06em] text-white/70"
        >
          {{ now.label }}
        </p>
      </template>

      <StageAutoText v-if="now.text" :text="now.text" />
      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-3 text-center text-white/40"
      >
        <UIcon :name="now.icon" class="h-10 w-10" dynamic />
        <p class="text-xl font-semibold">{{ now.placeholder }}</p>
      </div>
    </StagePanel>

    <StagePanel
      label="Next"
      tone="next"
      class="min-h-0"
      :class="PANEL_SPAN[layout]"
    >
      <template v-if="next.label" #header>
        <p
          class="line-clamp-2 text-[clamp(1rem,min(4.5vh,5.5vw),3rem)] font-bold uppercase leading-tight tracking-[0.06em] text-purple-300/90"
        >
          {{ next.label }}
        </p>
      </template>

      <StageAutoText v-if="next.text" :text="next.text" />
      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-3 text-center text-purple-300/40"
      >
        <UIcon :name="next.icon" class="h-10 w-10" dynamic />
        <p class="text-xl font-semibold">{{ next.placeholder }}</p>
      </div>
    </StagePanel>

    <!-- The timer panel differs between the local stage window (its own synced
         timer, with controls) and a streamed one (the console's, read-only), so
         each page supplies it. -->
    <slot name="timer" />
    <StageClockPanel class="min-h-0" />
  </main>
</template>

<script setup lang="ts">
import { useWindowSize } from "@vueuse/core"
import type { StagePanelView } from "~/utils/stageView"

/**
 * The stage display's four panels — NOW, NEXT, the timer and the wall clock —
 * shared by the local stage window (`/stage`) and the streamed one
 * (`/stagestream/:schedule_id`), so a band sees the same screen either way.
 */
defineProps<{
  now: StagePanelView
  next: StagePanelView
  /** The floating banner is showing (the window is not full screen yet). */
  clearBanner?: boolean
}>()

// The stage screen is often a TV in portrait, a tablet on a music stand, or a
// phone either way up.
//   stacked — narrow and upright: NOW and NEXT full width, one above the other.
//   short   — too little height for two rows (a phone on its side): NOW and
//             NEXT full height, the clocks in a column beside them.
//   wide    — everything else: two-up, clocks along the bottom.
type StageLayout = "stacked" | "short" | "wide"

const LAYOUT_GRID: Record<StageLayout, string> = {
  stacked: "grid-cols-2 grid-rows-[1fr_1fr_auto]",
  short: "grid-cols-[1fr_1fr_12rem] grid-rows-2",
  wide: "grid-cols-2 grid-rows-[1fr_minmax(110px,0.3fr)]",
}

const PANEL_SPAN: Record<StageLayout, string> = {
  stacked: "col-span-2",
  short: "row-span-2",
  wide: "",
}

const { width, height } = useWindowSize()
const layout = computed<StageLayout>(() => {
  if (width.value < 900 && height.value >= width.value) return "stacked"
  if (height.value < 520) return "short"
  return "wide"
})
</script>
