<template>
  <AppSection
    heading="Quick Actions"
    :sub-heading="searchInput.length < 2 ? page?.replace('-', ' ') : 'Search'"
    :trail="
      searchInput.length < 2 && page === 'library' && libraryReviewing
        ? 'Review song'
        : undefined
    "
    class="w-full relative overflow-hidden z-20"
    @header-click="searchInput.length < 2 ? (page = '') : (searchInput = '')"
    @sub-header-click="libraryReviewing = false"
  >
    <!-- <Transition name="fade-sm" -->
    <!-- ACTIONS HOME SECTION -->
    <div
      v-if="page === ''"
      class="main fade-in-left flex flex-col h-full min-h-0 rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 overflow-hidden"
      ref="quickActions"
      tabindex="1"
    >
      <div class="group search-focus transition-all">
        <div class="flex gap-2">
          <div
            class="quick-actions-search-wrap relative flex-1 min-w-0 mb-2"
            :class="{ 'quick-actions-search-wrap--focused': isSearchFocused }"
            data-tour="quick-actions-search"
          >
            <UInput
              placeholder=" "
              aria-label="Search quick actions"
              autocomplete="off"
              v-model="searchInput"
              class="quick-actions-search w-full"
              ref="searchInputEl"
              @keydown="handleInputKeydown"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
            >
              <template #leading>
                <SearchIcon class="w-4 h-4 text-gray-400 dark:text-[#9aa3b2]" />
              </template>
            </UInput>
            <Transition name="quick-actions-placeholder-fade">
              <span
                v-if="!searchInput"
                :key="quickSearchPlaceholder"
                class="quick-actions-placeholder"
              >
                {{ quickSearchPlaceholder }}
              </span>
            </Transition>
          </div>
          <CowButton
            v-if="searchInput.length >= 2"
            variant="secondary"
            size="2xs"
            class="!px-2.5 !py-0 max-h-[40px] rounded-lg"
            @click="searchInput = ''"
          >
            <CloseIcon class="w-4 h-4" />
          </CowButton>
        </div>
      </div>

      <!-- QUICK FILTER CHIPS + PROMO CARD (only while a search session is
      active). The chips are local; the promo card below them is server-driven
      via /app-config/info. -->
      <div
        v-if="isSearchFocused && searchInput.length < 2"
        class="quick-search-panel come-up-1 mt-3 rounded-2xl bg-white dark:bg-[#2b3242] p-3 mb-2"
      >
        <!-- mousedown.prevent keeps focus in the search box, so picking a
        scope doesn't blur it and close this panel. -->
        <div class="quick-filters flex flex-wrap gap-2">
          <button
            v-for="filter in quickFilters"
            :key="filter.scope"
            class="quick-filter-chip flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
            :class="
              searchScope === filter.scope
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-[#222938] text-gray-600 dark:text-[#9aa3b2] hover:bg-gray-200 dark:hover:bg-[#1d2433]'
            "
            :aria-pressed="searchScope === filter.scope"
            @mousedown.prevent
            @click="toggleSearchScope(filter.scope)"
          >
            {{ filter.label }}
            <CloseIcon
              v-if="searchScope === filter.scope"
              class="w-5 h-5 rounded-full bg-gray-300 text-gray-900 dark:bg-gray-100 dark:text-gray-900 p-0.5"
            />
          </button>
        </div>

        <button
          v-if="quickSearchPromo"
          class="promo-card group w-full text-center rounded-xl border border-dashed border-gray-600 dark:border-[#586277] p-6 mt-6 mb-0 hover:border-primary-400 dark:hover:border-[#6b7588] transition-colors"
          @click="handlePromoClick"
        >
          <span
            v-if="quickSearchPromo.badge"
            class="inline-block text-[10px] font-bold tracking-wide bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-md px-2 py-0.5 mb-2"
          >
            {{ quickSearchPromo.badge }}
          </span>
          <h4 class="font-semibold text-base text-gray-900 dark:text-white">
            {{ quickSearchPromo.title }}
          </h4>
          <p
            v-if="quickSearchPromo.description"
            class="text-xs text-gray-500 dark:text-[#9aa3b2] mt-1 max-w-[220px] mx-auto"
          >
            {{ quickSearchPromo.description }}
          </p>
        </button>
      </div>

      <!-- BASIC ACTIONS -->
      <div
        v-if="searchInput.length < 2"
        class="actions-ctn -mx-1.5 mt-0 overflow-y-auto flex-1 min-h-0 bg-[#f1f3f6] dark:bg-[#222938]"
        ref="actionsContainer"
        data-tour="quick-actions-list"
      >
        <!-- Skeleton loader while IndexedDB is hydrating -->
        <template v-if="loading">
          <CowSkeleton variant="row" :count="20" />
        </template>

        <ActionCard
          v-else
          v-for="(action, index) in visibleActions"
          :key="getActionKey(action)"
          :action="action"
          compact
          :highlight-query="searchInput"
          :data-action-index="index"
          :active="hasInteracted && index === focusedActionIndex"
          :class="{
            'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
          @mouseenter="onRowMouseEnter(index)"
        />
      </div>

      <!-- SEARCHING ACTIONS -->
      <div
        v-else
        class="actions-ctn -mx-1.5 mt-0 overflow-y-auto flex-1 min-h-0 bg-[#f1f3f6] dark:bg-[#222938]"
        ref="actionsContainer"
        data-tour="quick-actions-list"
      >
        <!-- The chips panel closes once typing starts, so the scope it set
        stays visible (and removable) here. -->
        <div v-if="activeScopeFilter" class="flex px-3 pt-2 pb-1">
          <button
            class="quick-filter-chip flex items-center gap-1.5 text-xs rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 pl-3 pr-1 py-1 whitespace-nowrap"
            :aria-label="`Stop searching only ${activeScopeFilter.label}`"
            @mousedown.prevent
            @click="searchScope = null"
          >
            {{ activeScopeFilter.label }} only
            <CloseIcon
              class="w-4 h-4 rounded-full bg-gray-300 text-gray-900 dark:bg-gray-100 dark:text-gray-900 p-0.5"
            />
          </button>
        </div>

        <div
          v-if="isSearchingRemote"
          class="flex items-center gap-1.5 px-3 py-2"
        >
          <SearchIcon class="w-3.5 h-3.5 text-primary-400 shrink-0" />
          <span class="quick-actions-searching-text"
            >Searching global library&hellip;</span
          >
        </div>

        <p
          v-else-if="rankedSearchResults.length === 0"
          class="px-3 py-2 text-xs text-gray-500 dark:text-[#7d8695]"
        >
          No matches for &ldquo;{{ searchQuery }}&rdquo;{{
            activeScopeFilter
              ? ` in ${activeScopeFilter.label.toLowerCase()}`
              : ""
          }}.
        </p>

        <template
          v-for="(action, index) in searchedActions"
          :key="getActionKey(action)"
        >
          <p
            v-if="index === rankedSearchResults.length && index > 0"
            class="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wide text-gray-400 dark:text-[#7d8695]"
          >
            Not what you need?
          </p>
          <ActionCard
            :action="{
              ...action,
              bibleChapterAndVerse:
                action?.bibleChapterAndVerse || bibleChapterAndVerse,
            }"
            compact
            :show-subtext="
              !!action.desc &&
              (action.type === slideTypes.song ||
                action.type === slideTypes.hymn)
            "
            :highlight-query="searchQuery"
            :data-action-index="index"
            :active="hasInteracted && index === focusedActionIndex"
            :class="{
              'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
            }"
            @click="focusedActionIndex = index"
            @mouseenter="onRowMouseEnter(index)"
          >
            <template #desc>
              <span v-html="highlightText(action.desc ?? '', searchQuery)" />
            </template>
          </ActionCard>
        </template>
      </div>
    </div>

    <!-- SONG SECTION -->
    <BibleList
      v-else-if="page === 'bible'"
      :query="bibleSearchQuery"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- SONG SECTION -->
    <SongsList
      v-else-if="page === 'song'"
      :query="songSearchQuery"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- HYMN SECTION -->
    <HymnList
      v-else-if="page === 'hymn'"
      :query="hymnSearchQuery"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- MEDIA(IMAGE/VIDEO) SECTION-->
    <!-- AddMedia/AddPresentation own their scroll container so their CTA can
    stay pinned to the panel — do not add overflow here. -->
    <AddMedia
      v-else-if="page === 'media' || page === 'youtube' || page === 'vimeo'"
      class="fade-in-right h-full min-h-0"
      :initial-tab="page === 'youtube' || page === 'vimeo' ? 1 : 0"
      @close="page = ''"
    />

    <!-- SEARCH BIBLE SECTION-->
    <SearchBibleList
      v-else-if="page === 'search-bible'"
      :query="searchBibleQuery"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- LIBRARY SECTION-->
    <PersonalLibrary
      v-else-if="page === 'library'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      :page="libraryPage"
      :song-to-edit="librarySongToEdit"
      :new-song-title="libraryNewSongTitle"
      :open-token="libraryOpenToken"
      v-model:reviewing="libraryReviewing"
      @close="page = ''"
    />

    <!-- TEMPLATES SECTION-->
    <TemplatesList
      v-else-if="page === 'templates'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- SCHEDULES SECTION-->
    <SchedulesList
      v-else-if="page === 'schedules-list'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- LIBRARY SECTION-->
    <AddAlert
      v-else-if="page === 'alert'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- COUNTDOWN SECTION-->
    <AddCountdown
      v-else-if="page === 'countdown'"
      :initial-tab="countdownInitialTab"
      :stage-available="!mobile"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- INTERLUDE SECTION-->
    <AddInterlude
      v-else-if="page === 'interlude'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- CAMERA SECTION-->
    <AddCamera
      v-else-if="page === 'camera'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- IMPORT SLIDES (PRESENTATION) SECTION-->
    <AddPresentation
      v-else-if="page === 'presentation'"
      class="fade-in-right h-full min-h-0"
      file-type="ppt"
      @close="page = ''"
    />
    <AddPresentation
      v-else-if="page === 'presentation-pdf'"
      class="fade-in-right h-full min-h-0"
      file-type="pdf"
      @close="page = ''"
    />
    <!-- </Transition> -->

    <!-- One intro for whichever new action was opened first time round;
    trying it runs the action the operator picked. -->
    <FeatureIntroductionModal
      ref="actionIntroModal"
      :feature-key="actionIntro ? quickActionIntroKey(actionIntro.action) : ''"
      :title="actionIntro?.action.intro?.title || ''"
      :description="actionIntro?.action.intro?.description"
      :points="actionIntro?.action.intro?.points"
      :cta="actionIntro?.action.intro?.cta || 'Try it'"
      @cta="actionIntro?.run()"
    >
      <template v-if="introAnimation" #hero>
        <component :is="introAnimation" />
      </template>
    </FeatureIntroductionModal>
  </AppSection>
