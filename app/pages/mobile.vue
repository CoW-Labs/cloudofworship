<template>
  <div
    class="mobile-operator flex flex-col gap-2 px-2 pt-2 h-[calc(100dvh-58px)] overflow-hidden"
  >
    <!-- DEFAULT VIEW — the slide grid. It is both the schedule and the way in
         to every slide, so it holds the screen and nothing is layered over it
         until the operator asks for something. -->
    <PreviewContent
      mobile
      class="flex-1 min-w-0 min-h-0"
      @slide-created="quickActionsOpen = false"
    />

    <MobileActionBar
      @open-quick-actions="quickActionsOpen = true"
      @open-schedules="schedulesOpen = true"
    />

    <!-- QUICK ACTIONS — the same pane as the desktop left column, given the
         whole screen. Its own sub-pages (Bible, songs, hymns, media, library,
         templates, countdown, PDF import) already take over the pane on
         desktop, so they fill the sheet here without any special casing. -->
    <MobileSheet v-model="quickActionsOpen" title="Quick Actions">
      <QuickActions mobile class="h-full" />
    </MobileSheet>

    <!-- SCHEDULES — switching which service you are working on. -->
    <MobileSheet v-model="schedulesOpen" title="Schedules">
      <AppSection class="h-full min-h-0">
        <SchedulesList
          class="h-full min-h-0 overflow-auto"
          @close="schedulesOpen = false"
        />
      </AppSection>
    </MobileSheet>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

definePageMeta({
  layout: "app",
})

useHead({
  title: "Cloud of Worship",
  link: [{ rel: "manifest", href: "/manifest.json" }],
  // `viewport-fit=cover` is what puts `env(safe-area-inset-*)` in play, which
  // the sheet header and the action bar use to clear the notch and the home
  // indicator. Pinch-zoom is deliberately left enabled — `maximum-scale=1`
  // would block it, and someone reading small lyrics text on a phone is exactly
  // who needs it. iOS's own zoom-on-focus is handled in CSS below instead.
  meta: [
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover",
    },
  ],
})

const quickActionsOpen = ref<boolean>(false)
const schedulesOpen = ref<boolean>(false)

// The realtime session — identical to the desktop console's. A phone in a
// service is a full member of the schedule: its slides reach everyone else's
// grid, and theirs reach its own.
useOperatorSession()

// Schedules are switched from a sheet, so the sheet has to get out of the way
// once the switch lands, or the operator is left staring at the list while the
// grid behind it reloads.
const appStore = useAppStore()
watch(
  () => appStore.currentState.activeSchedule?._id,
  () => {
    schedulesOpen.value = false
  }
)

// Settings, upgrade prompts and the shortcuts modal are owned by the `app`
// layout, which this route shares — nothing to mount here.
</script>

