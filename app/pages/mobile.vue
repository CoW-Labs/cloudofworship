<template>
  <div
    class="mobile-operator flex h-full min-h-0 flex-col gap-2 overflow-hidden px-2 pt-2"
  >
    <!-- CONTENT AREA — the grid and the tabs share it, one at a time.
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
        @slide-created="onSlideCreated"
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

      <!-- TRANSCRIBE: the desktop console's transcript panel, given the screen.
           Headerless like the other tabs — the panel carries its own title,
           session controls and "Close panel" action, so a sheet header would
           only repeat them. It is the one tab that stays mounted once opened:
           the panel owns the microphone and stops the session when it is torn
           down, and a sermon transcript has to survive the operator stepping
           away to take a slide live. -->
      <MobileSheet
        :model-value="activeTab === 'transcribe'"
        title="Transcribe"
        inline
        headerless
        :keep-mounted="transcribeOpened"
        @update:model-value="activeTab = null"
      >
        <TranscriptsPanel
          mobile
          :visible="activeTab === 'transcribe'"
          class="h-full min-h-0"
          @session="isTranscribing = $event"
          @close="activeTab = null"
        />
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

    <!-- A running session is invisible once the transcribe tab is closed, and a
         hot microphone that nobody can see is the wrong thing to leave on a
         phone. This is both the indicator and the way back into it. -->
    <Transition name="fade-sm">
      <button
        v-if="isTranscribing && activeTab !== 'transcribe'"
        type="button"
        class="transcribing-bar shrink-0 flex items-center justify-center gap-2 min-h-[36px] px-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium"
        @click="activeTab = 'transcribe'"
      >
        <span class="relative flex h-2 w-2 shrink-0">
          <span
            class="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping"
          />
          <span class="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        Transcribing · tap to return
      </button>
    </Transition>

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
import { appWideActions } from "~/utils/constants"
import type { Song } from "~/types"
import type { Emitter } from "mitt"

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
type MobileTab = "quick-actions" | "schedules" | "live" | "transcribe"
const activeTab = ref<MobileTab | null>(null)
const toggleTab = (tab: MobileTab) => {
  activeTab.value = activeTab.value === tab ? null : tab
}

// "Transcribe Sermon" is a Quick Action rather than a bar tab — it is opened
// once at the start of a sermon, not switched between. The panel it opens is
// the desktop console's, which on desktop lives in the live column; here it
// needs the whole screen, so the route takes the action and opens its own tab
// instead (LiveOutput ignores the event when it is mobile).
const emitter = useNuxtApp().$emitter as Emitter<any>
const transcribeOpened = ref(false)
const isTranscribing = ref(false)
const openTranscribe = () => {
  transcribeOpened.value = true
  activeTab.value = "transcribe"
}
emitter.on(appWideActions.newTranscribe, openTranscribe)
onBeforeUnmount(() => emitter.off(appWideActions.newTranscribe, openTranscribe))

// "Edit song in library" on a song (or song-setlist) slide opens the library's
// add-song form, which lives inside QuickActions. On this route QuickActions
// only exists while its tab is open, so the slide menu was emitting into
// nothing: the tab has to be opened first, and the event replayed once the
// panel is mounted and listening. The guard keeps the replay from re-entering
// this handler.
let replayingAddSong = false
const openAddSong = (song?: Song) => {
  if (replayingAddSong) return
  const wasMounted = activeTab.value === "quick-actions"
  activeTab.value = "quick-actions"
  if (wasMounted) return
  nextTick(() => {
    replayingAddSong = true
    try {
      emitter.emit(appWideActions.addSong, song)
    } finally {
      replayingAddSong = false
    }
  })
}
emitter.on(appWideActions.addSong, openAddSong)
onBeforeUnmount(() => emitter.off(appWideActions.addSong, openAddSong))

// Creating a slide steps out of the tab it was created from, so the editor is
// not left stacked behind it. Transcribe is the exception: it is a session the
// operator is watching, and a scripture it detected becoming a slide is not a
// reason to throw them out of it.
const onSlideCreated = () => {
  if (activeTab.value === "transcribe") return
  activeTab.value = null
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