</template>

<script setup lang="ts">
import type { Hymn, QuickAction, Song } from "~/types"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import {
  prewarmScriptureVersion,
  isScriptureReferenceValidSync,
} from "~/composables/useScripture"
import { quickActionsArr, desktopOnlyActions } from "~/utils/constants"
import {
  ACTION_MATCH_SPREAD,
  ACTION_MATCH_THRESHOLD,
  CONTENT_NAME_THRESHOLD,
  actionMatchStrength,
  isSdaHymnalNumber,
  namesActionExactly,
  normalizeSearchText,
  normalizeSongTitle,
  parseHymnalNumberQuery,
  resolveBibleBook,
  sharesMeaningfulWord,
  songTitleMatchRank,
  textMatchRank,
  titleHasNumber,
} from "~/utils/quickSearch"
import { escapePriority } from "~/composables/useEscapeKey"
import { quickActionIntroKey } from "~/composables/useFeatureIntros"
import { INTRO_ANIMATIONS } from "~/utils/introAnimations"
import { useDebounceFn, useOnline } from "@vueuse/core"
import fuzzysort from "fuzzysort"
const db = useIndexedDB()
const { openFeatureOrUpgrade, requireFeatureAccess } = useSubscription()

// New actions (ActionCard clicks and Enter here) wait on their intro, which
// this panel hosts for both the desktop operator view and /mobile.
const {
  introduceThen,
  pendingIntro: actionIntro,
  introHosts,
} = useFeatureIntros()
const actionIntroModal = ref<{ show: () => boolean } | null>(null)
const introAnimation = computed(() => {
  const key = actionIntro.value?.action.intro?.animation
  return key ? INTRO_ANIMATIONS[key] : undefined
})
watch(actionIntro, async (intro) => {
  if (!intro) return
  await nextTick()
  // Seen on another surface since the click was queued: just run it.
  if (!actionIntroModal.value?.show()) intro.run()
})
onMounted(() => introHosts.value++)
onUnmounted(() => {
  introHosts.value--
  actionIntro.value = null
})
const online = useOnline()
// Rollout switch: the camera action is only offered while the flag is on.
const { isEnabled: cameraSlideEnabled } = useFeatureFlags("camera-slide")
const { savedSongs } = useLibrary()
const { searchSongs } = useSongs()

const props = withDefaults(
  defineProps<{
    /**
     * Renders inside the mobile route's full-screen sheet rather than the
     * desktop console's left panel. The pane itself is unchanged — this only
     * drops the actions a phone cannot carry out (see `desktopOnlyActions`),
     * so a mobile operator never taps "Go Live" and gets nothing.
     */
    mobile?: boolean
  }>(),
  { mobile: false }
)

const searchInputEl = ref<{ input: HTMLInputElement }>()
const searchInput = ref<string>("")
// What the results are ranked for. It follows the box, but while typing it
// waits for a short pause: ranking reads every hymn and saved song's lyrics,
// and an older laptop doing that on each keystroke makes the typing lag.
// Showing or hiding the results (crossing two letters) lands at once, and so
// does anything that acts on the results (arrows, Enter); see
// `flushSearchTerm`.
const SEARCH_RANK_DELAY_MS = 90
const searchTerm = ref<string>("")
let searchTermTimer: ReturnType<typeof setTimeout> | null = null
const flushSearchTerm = () => {
  if (searchTermTimer) clearTimeout(searchTermTimer)
  searchTermTimer = null
  searchTerm.value = searchInput.value
}
// Titles are not unique across sources. For example, the library, remote song
// search, and hymn catalogue can all contain multiple entries named "Amazing
// Grace". Give each action object a stable identity so Vue can move grouped
// results without reusing the wrong row or reporting duplicate keys.
const actionKeys = new WeakMap<QuickAction, number>()
let nextActionKey = 0
const getActionKey = (action: QuickAction) => {
  let key = actionKeys.get(action)
  if (key === undefined) {
    key = ++nextActionKey
    actionKeys.set(action, key)
  }
  return key
}
// Tracks whether the search box currently has focus — drives the quick-filter
// chips, which should only appear during an active search session (focused),
// not on the idle home state.
const isSearchFocused = ref(false)
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null
// Every suggestion is checked to land on what it promises: its action, verse
// or song as the top result. Phrases that only described a wish ("kids pickup
// alert", "Canva slides") taught operators that search doesn't work.
const quickSearchSuggestionsByAction = {
  bible: [
    "Matt 28 19",
    "Psa 27:4",
    "John 3:16",
    "Rom 8:28",
    "Isaiah 53",
    "Gen 1:1",
    "Eph 3 20",
  ],
  bibleSearch: [
    "love your enemies",
    "faith hope love",
    "the Lord is my shepherd",
    "be still and know",
    "armor of God",
    "fruit of the spirit",
  ],
  hymns: [
    "Rock of Ages",
    "Amazing Grace",
    "Blessed Assurance",
    "How Great Thou Art",
    "Great Is Thy Faithfulness",
    "It Is Well",
    "Holy Holy Holy",
  ],
  songs: [
    "Promises by Maverick City",
    "Good and Loved",
    "Yahweh Sabaoth",
    "Way Maker",
    "Jireh",
    "Firm Foundation",
    "What a Beautiful Name",
  ],
  songSetlists: [
    "song setlist",
    "worship set",
    "opening worship set",
    "closing worship songs",
  ],
  textSlides: [
    "Create Text Slide",
  ],
  media: [
    "image library",
    "Add Media",
    "upload video",
    "background image",
    "audio file",
  ],
  // Slide templates are hidden for everyone for now.
  // templates: [
  //   "Slide Templates",
  //   "lower third template",
  //   "sermon notes template",
  //   "announcement template",
  //   "Bible verse template",
  //   "minimal worship template",
  //   "countdown template",
  // ],
  alerts: [
    "Add Banners/Alert",
    "Remove Alert",
    "offering banner",
  ],
  countdowns: ["Add Countdown Timer", "5 min timer", "30s timer"],
  times: ["Add Time Slide", "current time", "clock", "live clock"],
  embeds: [
    "Add YouTube Video",
    "Add Vimeo Video",
    "YouTube worship video",
  ],
  presentations: [
    "Import Slides",
    "PDF presentation",
  ],
  library: [
    "My Library",
    "personal media",
  ],
  transcription: [
    "Transcribe Sermon",
    "sermon transcription",
    "auto Bible slides",
    "audio to text",
  ],
  liveControl: [
    "Go Live",
    "Open Stage Display",
    "confidence monitor",
    "Close Live Window",
    "Promote Slide to Live",
    "Select Slides",
    "present now",
    "open projector",
    "bulk select slides",
  ],
  sync: [
    "Refresh Slides",
    "Upload Offline Slides",
    "sync slides",
    "cloud backup",
    "offline uploads",
    "save to cloud",
  ],
  settings: [
    "dark mode",
    "bible settings",
    "Display Settings",
    "Profile Settings",
    "Slide Background Settings",
    "Microphone Settings",
    "Subscription Settings",
    "Overlay Settings",
    "Blank Settings",
    "Other Settings",
  ],
  account: [
    "Invite to Workspace",
    "Shortcuts & Hotkeys",
    "Upgrade Plan",
    "Sign Out",
    "Join Community",
    "What's New",
    "Create New Schedule",
  ],
}
const quickSearchSuggestions = Object.values(
  quickSearchSuggestionsByAction
).flat()
const quickSearchSuggestionIndex = ref(0)
const quickSearchPlaceholder = computed(() =>
  activeScopeFilter.value
    ? activeScopeFilter.value.placeholder
    : `Try "${quickSearchSuggestions[quickSearchSuggestionIndex.value]}"`
)
let quickSearchSuggestionInterval: ReturnType<typeof setInterval> | null = null

const handleSearchFocus = () => {
  if (searchBlurTimeout) clearTimeout(searchBlurTimeout)
  isSearchFocused.value = true
}

const handleSearchBlur = () => {
  // The panel is tied purely to the input being active, so blurring always
  // closes it — whatever has been typed. Delayed slightly so a click on a chip
  // (which blurs the input first) still registers before the chips disappear;
  // chips that refocus the input re-open it via handleSearchFocus.
  searchBlurTimeout = setTimeout(() => {
    isSearchFocused.value = false
    // Leaving an empty box ends the search session, scope included; with a
    // query still in it the scope stays, shown above the results.
    if (!searchInput.value) searchScope.value = null
  }, 150)
}
const focusedActionIndex = ref<number>(0)
const hasInteracted = ref(false)
const onRowMouseEnter = (index: number) => {
  focusedActionIndex.value = index
  // Hover previews are owned by ActionCard. Keep `active` exclusively for
  // keyboard navigation so it cannot become sticky after the pointer leaves.
  hasInteracted.value = false
}

