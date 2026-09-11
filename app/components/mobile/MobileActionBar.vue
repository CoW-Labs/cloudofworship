<template>
  <nav
    class="mobile-action-bar shrink-0 flex items-center justify-between gap-2 px-3 pt-2 bg-white dark:bg-[#171d2b] border-t border-white/80 dark:border-[#202838]"
    :style="{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }"
    aria-label="Mobile actions"
  >
    <!-- SCHEDULES — the service you are working on. Secondary because it is a
         once-per-session switch, not something touched mid-service. -->
    <button
      type="button"
      class="bar-btn flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-2 rounded-xl text-gray-600 dark:text-[#9aa3b2] hover:bg-gray-100 dark:hover:bg-[#222938] transition-colors"
      @click="$emit('open-schedules')"
    >
      <SchedulesIcon class="w-5 h-5" />
      <span class="text-[11px] font-medium leading-none">Schedules</span>
    </button>

    <!-- QUICK ACTIONS — the whole point of the phone: adding slides, so it
         stays the one filled control in the bar. Sized to its own content
         rather than stretched across the gap: at full width it read as a form
         submit rather than one of three destinations, and the 48px height is
         what actually makes it a thumb-sized target. -->
    <CowButton
      variant="primary"
      size="lg"
      class="shrink-0 !rounded-xl !min-h-[48px] !px-5 font-semibold"
      @click="$emit('open-quick-actions')"
    >
      <template #leading><PlusIcon class="w-5 h-5" /></template>
      Quick Actions
    </CowButton>

    <!-- LIVE — the live preview and the slide schedule, i.e. what is on screen
         right now and what is queued behind it. This slot used to open
         Settings, which is already reachable from Quick Actions ("Open App
         Settings") and is not something anyone opens mid-service. -->
    <button
      type="button"
      class="bar-btn flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] px-2 rounded-xl transition-colors"
      :class="
        isLive
          ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
          : 'text-gray-600 dark:text-[#9aa3b2] hover:bg-gray-100 dark:hover:bg-[#222938]'
      "
      @click="$emit('open-live')"
    >
      <GoLiveIcon class="w-5 h-5" />
      <span class="text-[11px] font-medium leading-none">Live</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

defineEmits<{
  (e: "open-quick-actions"): void
  (e: "open-schedules"): void
  (e: "open-live"): void
}>()

// Tints the Live entry while something is actually on screen, so the bar says
// whether the congregation is looking at a slide without opening the sheet.
const appStore = useAppStore()
const isLive = computed(() => !!appStore.currentState.liveSlideId)
</script>
