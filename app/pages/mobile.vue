<template>
  <div
    class="mobile-operator flex flex-col gap-2 px-2 pt-2 overflow-hidden"
    :style="{ height: 'calc(100dvh - 58px - env(safe-area-inset-top))' }"
  >
    <!-- CONTENT AREA — the grid and the three tabs share it, one at a time.
         The tabs render inside it rather than over the whole viewport, so the
         action bar below and the app navbar above stay on screen and switching
         tabs never feels like leaving the app. -->
    <div class="mobile-content relative flex-1 min-w-0 min-h-0">
      <!-- DEFAULT VIEW: the slide grid. It is both the schedule and the way in
           to every slide, so it holds the screen and nothing is layered over it
           until the operator asks for something. -->
      <PreviewContent
        mobile
        class="h-full min-w-0 min-h-0"
        @slide-created="activeTab = null"
      />

      <!-- QUICK ACTIONS: the same pane as the desktop left column, given the
           whole screen. Its own sub-pages (Bible, songs, hymns, media, library,
           templates, countdown, PDF import) already take over the pane on
           desktop, so they fill the sheet here without any special casing. -->
      <MobileSheet
        :model-value="activeTab === 'quick-actions'"
        title="Quick Actions"
        inline
        headerless
        @update:model-value="activeTab = null"
      >
        <QuickActions mobile class="h-full" />
      </MobileSheet>

      <!-- LIVE: the desktop console's right column, the live preview on top,
           the slide schedule under it, and the live-output menu (livestream link,
           blank) in its header. Unchanged apart from `mobile`, which swaps the
           draggable preview height for a fixed 16:9. -->
      <MobileSheet
        :model-value="activeTab === 'live'"
        title="Live"
        inline
        headerless
        @update:model-value="activeTab = null"
      >
        <LiveOutput mobile class="h-full min-h-0" @edit-slide="activeTab = null" />
      </MobileSheet>

      <!-- SCHEDULES: switching which service you are working on. -->
      <MobileSheet
        :model-value="activeTab === 'schedules'"
        title="Schedules"
        inline
        headerless
        @update:model-value="activeTab = null"
      >
        <AppSection class="h-full min-h-0">
          <SchedulesList
            class="h-full min-h-0 overflow-auto"
            @close="activeTab = null"
          />
        </AppSection>
      </MobileSheet>
    </div>

    <MobileActionBar
      :active-tab="activeTab"
      @open-quick-actions="toggleTab('quick-actions')"
      @open-schedules="toggleTab('schedules')"
      @open-live="toggleTab('live')"
    />
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
  // indicator. Pinch-zoom is deliberately left enabled, because `maximum-scale=1`
  // would block it, and someone reading small lyrics text on a phone is exactly
  // who needs it. iOS's own zoom-on-focus is handled in CSS below instead.
  meta: [
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover",
    },
  ],
})

// One tab at a time, or none — the slide grid is what a closed tab returns to.
// Tapping the tab you are already on closes it, which is the only way back to
// the grid now that the tabs have no close button of their own.
type MobileTab = "quick-actions" | "schedules" | "live"
const activeTab = ref<MobileTab | null>(null)
const toggleTab = (tab: MobileTab) => {
  activeTab.value = activeTab.value === tab ? null : tab
}

// The middleware gate can only fire once the church has loaded, and on a cold
// start the route resolves before that. Re-checking here catches the church
// landing a moment later and moves a Free-plan operator to the upgrade wall
// rather than leaving them in an app they cannot use.
const { isTeamsPlan } = useSubscription()
const { checkFlag } = useFeatureFlags()
watch(
  isTeamsPlan,
  (isTeams) => {
    if (!isTeams && checkFlag("teams")) navigateTo("/mobile-upgrade")
  },
  { immediate: true }
)

// The realtime session, identical to the desktop console's. A phone in a
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
    if (activeTab.value === "schedules") activeTab.value = null
  }
)

// Settings, upgrade prompts and the shortcuts modal are owned by the `app`
// layout, which this route shares, so there is nothing to mount here.
</script>