// Any hover-preview (bible/hymn/song excerpt) is tied to `hasInteracted` being
// true for the active row. Hovering a row keeps it "active" until another row
// is hovered, so clicking elsewhere in the app (a slide in PreviewContent,
// opening a modal, etc.) would otherwise leave a stale preview on screen since
// nothing inside QuickActions ever told it to close. Clearing `hasInteracted`
// on any pointerdown outside this panel (and outside the teleported preview
// box itself, so scrolling/selecting its text doesn't dismiss it) closes it.
const handleOutsidePointerDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (quickActions.value?.contains(target)) return
  if (target?.closest?.(".action-excerpt")) return
  hasInteracted.value = false
}
const loading = ref(true)
const quickActions = ref<HTMLDivElement | null>(null)
const actionsContainer = ref<HTMLDivElement | null>(null)
const appStore = useAppStore()
const page = ref<string>("") // song, search, bible, hymn...
const songSearchQuery = ref<string>("")
const bibleSearchQuery = ref<string>("")
// Searches carried into the hymn and Bible-text panels by quick search's
// "See all hymn results" / "Search Bible text" rows.
const hymnSearchQuery = ref<string>("")
const searchBibleQuery = ref<string>("")
const hymns = ref<Hymn[]>([])
const emitter = useNuxtApp().$emitter as Emitter<any>

// On the desktop console this panel is mounted for the life of the route, so
// handlers registered in setup never needed taking off again. The mobile route
// tears it down every time its tab is closed, and a handler left behind keeps a
// dead instance listening — "remove-alert" would then fire once per reopen,
// with a toast and a socket emit each time. Register through this so every
// binding comes off with the component.
const emitterBindings: Array<[string, (payload?: any) => void]> = []
const onEmitter = (type: string, handler: (payload?: any) => void) => {
  emitterBindings.push([type, handler])
  emitter.on(type, handler)
}
onUnmounted(() => {
  emitterBindings.forEach(([type, handler]) => emitter.off(type, handler))
  emitterBindings.length = 0
})
const libraryPage = ref<string>("")
const librarySongToEdit = ref<Song | undefined>()
const libraryNewSongTitle = ref<string>("")
const libraryOpenToken = ref<number>(0)
// The add-song form's review step: the breadcrumb's "Library" steps back to it.
const libraryReviewing = ref<boolean>(false)
// Which destination the countdown panel opens on: 0 live display, 1 stage.
const countdownInitialTab = ref<number>(0)

// Active Bible version, used to validate parsed references against the right
// verse index (see the reference filter in `rankedSearchResults`).
const defaultBibleVersion = computed(
  () => appStore.currentState.settings.defaultBibleVersion || "KJV"
)

// Bumped once the verse index for the active version has been built. Read inside
// `rankedSearchResults` so it re-runs and can drop impossible references (e.g. a
// verse that doesn't exist) as soon as the data needed to verify them is ready
// — the chapter-level check works without it, this only refines it.
const scriptureIndexReadyTick = ref(0)
// Building the verse index means parsing a ~6MB / 31k-verse translation, so it's
// deferred until the user actually types a Bible reference (see the watch on
// `isBibleReferenceSearch` below) rather than run at app startup. Idempotent:
// `getVersionIndex` caches the built index, and `prewarmedVersion` stops repeat
// builds/recomputes for a version that's already indexed.
const prewarmedVersion = ref<string | null>(null)
const ensureScriptureIndex = async () => {
  const version = defaultBibleVersion.value
  if (prewarmedVersion.value === version) return
  prewarmedVersion.value = version
  await prewarmScriptureVersion(version)
  scriptureIndexReadyTick.value++
}

// Quick-filter chips shown while the search box is focused. Each one narrows
// the search to a single kind of result, and that focus buys a longer list of
// it (the scoped caps in `rankedSearchResults`). Library is the church's
// saved songs.
type SearchScope = "bible" | "song" | "hymn" | "library" | "action"
const quickFilters: {
  label: string
  scope: SearchScope
  placeholder: string
}[] = [
  {
    label: "Bible",
    scope: "bible",
    placeholder: 'Search the Bible, e.g. "John 3:16"',
  },
  {
    label: "Song lyrics",
    scope: "song",
    placeholder: "Search songs by title or lyrics",
  },
  {
    label: "Hymns",
    scope: "hymn",
    placeholder: "Search hymns by title or first line",
  },
  {
    label: "Library",
    scope: "library",
    placeholder: "Search your saved songs",
  },
  {
    label: "Actions",
    scope: "action",
    placeholder: "Search actions and settings",
  },
]
const searchScope = ref<SearchScope | null>(null)
const activeScopeFilter = computed(() =>
  quickFilters.find((filter) => filter.scope === searchScope.value)
)
const toggleSearchScope = (scope: SearchScope) => {
  searchScope.value = searchScope.value === scope ? null : scope
  searchInputEl.value?.input?.focus()
}

// The promo card under the chips is server-driven: its copy, the action it
// triggers and whether it appears at all come from `/app-config/info`, so it can
// be swapped or pulled without shipping a release. No config = no card.
const { quickSearchPromo: promoConfig } = useAppInfo()

const quickSearchPromo = computed(() => {
  const promo = promoConfig.value
  if (!promo?.enabled || !promo.title) return undefined
  // A link promo only shows with an http(s) URL, so a bad value can never
  // render a dead card or hand the OS a non-web scheme.
  if (promo.actionType === "url") return isWebUrl(promo.url) ? promo : undefined
  return promo.action ? promo : undefined
})

const handleChipClick = (action: string) => {
  if (!openFeatureOrUpgrade(action)) return
  useGlobalEmit(action)
}

const isWebUrl = (value?: string) => /^https?:\/\//i.test(value?.trim() ?? "")

const handlePromoClick = () => {
  const promo = quickSearchPromo.value
  if (!promo) return
  if (promo.actionType === "url") {
    useOpenExternal(promo.url!.trim())
    return
  }
  if (promo.action) handleChipClick(promo.action)
}

// The online lyrics library is open to every plan for searching. A free
// church gets catalogue songs back as previews (first verse, `isPreview`) and
// spends one of its monthly library songs when it adds one (see claimSong in
// useSongs). Every route into the song search page funnels through here (the
// "Search song lyrics" card, the "Search in songs" banner in HymnList).
const ensureSongSearchAccess = () =>
  openFeatureOrUpgrade(appWideActions.newSongSearch)

const getAllHymns = async () => {
  const allHymns = await db.bibleAndHymns.get("hymns")
  hymns.value = (allHymns?.data || []) as unknown as Hymn[]
  loading.value = false
}

getAllHymns()
// On a device's first session this panel mounts before the hymn download
// lands, and would otherwise search an empty hymn list until a reload.
onEmitter(appWideActions.hymnsUpdated, getAllHymns)

// Turns a Song into a searchable quick action that creates a song slide when picked.
// The subtext reads like the songs and library panels' rows, plus where the
// song lives: three songs called "Grace" are otherwise three identical rows.
const mapSongToAction = (song: Song, fromSaved: boolean): QuickAction => {
  const byline =
    song?.artist || (song?.author === "me" ? "compiled by me" : song?.author)
  return {
    icon: "i-bx-music",
    name: song?.title || "",
    desc: [byline, fromSaved ? "My Library" : ""].filter(Boolean).join(" · "),
    action: "new-song",
    meta: `${song?.artist || ""} ${song?.lyrics || ""}`,
    searchableOnly: true,
    songData: { ...song, fromSaved } as Song,
    type: slideTypes.song,
  }
}

// Remote (global) song search results — always fetched alongside the local
// library match so both sources are represented; duplicates and the 3+3 cap
// are resolved when the song group is built in rankedSearchResults. Open to every
// plan: a free church's catalogue hits come back as previews, and adding one
// spends a monthly library song (PreviewContent → claimSong).
const remoteSongActions = ref<QuickAction[]>([])
// The query `remoteSongActions` answered. While a newer one is in flight the
// old results stay up, minus any the new query no longer matches.
const remoteSongsQuery = ref("")
const isSearchingRemoteSongs = ref(false)
// Guards against out-of-order results when overlapping calls fire (e.g. fast
// typing outpacing the debounce) — only the most recent call is allowed to
// update state.
let remoteSongsRequestId = 0

const fetchRemoteSongsIfNeeded = useDebounceFn(async (query: string) => {
  const requestId = ++remoteSongsRequestId

  if (query.length < 2) {
    remoteSongActions.value = []
    isSearchingRemoteSongs.value = false
    return
  }

  isSearchingRemoteSongs.value = true
  try {
    // Narrowed to songs, the list has room for more catalogue results.
    const limit = searchScope.value === "song" ? 15 : 6
    const results = await searchSongs(query, limit, "quick-actions")
    if (requestId !== remoteSongsRequestId) return
    remoteSongActions.value = (results || []).map((song) =>
      mapSongToAction(song, false)
    )
    remoteSongsQuery.value = query
  } catch {
    if (requestId !== remoteSongsRequestId) return
    remoteSongActions.value = []
  } finally {
    if (requestId === remoteSongsRequestId) {
      isSearchingRemoteSongs.value = false
    }
  }
}, 400)

// Turns a raw `/scripture/search` result into a searchable Bible quick action.
const mapScriptureToAction = (raw: any): QuickAction => {
  const bookIndex = Number(raw?.book)
  const bookName = bibleBooks?.[bookIndex - 1] || `Book ${bookIndex}`
  const bibleChapterAndVerse = `${raw?.chapter}:${raw?.verse}`
  return {
    icon: "i-bx-bible",
    name: bookName,
    desc: raw?.scripture || "",
    action: "new-bible",
    meta: `${raw?.scripture || ""}`,
    searchableOnly: true,
    bibleBookIndex: `${raw?.book}`,
    bibleChapterAndVerse,
    type: slideTypes.bible,
  }
}

// Remote (global) Bible search results — searches the backend scripture index
// so verses aren't limited to the locally downloaded translation. Mirrors the
// song flow: honors the same online/Teams gate used by SearchBibleList.vue's
// scripture search, and shares the "Searching global library…" indicator.
const remoteBibleActions = ref<QuickAction[]>([])
// The query `remoteBibleActions` answered (see `remoteSongsQuery`).
const remoteBibleQuery = ref("")
const isSearchingRemoteBible = ref(false)
let remoteBibleRequestId = 0

// Always fetched when online, regardless of subscription tier — we don't know
// ahead of time whether a query is bible-related, so it's cheaper to just search.
const shouldSearchBibleOnline = computed(() => online.value)

const fetchRemoteBibleIfNeeded = useDebounceFn(async (query: string) => {
  const requestId = ++remoteBibleRequestId

  if (query.length < 3 || !shouldSearchBibleOnline.value) {
    remoteBibleActions.value = []
    isSearchingRemoteBible.value = false
    return
  }

  isSearchingRemoteBible.value = true
  try {
    const { data } = await useAPIFetch(
      `/scripture/search?q=${encodeURIComponent(query)}&limit=6`
    )
    if (requestId !== remoteBibleRequestId) return
    const payload = data.value as { results?: any[] } | null
    remoteBibleActions.value = (payload?.results || []).map(
      mapScriptureToAction
    )
    remoteBibleQuery.value = query
  } catch {
    if (requestId !== remoteBibleRequestId) return
    remoteBibleActions.value = []
  } finally {
    if (requestId === remoteBibleRequestId) {
      isSearchingRemoteBible.value = false
    }
  }
}, 400)

const isSearchingRemote = computed(
  () => isSearchingRemoteSongs.value || isSearchingRemoteBible.value
)

const actions = computed(() => {
  return quickActionsArr.concat(
    (bibleBooks || []).map((book: string, index: number) => {
      const bibleBookIndex = index + 1 // Does not start from 0, starts from 1

      return {
        icon: "i-bx-bible",
        name: `${book}`,
        desc: `Open the book of ${book}`,
        action: "new-bible",
        meta: "",
        searchableOnly: true,
        bibleBookIndex: `${bibleBookIndex}`,
        type: slideTypes.bible,
      }
    }),

    (hymns.value || []).map((hymn: Hymn) => {
      return {
        icon: "i-bx-church",
        name: `${hymn.title}`,
        // The author, as in the hymn panel: the catalogue holds several hymns
        // of the same title ("Amazing Grace", "It Is Well with My Soul").
        desc: hymn.author || "",
        action: "new-hymn",
        meta: `hymn ${hymn.meta}`,
        searchableOnly: true,
        hymnIndex: hymn.number,
        type: slideTypes.hymn,
      }
    }),

    (savedSongs.value || []).map((item) =>
      mapSongToAction(item.content as Song, true)
    )
  )
})

const validActions = computed(() => {
  return actions.value.filter((action): action is QuickAction => {
    if (!action?.name || !action?.icon || !action?.action) return false
    // Filtered here rather than in `visibleActions` so the exclusions apply to
    // fuzzy search results too — otherwise typing "go live" on a phone would
    // still surface an action that cannot do anything.
    if (props.mobile && desktopOnlyActions.includes(action.action)) return false
    if (action.featureFlag === "camera-slide" && !cameraSlideEnabled.value)
      return false
    return true
  })
})

// Display order for the actions home list, ranked by how often churches
// actually reach for each one (PostHog 30-day usage) rather than the order the
// entries happen to be authored in `quickActionsArr` — which is grouped by
// theme, so heavily used actions like "Create Text Slide" and "Add Media" sat
// below ones barely anyone opens. Keyed on the action name, which is unique
// per entry. Anything not listed here keeps its authored order and follows
// behind the ranked ones.
const visibleActionOrder: string[] = [
  appWideActions.newBible,
  appWideActions.newLibrary,
  appWideActions.addSong,
  appWideActions.newSongSearch,
  appWideActions.newSlide,
  appWideActions.newMedia,
  appWideActions.newHymn,
  appWideActions.newSearchBible,
  appWideActions.newSongSetlist,
  appWideActions.newTranscribe,
]

const visibleActionRank = (action: QuickAction) => {
  const index = visibleActionOrder.indexOf(action.action)
  return index === -1 ? visibleActionOrder.length : index
}

const visibleActions = computed(() => {
  const visible = validActions.value.filter((action) => !action.searchableOnly)
  // Sorted on a copy, and `Array.prototype.sort` is stable, so every unranked
  // action keeps its `quickActionsArr` order behind the ranked block.
  return [...visible].sort(
    (a, b) => visibleActionRank(a) - visibleActionRank(b)
  )
})

watch(page, () => {
  if (page.value === "") {
    bibleSearchQuery.value = ""
    hymnSearchQuery.value = ""
    searchBibleQuery.value = ""
  }
})

const currentQuickActions = computed(() => {
  return searchInput.value?.length >= 2
    ? searchedActions.value
    : visibleActions.value
})

// The query being searched, minus the "/" shortcut prefix.
const searchQuery = computed(
  () => searchTerm.value?.replaceAll("/", "").trim() || ""
)

watch(searchInput, (value) => {
  if (value.startsWith("/") && value.length > 1) {
    searchInput.value = value.replaceAll("/", "")
    return
  }
  focusedActionIndex.value = 0
  hasInteracted.value = false
  if (value.length < 2 || searchTerm.value.length < 2) {
    flushSearchTerm()
    return
  }
  if (searchTermTimer) clearTimeout(searchTermTimer)
  searchTermTimer = setTimeout(flushSearchTerm, SEARCH_RANK_DELAY_MS)
})

watch(searchTerm, () => refreshRemoteResults())

// Changing scope changes which libraries are worth asking.
watch(searchScope, () => {
  focusedActionIndex.value = 0
  hasInteracted.value = false
  refreshRemoteResults()
})

function refreshRemoteResults() {
  const query = searchQuery.value

  // Bumping the request IDs invalidates any in-flight request for the old
  // query. Its results stay on screen until the new ones land, so the list
  // doesn't empty and refill on every keystroke; `rankedSearchResults` drops
  // the ones the new query no longer matches.
  remoteSongsRequestId++
  isSearchingRemoteSongs.value = false
  remoteBibleRequestId++
  isSearchingRemoteBible.value = false
  const clearSongs = () => (remoteSongActions.value = [])
  const clearBible = () => (remoteBibleActions.value = [])

  // A confirmed Bible reference search ("Psa 101", "Eph 3:20") already tells
  // us exactly which book/chapter/verse is wanted, so there's nothing the
  // global song/scripture library search could usefully add — skip it.
  // Likewise a query that names one of the app's actions word for word
  // ("dark mode", "add media"): it is a command, and asking the song and
  // scripture libraries only buried the action under loose matches (and
  // logged a song search nobody made).
  const scope = searchScope.value
  const namesAction =
    !scope &&
    validActions.value.some(
      (action) =>
        staticQuickActions.has(action) && namesActionExactly(action, query)
    )
  // A timer command ("5 min timer") is a command too.
  if (
    query.length < 2 ||
    isBibleReferenceSearch.value ||
    namesAction ||
    timerQuickAction.value
  ) {
    clearSongs()
    clearBible()
    return
  }

  // A scope only asks the library it covers; hymns, saved songs and actions
  // are all local. A hymnal number only ever names a song.
  const askSongs = !scope || scope === "song"
  const askBible =
    (!scope || scope === "bible") && !hymnalNumberQuery.value
  if (!askSongs) clearSongs()
  if (!askBible) clearBible()
  // Flag the search as under way now rather than when the debounce fires, so
  // the gap before it never reads as "No matches".
  if (askSongs) {
    isSearchingRemoteSongs.value = query.length >= 2
    fetchRemoteSongsIfNeeded(query)
  }
  if (askBible) {
    isSearchingRemoteBible.value =
      query.length >= 3 && shouldSearchBibleOnline.value
    fetchRemoteBibleIfNeeded(query)
  }
}

watch(
  () => currentQuickActions.value.length,
  (length) => {
    if (length === 0) {
      focusedActionIndex.value = 0
      return
    }
    focusedActionIndex.value = Math.min(focusedActionIndex.value, length - 1)
  }
)

// Clicking a searched result (bible/song/hymn) should just create the slide and
// stay put — never fall back to browsing a sub-page. Search results only render
// once searchInput.length >= 2, so that's the reliable signal to skip navigation,
// regardless of what payload the click happened to emit.
const isInSearchResults = computed(() => searchInput.value.length >= 2)

onEmitter("new-bible", (data) => {
  if (data === "" && !isInSearchResults.value) {
    page.value = "bible"
  }
})

onEmitter("bible-search-demo", () => {
  bibleSearchQuery.value = "Gen 1:1"
})

onEmitter("new-song", (data: any) => {
  if (!data && !isInSearchResults.value) {
    if (!ensureSongSearchAccess()) return
    page.value = "song"
  }
})

onEmitter("new-song-search", (query) => {
  if (!ensureSongSearchAccess()) return
  songSearchQuery.value = query || ""
  page.value = "song"
})

onEmitter("new-hymn", (data) => {
  if (data === "undefined" && !isInSearchResults.value) {
    page.value = "hymn"
  }
})

onEmitter(appWideActions.newHymnSearch, (query?: string) => {
  hymnSearchQuery.value = typeof query === "string" ? query : ""
  page.value = "hymn"
})

onEmitter("new-media", (data) => {
  const fromSaved = data?.[0]?.fromSaved
  const fromDrop = data?.[0]?.fromDrop
  if (!fromSaved && !fromDrop) {
    page.value = "media"
  }
})

onEmitter("new-youtube-video", () => {
  page.value = "youtube"
})

onEmitter("new-vimeo-video", () => {
  page.value = "vimeo"
})

onEmitter("new-search-bible", (query?: string) => {
  searchBibleQuery.value = typeof query === "string" ? query : ""
  page.value = "search-bible"
})

onEmitter("new-library", () => {
  page.value = "library"
})

onEmitter("new-templates", () => {
  page.value = "templates"
})

onEmitter(appWideActions.newSchedulesList, () => {
  page.value = "schedules-list"
})

onEmitter("new-alert", () => {
  page.value = "alert"
})

onEmitter("remove-alert", () => {
  appStore.setActiveAlert(null)
  useToast().add({
    icon: "i-bx-trash",
    title: "Active alert has been removed",
  })
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit("remove-alert", {})
  }
})

// A Song payload means an existing song is being edited (e.g. from a song
// slide's "Edit song in library"); a string is the title for a new song (quick
// search's "Add 'x' as a new song"); no payload opens a blank add-song form.
onEmitter("add-song", (song?: Song | string) => {
  const isNewTitle = typeof song === "string"
  librarySongToEdit.value = song && !isNewTitle ? { ...song } : undefined
  libraryNewSongTitle.value = isNewTitle ? song : ""
  libraryPage.value = "add-song"
  libraryReviewing.value = false
  // The library panel may already be open on its own page, in which case none
  // of the props above necessarily change — bump a token so it always reacts.
  libraryOpenToken.value++
  page.value = "library"
})

// No payload means "open the countdown panel"; a payload is a countdown that
// has already been filled in and is on its way to its destination.
onEmitter("new-countdown", (data) => {
  if (!data) {
    countdownInitialTab.value = 0
    page.value = "countdown"
  }
})

onEmitter(appWideActions.newStageCountdown, (data) => {
  if (!data) {
    countdownInitialTab.value = 1
    page.value = "countdown"
  }
})

// No payload opens the panel; a payload is a finished interlude on its way
// to the schedule (PreviewContent creates the slide).
onEmitter(appWideActions.newInterlude, (data) => {
  if (!data) page.value = "interlude"
})

// Same rule as the interlude: no payload opens the camera panel.
onEmitter(appWideActions.newCamera, (data) => {
  if (!data) page.value = "camera"
})

// A payload means a deck is being imported, not that the panel should open.
onEmitter("new-presentation", (data) => {
  if (!data) page.value = "presentation"
})

onEmitter("new-presentation-from-pdf", () => {
  page.value = "presentation-pdf"
})

const handleInputKeydown = (e: KeyboardEvent) => {
  // Arrows and Enter act on the results, so they must be the results for
  // what is in the box now, not for the query of a keystroke ago.
  if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) flushSearchTerm()
  const currentActions = currentQuickActions.value
  const maxIndex = currentActions.length - 1

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      hasInteracted.value = true
      if (maxIndex < 0) return
      if (focusedActionIndex.value < maxIndex) {
        focusedActionIndex.value += 1
      }
      break
    case "ArrowUp":
      e.preventDefault()
      hasInteracted.value = true
      if (maxIndex < 0) return
      if (focusedActionIndex.value > 0) {
        focusedActionIndex.value -= 1
      }
      break
    case "Enter":
      e.preventDefault()
      if (maxIndex < 0) return
      focusedActionIndex.value = Math.min(focusedActionIndex.value, maxIndex)
      const action = currentActions?.[
        focusedActionIndex.value
      ] as unknown as QuickAction
      if (action) {
        const payload =
          action?.type === slideTypes.bible
            ? `${action?.bibleBookIndex}:${
                action?.bibleChapterAndVerse || bibleChapterAndVerse.value
              }`
            : action?.type === slideTypes.hymn
            ? action?.hymnIndex
            : action?.type === slideTypes.song && action?.songData
            ? action?.songData
            : action?.type === slideTypes.countdown && action?.countdownData
            ? action?.countdownData
            : action?.actionArg || ""
        // Same rule as ActionCard: an action carrying its payload creates
        // straight away, so it is the commit step, not a preview — unless the
        // payload only fills in the panel it opens.
        const gate =
          payload && !action?.opensPanel
            ? requireFeatureAccess
            : openFeatureOrUpgrade
        introduceThen(action, () => {
          if (!gate(action?.action || "")) return
          useGlobalEmit(action?.action, payload)
        })
      }
      break
    default:
      return
  }
}

onMounted(() => {
  quickSearchSuggestionInterval = setInterval(() => {
    quickSearchSuggestionIndex.value =
      (quickSearchSuggestionIndex.value + 1) % quickSearchSuggestions.length
  }, 5000)

  // console.log("mounted", quickActions.value)

  onEmitter(appWideActions.quickActionsFocus, () => {
    // Focus on Quick actions search bar input
    if (page.value !== "") {
      setTimeout(() => {
        searchInputEl.value?.input?.focus()
      }, 300)
      // Go to Quick actions home
      page.value = ""
    } else {
      searchInputEl.value?.input?.focus()
    }
  })

  document.addEventListener("mousedown", handleOutsidePointerDown)
})

// Escape steps back out of the pane, mirroring what clicking the section
// heading does: an active search is cleared first, then a sub-page (Bible,
// songs, media…) returns to the actions home. Registered at the lowest
// priority so any overlay on top of the pane — a modal, popover or editor
// panel — gets the press first, and it bails while a Headless UI dialog is
// open since that closes itself on Escape without going through this stack.
useEscapeKey(
  () => {
    if (document.querySelector('[role="dialog"]')) return false

    if (searchInput.value || searchScope.value) {
      searchInput.value = ""
      searchScope.value = null
      isSearchFocused.value = false
      searchInputEl.value?.input?.blur()
      return true
    }

    if (page.value !== "") {
      page.value = ""
      return true
    }

    return false
  },
  { priority: escapePriority.pane }
)

onUnmounted(() => {
  if (quickSearchSuggestionInterval)
    clearInterval(quickSearchSuggestionInterval)
  if (searchBlurTimeout) clearTimeout(searchBlurTimeout)
  if (searchTermTimer) clearTimeout(searchTermTimer)
  document.removeEventListener("mousedown", handleOutsidePointerDown)
})

// "Hymn 23", "SDA 109", "#45": a hymnal number, matched against titles (see
// `parseHymnalNumberQuery` for why not against the catalogue's own numbers).
const hymnalNumberQuery = computed(() =>
  parseHymnalNumberQuery(searchQuery.value)
)

const bibleChapterAndVerse = computed(() => {
  // A hymnal number, or a search narrowed to anything but the Bible, has no
  // Bible reference in it however chapter-shaped its number looks.
  if (hymnalNumberQuery.value) return undefined
  if (searchScope.value && searchScope.value !== "bible") return undefined

  // The optional `(?:-\d+)?` captures a verse range like "5-6" so "John 3 5-6"
  // / "John 3:5-6" resolve to chapter 3, verses 5-6 (useScripture understands
  // the "start-end" verse form) instead of silently dropping the range.
  const regex = /\b\d+\s*:\s*\d+(?:-\d+)?\b|\b\d+\s\d+(?:-\d+)?\b/g
  const bibleBookFollowedByJustChapterMatch = searchTerm.value
    ?.replace("/", "")
    .match(/\b\w+\s+\d+\b(?!\S)/g)

  if (
    bibleBookFollowedByJustChapterMatch?.[0] &&
    !searchTerm.value?.match(regex)
  ) {
    const standaloneChapter = Number(
      bibleBookFollowedByJustChapterMatch?.[0]?.split(" ")?.[1] || 1
    )
    const verse = 1
    return `${standaloneChapter}:${verse}`
  }

  const match = searchTerm.value
    ?.replace("/", "")
    .match(regex)?.[0]
    ?.replaceAll(" ", ":")
  return match?.trim()
})

// The book-name-only portion of the query once a chapter/verse has been
// recognised (see `bibleChapterAndVerse` above) — e.g. "Psa 101" -> "Psa",
// "Psa 127 24" -> "Psa", "Psa 27:4" -> "Psa". Reads off `searchTerm`, which
// always catches up with the box, rather than a copy frozen on some earlier
// query, so it can't get stuck on a stale value once a two-digit number
// appears anywhere in the query.
const bibleBookQuery = computed(() => {
  if (!bibleChapterAndVerse.value) return ""
  return (
    searchTerm.value
      ?.replaceAll("/", "")
      .replace(/\s*:\s*\d+(?:-\d+)?\s*$/, "")
      .replace(/(\s+\d+(?:-\d+)?){1,2}\s*$/, "")
      .trim() || ""
  )
})

// Bible book actions only, used to confidently tell a real Bible reference
// search ("Psa 101", "Eph 3:20") apart from a chapter-shaped number that just
// happens to be glued onto an unrelated word ("hello 22"). A high fuzzysort
// threshold (scores close to 0 are near-perfect matches, real book
// abbreviations like "Psa"/"1 Sam"/"Eph" score well above -30, while noise
// scores in the tens of thousands) filters out anything that isn't a
// genuine book match.
const bibleBookActions = computed(() =>
  validActions.value.filter(
    (action) => action.type === slideTypes.bible && action.bibleBookIndex
  )
)

// The one book a reference names by a known abbreviation or a prefix only it
// has ("jn 3 16", "1 cor 13", "lament 3"). Without this, "jn" fell to
// fuzzysort, which scored it too weakly to count as a book and let Jonah tie
// with John.
const referenceBookIndex = computed(() => {
  if (!bibleChapterAndVerse.value || !bibleBookQuery.value) return null
  return resolveBibleBook(bibleBookQuery.value)
})

const isBibleReferenceSearch = computed(() => {
  if (!bibleChapterAndVerse.value || !bibleBookQuery.value) return false
  if (referenceBookIndex.value) return true
  const bookMatches = fuzzysort.go(
    bibleBookQuery.value,
    bibleBookActions.value,
    {
      keys: ["name"],
      threshold: -1000,
    }
  )
  return bookMatches.length > 0
})

// Build the verse index the first time the user actually looks up a Bible
// reference — that's when the verse-level validity check becomes relevant, and
// it keeps the heavy one-time parse off the app-startup path.
watch(isBibleReferenceSearch, (isReference) => {
  if (isReference) ensureScriptureIndex()
})

// Parses natural language timer commands like "start 5 m timer",
// "start 30min timer" or "start 1h timer" typed into the search box,
// so they can be surfaced as an instant-create countdown action.
const timerCommandMatch = computed(() => {
  const input = searchTerm.value?.toLowerCase() || ""
  if (!/\btimer\b|\bcountdown\b/.test(input)) return null

  const match = input.match(
    /(\d+)\s*(hours|hour|hrs|hr|h|minutes|minute|mins|min|m|seconds|second|secs|sec|s)\s*(?:timer|countdown)\b/
  )
  if (!match) return null

  const amount = Number(match[1])
  const unit = match[2] || ""
  if (!amount || !unit) return null

  let totalSeconds = 0
  if (unit.startsWith("h")) totalSeconds = amount * 3600
  else if (unit.startsWith("m")) totalSeconds = amount * 60
  else totalSeconds = amount

  const pad = (value: number) => `${value}`.padStart(2, "0")
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    time: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    label: `${amount} ${
      unit.startsWith("h") ? "hour" : unit.startsWith("m") ? "minute" : "second"
    }${amount === 1 ? "" : "s"}`,
  }
})

const timerQuickAction = computed((): QuickAction | null => {
  const parsed = timerCommandMatch.value
  if (!parsed) return null

  return {
    icon: "i-bx-time",
    name: `Start ${parsed.label} countdown timer`,
    desc: "Instantly create and go live with this countdown",
    action: appWideActions.newCountdown,
    type: slideTypes.countdown,
    countdownData: {
      id: useID(),
      content: "",
      time: parsed.time,
      timeLeft: parsed.time,
    },
  }
})

// The same typed duration, sent to the confidence monitor instead of the
// congregation's screen — "5 min countdown" offers both, so an operator
// counting a break down for the band never has to open a panel.
const stageTimerQuickAction = computed((): QuickAction | null => {
  const parsed = timerCommandMatch.value
  if (!parsed) return null

  return {
    icon: "i-ph-monitor-play",
    name: `Start ${parsed.label} countdown on stage display`,
    desc: "Counts down for the band and speaker only, not the congregation",
    action: appWideActions.newStageCountdown,
    type: slideTypes.countdown,
    countdownData: {
      id: useID(),
      content: "",
      time: parsed.time,
      timeLeft: parsed.time,
    },
  }
})

// Reference set of the static, user-runnable quick actions (the ones authored
// in `quickActionsArr`). Used by the search grouping to tell an *action* the
// user can run — "Display Bible", "Add Media", "Add Countdown Timer" — apart
// from a dynamic library *result* (an actual Bible verse, song or hymn), which
// is built fresh in the `actions` computed and so isn't in this set. Built once
// (the array is a module constant); membership is by object reference, which
// survives the `.filter()` in `validActions`.
const staticQuickActions = new Set<QuickAction>(quickActionsArr)

// The app's own runnable actions that the query describes, best first. Judged
// by whole words (see `actionMatchStrength`) instead of fuzzysort, whose
// letters-in-order rule matched "love your enemies" to "Open Stage Display"
// and put it above the verse the operator was after.
const matchedStaticActions = computed(() => {
  const scored = validActions.value
    .filter((action) => staticQuickActions.has(action))
    .map((action) => ({
      action,
      strength: actionMatchStrength(action, searchQuery.value),
    }))
    .filter(({ strength }) => strength >= ACTION_MATCH_THRESHOLD)
  const best = Math.max(0, ...scored.map(({ strength }) => strength))
  return scored
    .filter(({ strength }) => strength >= best - ACTION_MATCH_SPREAD)
    .sort((a, b) => b.strength - a.strength)
    .map(({ action }) => action)
})

// Songs and hymns a typed hymnal number points at: for "SDA 109" the SDA
// Hymnal's own hymn 109 first, then titles carrying the number ("Hymn 23",
// "CCC Hymn 238"), those that also name the hymnal ("SDA") ahead.
const hymnalNumberMatches = (actions: QuickAction[]) => {
  const hymnal = hymnalNumberQuery.value
  if (!hymnal) return []
  const asksSda = hymnal.prefix.startsWith("sda")
  const isSdaEntry = (action: QuickAction) =>
    asksSda &&
    action.type === slideTypes.hymn &&
    isSdaHymnalNumber(action.desc, hymnal.number)
  const hymnalWords = hymnal.prefix
    .split(/\s+/)
    .filter((word) => word && !word.startsWith("hymn"))
  const rank = (action: QuickAction) =>
    isSdaEntry(action)
      ? 0
      : hymnalWords.some((word) => action.name.toLowerCase().includes(word))
      ? 1
      : 2
  return actions
    .filter(
      (action) =>
        !staticQuickActions.has(action) &&
        (action.type === slideTypes.song || action.type === slideTypes.hymn) &&
        (titleHasNumber(action.name, hymnal.number) || isSdaEntry(action))
    )
    .sort((a, b) => rank(a) - rank(b))
}

// Lyrics, artist, a hymn's first line or a verse's text, folded once per
// result for `textMatchRank` (a saved song's lyrics run to thousands of
// characters, and this runs on every keystroke).
const searchTextCache = new WeakMap<QuickAction, string>()
const searchTextFor = (action: QuickAction) => {
  let text = searchTextCache.get(action)
  if (text === undefined) {
    text = normalizeSearchText(action.meta)
    searchTextCache.set(action, text)
  }
  return text
}

// Songs, hymns, books and verses that answer a query, best first: titles by
// fuzzysort (so a dropped letter still finds "Amazing Grace"), then texts
// holding the query as a phrase, then texts holding all of its words.
const matchContent = (
  query: string,
  actions: QuickAction[],
  { nameThreshold = CONTENT_NAME_THRESHOLD, withText = true } = {}
): QuickAction[] => {
  const byName = fuzzysort
    .go(query, actions, { key: "name", threshold: nameThreshold })
    .map((result) => result.obj as QuickAction)
  if (!withText) return byName

  const named = new Set(byName)
  const phrase: QuickAction[] = []
  const allWords: QuickAction[] = []
  for (const action of actions) {
    if (named.has(action)) continue
    const rank = textMatchRank(searchTextFor(action), query)
    if (rank === 0) phrase.push(action)
    else if (rank === 1) allWords.push(action)
  }
  return [...byName, ...phrase, ...allWords]
}

// Whether a result belongs to the scope a chip narrowed the search to.
const isInSearchScope = (action: QuickAction) => {
  const isStatic = staticQuickActions.has(action)
  switch (searchScope.value) {
    case "bible":
      return !isStatic && action.type === slideTypes.bible
    case "song":
      return !isStatic && action.type === slideTypes.song
    case "hymn":
      return !isStatic && action.type === slideTypes.hymn
    case "library":
      return !!action.songData?.fromSaved
    case "action":
      return isStatic
    default:
      return true
  }
}

const rankedSearchResults = computed((): QuickAction[] => {
  // A half-typed verse ("John 3:") is matched on the part before its colon.
  // Once a chapter/verse has been recognised, match book names on their own
  // (see `bibleBookQuery`) instead of throwing the chapter/verse digits into
  // the fuzzy search too — otherwise that either fails to match any book once
  // the numbers are something fuzzysort can't line up against a book name
  // (e.g. "Psa 103" matched nothing) or spuriously matches unrelated books
  // whose letters happen to fuzzy-match the digits (e.g. "Psa 101" matching
  // "Ephesians"). This used to freeze on the last query without a two-digit
  // number, to stop a verse's digits flickering the list; with references
  // parsed above that guarded nothing, and it searched "10,000 Reasons" as
  // "1" (or as whatever was searched before, when pasted). Narrowed to songs,
  // hymns, the library or actions, a colon is just part of the title.
  const colonIndex = searchQuery.value.indexOf(":")
  const isNonBibleScope = !!searchScope.value && searchScope.value !== "bible"
  const searchInputForMatch = bibleChapterAndVerse.value
    ? bibleBookQuery.value
    : isNonBibleScope || colonIndex === -1
    ? searchQuery.value
    : searchQuery.value.substring(0, colonIndex)

  let results: any
  if (referenceBookIndex.value) {
    // An abbreviation or unique prefix already named the book.
    results = bibleBookActions.value.filter(
      (action) => Number(action.bibleBookIndex) === referenceBookIndex.value
    )
  } else if (hymnalNumberQuery.value) {
    results = hymnalNumberMatches(validActions.value)
  } else {
    const content = validActions.value.filter(
      (action) => !staticQuickActions.has(action)
    )
    // The app's own actions are matched on whole words (see
    // `matchedStaticActions`), library content by `matchContent`. Once we're
    // confident this is an actual Bible reference (see
    // `isBibleReferenceSearch`), only genuine book-name matches count — a
    // 3-letter book abbreviation like "Psa" would otherwise also weakly match
    // plenty of unrelated songs/hymns.
    results = isBibleReferenceSearch.value
      ? matchContent(searchInputForMatch, content, {
          nameThreshold: -1000,
          withText: false,
        })
      : [
          ...matchedStaticActions.value,
          ...matchContent(searchInputForMatch, content),
        ]
  }
  results = results.filter((action: QuickAction) => action?.name)

  // Drop Bible references whose parsed chapter/verse can't exist in the active
  // version — e.g. "3 John 7:8" (3 John has a single chapter). Otherwise they'd
  // be offered as a pickable result that only ever shows "Preview unavailable"
  // and fails to create a slide. Book-only references (no chapter/verse parsed
  // yet, whole book) are always kept. Reading the ready tick lets this recompute
  // and apply the verse-level check once the verse index has finished building.
  void scriptureIndexReadyTick.value
  results = results.filter((action: QuickAction) => {
    if (action?.type !== slideTypes.bible) return true
    const bookIndex = Number(action?.bibleBookIndex)
    if (!bookIndex) return true
    const reference = action?.bibleChapterAndVerse || bibleChapterAndVerse.value
    if (!reference) return true
    const [chapterStr, verseStr] = String(reference).split(":")
    return isScriptureReferenceValidSync(
      bookIndex,
      Number(chapterStr),
      verseStr ?? 1,
      defaultBibleVersion.value
    )
  })

  // A confirmed Bible reference search only has room for Bible book matches —
  // drop anything else (quick actions, songs, hymns) that fuzzysort happened
  // to also weakly match on the bare book abbreviation.
  if (isBibleReferenceSearch.value) {
    results = results.filter(
      (action: QuickAction) => action.type === slideTypes.bible
    )
  }

  // A confirmed Bible reference search ("Psa 101", "Eph 3:20") already tells
  // us exactly what the user wants, so the global song/scripture library
  // search (see `refreshRemoteResults`) is skipped entirely and
  // there's nothing useful it could add — keep only the local book matches.
  if (!isBibleReferenceSearch.value) {
    // API-searched (global) songs, fetched alongside local library matches
    // (see fetchRemoteSongsIfNeeded)
    // Results still answering an older query keep only what this one
    // matches; see `remoteSongsQuery`.
    const remoteSongs =
      remoteSongsQuery.value === searchQuery.value
        ? remoteSongActions.value
        : matchContent(searchQuery.value, remoteSongActions.value)
    if (remoteSongs.length > 0) {
      results = results.concat(
        hymnalNumberQuery.value
          ? hymnalNumberMatches(remoteSongs)
          : remoteSongs
      )
    }

    // API-searched (global) Bible verses, fetched alongside local book
    // matches (see fetchRemoteBibleIfNeeded)
    const remoteVerses = (
      remoteBibleQuery.value === searchQuery.value
        ? remoteBibleActions.value
        : matchContent(searchQuery.value, remoteBibleActions.value)
    ).filter((verse) =>
      sharesMeaningfulWord(searchTextFor(verse), searchQuery.value)
    )
    if (remoteVerses.length > 0 && !hymnalNumberQuery.value) {
      results = results.concat(remoteVerses)
    }
  }

  // Sort by showing [searchableOnly] actions last
  results.sort((a: QuickAction, b: QuickAction) => {
    if (a.searchableOnly && !b.searchableOnly) {
      return 1
    } else if (!a.searchableOnly && b.searchableOnly) {
      return -1
    } else {
      return 0
    }
  })

  // If true, then show Bible types first.
  if (bibleChapterAndVerse.value) {
    results.sort((a: QuickAction, b: QuickAction) => {
      if (a.type === "bible" && b.type !== "bible") {
        return -1
      } else if (a.type !== "bible" && b.type === "bible") {
        return 1
      } else {
        return 0
      }
    })
  }

  results = results.filter(isInSearchScope)

  const timerInScope = !searchScope.value || searchScope.value === "action"
  if (timerQuickAction.value && timerInScope) {
    results = [
      timerQuickAction.value,
      ...(!props.mobile && stageTimerQuickAction.value
        ? [stageTimerQuickAction.value]
        : []),
      ...results,
    ]
  }

  // Group results by type (hymn, song, bible, media, etc.) so each category
  // stays together instead of interleaving by raw relevance rank. Actions
  // without a `type` fall into a generic "action" bucket. Groups keep the
  // relative order of their best (first) match from the sorting above.
  // The song group is special-cased: up to 3 from the library + 3 from the
  // API (6 total), skipping API songs that duplicate an already-shown
  // library song (matched on title + artist/author).
  const groupedResults = new Map<string, QuickAction[]>()
  const songCap = searchScope.value ? 15 : 3
  let localSongCount = 0
  let remoteSongCount = 0
  const seenSongKeys = new Set<string>()
  const songKey = (song?: Song) =>
    `${(song?.title || "").trim().toLowerCase()}|${(
      song?.artist ||
      song?.author ||
      ""
    )
      .trim()
      .toLowerCase()}`

  for (const action of results as QuickAction[]) {
    const isSettingsAction = action?.action === appWideActions.openSettings
    // A static entry from `quickActionsArr` is an action the user can run, so
    // group them all together in the "action" bucket regardless of the slide
    // `type` they carry — otherwise "Add Media" (type media), "Display Bible"
    // (type bible), "Add Countdown Timer" (type countdown) etc. get scattered
    // into the bible/media/countdown content groups. Dynamic library results
    // (real Bible verses, songs, hymns) aren't in `quickActionsArr`, so they
    // keep their type group. Settings actions stay in their own adjacent bucket.
    const isStaticAction = staticQuickActions.has(action)
    const groupKey = isSettingsAction
      ? "settings"
      : isStaticAction
      ? "action"
      : action?.type || "action"

    if (groupKey === slideTypes.song) {
      const key = songKey(action?.songData)
      if (seenSongKeys.has(key)) continue
      if (action?.songData?.fromSaved) {
        if (localSongCount >= songCap) continue
        localSongCount += 1
      } else {
        if (remoteSongCount >= songCap) continue
        remoteSongCount += 1
      }
      seenSongKeys.add(key)
      if (!groupedResults.has(groupKey)) groupedResults.set(groupKey, [])
      groupedResults.get(groupKey)?.push(action)
      continue
    }

    if (!groupedResults.has(groupKey)) groupedResults.set(groupKey, [])
    const group = groupedResults.get(groupKey) as QuickAction[]
    // Narrowed to one kind of result, the list can afford to run long.
    const cap = searchScope.value
      ? 30
      : groupKey === "settings"
      ? 3
      : groupKey === "action"
      ? 8
      : 4
    if (group.length < cap) group.push(action)
  }

  // Library songs come before API songs above, which is right when the
  // library has the song the user typed — but a library near-miss
  // ("Praise Him") would sit above the API's exact hit ("Praise"). Within the
  // song group, lift exact title matches to the front; the sort is stable, so
  // library-before-API is kept among equals.
  // "Good and Loved" finds "Good & Loved", and "Promises by Maverick City"
  // finds "Promises" by that artist (see `songTitleMatchRank`).
  const songGroup = groupedResults.get(slideTypes.song)
  if (songGroup && songGroup.length > 1) {
    const rank = (action: QuickAction) =>
      songTitleMatchRank(action?.songData, searchQuery.value)
    songGroup.sort((a, b) => rank(a) - rank(b))
  }

  // Enforce a fixed reading order for the well-known groups — all runnable
  // actions first (the quickActionsArr entries, then their settings siblings,
  // kept adjacent so the Actions section reads as one block), then the dynamic
  // content groups: Bible, songs, hymns, time, and countdown — regardless of
  // which group happened to appear first in the raw fuzzy-matched results. Any
  // other group keeps its original relative order and is appended afterwards.
  const priorityGroupOrder = [
    "action",
    "settings",
    slideTypes.bible,
    slideTypes.song,
    slideTypes.hymn,
    slideTypes.time,
    slideTypes.countdown,
  ]
  const orderedGroups: [string, QuickAction[]][] = [
    ...priorityGroupOrder
      .filter((key) => groupedResults.has(key))
      .map(
        (key) =>
          [key, groupedResults.get(key) as QuickAction[]] as [
            string,
            QuickAction[]
          ]
      ),
    ...Array.from(groupedResults.entries()).filter(
      ([key]) => !priorityGroupOrder.includes(key)
    ),
  ]

  const ordered = orderedGroups.flatMap(([, group]) => group)

  // ── Float the best name matches to the very top ──────────────────────────
  // The grouping above enforces a fixed reading order by group (actions,
  // settings, Bible, songs, …). On its own that buries an entry whose NAME the
  // user typed (or nearly typed) beneath an entire higher-priority group —
  // e.g. "countdown" lists several loosely-matched songs before "Add Countdown
  // Timer" — or beneath weak desc/meta matches — e.g. "bible" lists
  // "Transcribe Sermon" / "Recent schedule" (matched on their descriptions)
  // above "Display Bible". So, independently of the grouping, fuzzy-match the
  // query against the *name* alone and pin the best few on top. fuzzysort
  // catches exact, full-substring AND close matches (a typo or a dropped
  // word), and `CONTENT_NAME_THRESHOLD` (the cutoff content titles are
  // matched with) keeps those, one-letter typos included ("amazng grace"),
  // while dropping unrelated noise. The pinned
  // ones are kept in their existing grouped order rather than raw fuzzysort
  // score, so when both an action and some content match ("bible" →
  // "Display Bible" vs a song titled "Bible Studies") the action still leads.
  // Capped at four. Skipped for confirmed Bible reference searches, whose
  // results are already exclusively the correct Bible books.
  //
  // The matches only decide WHICH GROUP leads — see the group promotion
  // below — never get lifted out of their group on their own.
  const bestMatchQuery = searchQuery.value

  if (isBibleReferenceSearch.value || bestMatchQuery.length < 2) {
    return ordered
  }

  const pinned: QuickAction[] = []
  const pinnedSet = new Set<QuickAction>()
  const pin = (action?: QuickAction | null) => {
    if (!action || pinnedSet.has(action) || pinned.length >= 4) return
    pinnedSet.add(action)
    pinned.push(action)
  }

  // A parsed timer command ("start 5 min timer") is an explicit instant-create
  // intent — keep it at the very top rather than in the last-ranked countdown
  // group.
  if (timerQuickAction.value && timerInScope) pin(timerQuickAction.value)

  // Then exact names: an action called what was typed ("Go Live"), then a
  // song titled it. A song's exact title can fail the fuzzy name match below
  // ("Good and Loved" against "Good & Loved"), and without a pin the Bible
  // group, which reads ahead of songs, would lead with loose verse matches.
  const typedName = normalizeSongTitle(bestMatchQuery)
  for (const action of ordered) {
    if (
      staticQuickActions.has(action) &&
      normalizeSongTitle(action.name) === typedName
    ) {
      pin(action)
    }
  }
  for (const action of ordered) {
    if (
      action.type === slideTypes.song &&
      songTitleMatchRank(action.songData, bestMatchQuery) < 2
    ) {
      pin(action)
    }
  }

  const closeNameMatches = new Set(
    fuzzysort
      .go(bestMatchQuery, ordered, {
        key: "name",
        threshold: CONTENT_NAME_THRESHOLD,
      })
      .map((result) => result.obj as QuickAction)
  )
  for (const action of ordered) {
    if (pinned.length >= 4) break
    if (closeNameMatches.has(action)) pin(action)
  }

  if (pinned.length === 0) return ordered

  // Promote the whole GROUP that owns a best match, not the matched row on its
  // own. Lifting a single row to the top splits its group in two — one hymn
  // (or saved-library song, or Bible verse) pinned above everything and the
  // rest of that group stranded further down the list — which is exactly the
  // scattering the grouping above exists to prevent. So the owning group moves
  // up as a block, and within it the matched rows lead.
  const promotedGroups: [string, QuickAction[]][] = []
  const remainingGroups: [string, QuickAction[]][] = []
  for (const entry of orderedGroups) {
    if (entry[1].some((action) => pinnedSet.has(action))) {
      promotedGroups.push(entry)
    } else {
      remainingGroups.push(entry)
    }
  }

  // Rank promoted groups by their best match. `pinned` is built by walking
  // `ordered`, so this preserves the existing grouped reading order among them
  // (actions before content, etc.); the one thing that jumps the queue is an
  // explicit instant-create timer command, pinned ahead of everything above.
  const bestPinnedRank = (group: QuickAction[]) =>
    Math.min(
      ...group
        .filter((action) => pinnedSet.has(action))
        .map((action) => pinned.indexOf(action))
    )
  promotedGroups.sort((a, b) => bestPinnedRank(a[1]) - bestPinnedRank(b[1]))

  return [...promotedGroups, ...remainingGroups].flatMap(([, group]) => [
    ...group.filter((action) => pinnedSet.has(action)),
    ...group.filter((action) => !pinnedSet.has(action)),
  ])
})

// Ways forward that close every search, shown under "Not what you need?": the
// groups above are capped at a handful of rows, and a search can come back
// empty, so each library gets a row that opens its own panel with the query
// already typed in — plus adding the song, since a church whose search failed
// often goes on to create that very song. Only the rows the scope covers are
// offered. None for a Bible reference or a timer, which are exact already.
const fallbackActions = computed((): QuickAction[] => {
  const query = searchQuery.value
  if (query.length < 2 || isBibleReferenceSearch.value) return []
  if (timerQuickAction.value) return []

  const scope = searchScope.value
  const offers = (...scopes: SearchScope[]) =>
    !scope || scopes.includes(scope)
  const quoted = `“${query}”`
  const rows: QuickAction[] = []

  if (offers("song")) {
    rows.push({
      icon: "i-bx-music",
      name: `See all song results for ${quoted}`,
      desc: "Search the full song library",
      action: appWideActions.newSongSearch,
      actionArg: query,
      opensPanel: true,
    })
  }
  // A hymnal number means nothing to the hymn panel or the Bible text search.
  if (offers("hymn") && !hymnalNumberQuery.value) {
    rows.push({
      icon: "i-bx-church",
      name: `See all hymn results for ${quoted}`,
      desc: "Search every hymn",
      action: appWideActions.newHymnSearch,
      actionArg: query,
      opensPanel: true,
    })
  }
  if (offers("bible") && !hymnalNumberQuery.value) {
    rows.push({
      icon: "i-bx-search",
      name: `Search Bible text for ${quoted}`,
      desc: "Find verses containing these words",
      action: appWideActions.newSearchBible,
      actionArg: query,
      opensPanel: true,
    })
  }
  if (offers("song", "library")) {
    rows.push({
      icon: "i-bx-plus",
      name: `Add ${quoted} as a new song`,
      desc: "Save it to your library",
      action: appWideActions.addSong,
      actionArg: query,
      opensPanel: true,
    })
  }
  // Mobile hides actions a phone can't carry out; keep these rows in step.
  return rows.filter(
    (row) => !(props.mobile && desktopOnlyActions.includes(row.action))
  )
})

const searchedActions = computed(() => [
  ...rankedSearchResults.value,
  ...fallbackActions.value,
])

watch(page, () => {
  focusedActionIndex.value = 0
  hasInteracted.value = false
  searchInput.value = ""
  if (page.value === "") {
    libraryPage.value = ""
    librarySongToEdit.value = undefined
    libraryNewSongTitle.value = ""
    libraryReviewing.value = false
  }
})

// Watch for focused action changes and scroll into view
watch(focusedActionIndex, () => {
  nextTick(() => {
    if (actionsContainer.value) {
      const focusedElement = actionsContainer.value.querySelector(
        `[data-action-index="${focusedActionIndex.value}"]`
      )
      if (focusedElement) {
        focusedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        })
      }
    }
  })
})
</script>

<style scoped>
.quick-actions-search-wrap {
  isolation: isolate;
}

.quick-actions-search-wrap::before {
  position: absolute;
  inset: -1px;
  z-index: -1;
  content: "";
  border-radius: 10px;
  background: linear-gradient(120deg, #ec5fc0, #a855f7, #4f8df7, #ec5fc0);
  background-size: 260% 260%;
  opacity: 0;
  filter: blur(7px);
  transition: opacity 220ms ease;
  pointer-events: none;
}

.quick-actions-search-wrap--focused::before {
  opacity: 0.46;
  animation: quick-actions-glow 4.8s ease-in-out infinite;
}

.quick-actions-search :deep(input) {
  min-height: 42px;
  border-radius: 8px;
  border: 0;
  box-shadow: none;
  background: #f8fafc;
  font-size: 14px;
  color: #374151;
}

.quick-actions-placeholder {
  position: absolute;
  top: 50%;
  right: 14px;
  left: 40px;
  z-index: 1;
  overflow: hidden;
  color: #8b5cf6;
  font-size: 14px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateY(-50%);
  pointer-events: none;
  background: linear-gradient(
    100deg,
    #9ca3af 0%,
    #9ca3af 24%,
    #ec5fc0 40%,
    #a855f7 52%,
    #4f8df7 64%,
    #9ca3af 80%,
    #9ca3af 100%
  );
  background-size: 240% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: quick-actions-placeholder-shimmer 3.6s ease-in-out infinite;
}

.quick-actions-searching-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  background: linear-gradient(
    100deg,
    #9ca3af 0%,
    #9ca3af 24%,
    #ec5fc0 40%,
    #a855f7 52%,
    #4f8df7 64%,
    #9ca3af 80%,
    #9ca3af 100%
  );
  background-size: 240% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: quick-actions-placeholder-shimmer 1.6s ease-in-out infinite;
}

html.dark .quick-actions-searching-text {
  background: linear-gradient(
    100deg,
    #9aa3b2 0%,
    #9aa3b2 24%,
    #f0abfc 40%,
    #c084fc 52%,
    #93c5fd 64%,
    #9aa3b2 80%,
    #9aa3b2 100%
  );
  background-size: 240% 100%;
  background-clip: text;
  -webkit-background-clip: text;
}

.quick-actions-placeholder-fade-enter-active,
.quick-actions-placeholder-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.quick-actions-placeholder-fade-enter-from {
  opacity: 0;
  transform: translateY(-42%);
}

.quick-actions-placeholder-fade-leave-to {
  opacity: 0;
  transform: translateY(-58%);
}

.quick-actions-search :deep(input:focus) {
  border: 0;
  box-shadow: none;
}

.quick-actions-search :deep(input::placeholder) {
  color: #9ca3af;
}

html.dark .quick-actions-search :deep(input) {
  border: 0;
  box-shadow: none;
  background: #2b3242;
  color: #d5dae3;
}

html.dark .quick-actions-search :deep(input:focus) {
  border: 0;
  box-shadow: none;
}

html.dark .quick-actions-search :deep(input::placeholder) {
  color: #9aa3b2;
}

html.dark .quick-actions-search-wrap--focused::before {
  opacity: 0.6;
}

html.dark .quick-actions-placeholder {
  background: linear-gradient(
    100deg,
    #9aa3b2 0%,
    #9aa3b2 24%,
    #f0abfc 40%,
    #c084fc 52%,
    #93c5fd 64%,
    #9aa3b2 80%,
    #9aa3b2 100%
  );
  background-size: 240% 100%;
  background-clip: text;
  -webkit-background-clip: text;
}

@keyframes quick-actions-glow {
  0%,
  100% {
    background-position: 0% 50%;
    opacity: 0.34;
  }

  50% {
    background-position: 100% 50%;
    opacity: 0.68;
  }
}

@keyframes quick-actions-placeholder-shimmer {
  0% {
    background-position: 180% 50%;
  }

  100% {
    background-position: -80% 50%;
  }
}

@keyframes quick-actions-placeholder-in {
  0% {
    opacity: 0;
  }

  12%,
  90% {
    opacity: 1;
  }

  100% {
    opacity: 0.72;
  }
}
</style>
