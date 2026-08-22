<template>
  <AppSection
    heading="Quick Actions"
    :sub-heading="searchInput.length < 2 ? page?.replace('-', ' ') : 'Search'"
    class="w-full relative overflow-hidden z-20"
    @header-click="searchInput.length < 2 ? (page = '') : (searchInput = '')"
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

      <!-- QUICK FILTER CHIPS + AI TRANSCRIPTION PROMO (only while a search session is active) -->
      <div
        v-if="isSearchFocused && searchInput.length < 2"
        class="quick-search-panel come-up-1 mt-3 rounded-2xl bg-white dark:bg-[#2b3242] p-4 pb-5"
      >
        <div class="quick-filters flex flex-wrap gap-2">
          <button
            v-for="filter in quickFilters"
            :key="filter.label"
            class="quick-filter-chip flex items-center gap-1.5 text-sm rounded-full bg-gray-100 dark:bg-[#222938] px-3 py-1.5 text-gray-600 dark:text-[#9aa3b2] hover:bg-gray-200 dark:hover:bg-[#1d2433] transition-colors whitespace-nowrap"
            @click="handleChipClick(filter.action)"
          >
            {{ filter.label }}
            <CloseIcon
              v-if="filter.removable"
              class="w-5 h-5 rounded-full bg-gray-300 text-gray-900 dark:bg-gray-100 dark:text-gray-900 p-0.5"
            />
          </button>
        </div>

        <button
          class="ai-transcription-card group w-full text-center rounded-xl border border-dashed border-gray-600 dark:border-[#586277] p-6 mt-6 mb-0 hover:border-primary-400 dark:hover:border-[#6b7588] transition-colors"
          @click="handleTranscribeClick"
        >
          <span
            class="inline-block text-[10px] font-bold tracking-wide bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-md px-2 py-0.5 mb-2"
          >
            NEW
          </span>
          <h4 class="font-semibold text-base text-gray-900 dark:text-white">
            AI Transcription
          </h4>
          <p
            class="text-xs text-gray-500 dark:text-[#9aa3b2] mt-1 max-w-[220px] mx-auto"
          >
            Bible references highlighted automatically
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
          :key="action?.name"
          :action="action"
          compact
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
        <div
          v-if="isSearchingRemote"
          class="flex items-center gap-1.5 px-3 py-2"
        >
          <SearchIcon class="w-3.5 h-3.5 text-primary-400 shrink-0" />
          <span class="quick-actions-searching-text"
            >Searching global library&hellip;</span
          >
        </div>

        <ActionCard
          v-for="(action, index) in searchedActions"
          :key="action?.name"
          :action="{
            ...action,
            bibleChapterAndVerse:
              action?.bibleChapterAndVerse || bibleChapterAndVerse,
          }"
          compact
          :data-action-index="index"
          :active="hasInteracted && index === focusedActionIndex"
          :class="{
            'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
          @mouseenter="onRowMouseEnter(index)"
        >
          <template #desc>
            <span v-html="highlightText(action.desc ?? '', searchInput)" />
          </template>
        </ActionCard>
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
      class="fade-in-right h-full min-h-0 overflow-auto"
      @close="page = ''"
    />

    <!-- LIBRARY SECTION-->
    <PersonalLibrary
      v-else-if="page === 'library'"
      class="fade-in-right h-full min-h-0 overflow-auto"
      :page="libraryPage"
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
import { quickActionsArr } from "~/utils/constants"
import { escapePriority } from "~/composables/useEscapeKey"
import { useDebounceFn, useOnline } from "@vueuse/core"
import fuzzysort from "fuzzysort"
const db = useIndexedDB()
const { hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")
const online = useOnline()
const { savedSongs } = useLibrary()
const { searchSongs } = useSongs()

let searchInputBeforeTwoDigitNumbers = ""
const searchInputEl = ref<{ input: HTMLInputElement }>()
const searchInput = ref<string>("")
// Tracks whether the search box currently has focus — drives the quick-filter
// chips + AI Transcription promo, which should only appear during an active
// search session (focused), not on the idle home state.
const isSearchFocused = ref(false)
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null
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
    "great commission",
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
    "Sunday praise set",
    "communion songs",
    "altar call songs",
    "opening worship set",
    "closing worship songs",
  ],
  textSlides: [
    "Create Text Slide",
    "welcome slide",
    "sermon title slide",
    "offering announcement",
  ],
  media: [
    "image library",
    "Add Media",
    "upload video",
    "background image",
    "sermon bumper",
    "audio file",
    "motion background",
  ],
  templates: [
    "Slide Templates",
    "lower third template",
    "sermon notes template",
    "announcement template",
    "Bible verse template",
    "minimal worship template",
    "countdown template",
  ],
  alerts: [
    "Add Banners/Alert",
    "Remove Alert",
    "prayer line alert",
    "kids pickup alert",
    "offering banner",
    "stream starting alert",
    "service update banner",
  ],
  countdowns: ["Add Countdown Timer", "5 min timer", "30s timer"],
  times: ["Add Time Slide", "current time", "clock", "live clock"],
  embeds: [
    "Add YouTube Video",
    "Add Vimeo Video",
    "YouTube worship video",
    "sermon clip",
    "testimony video",
    "online announcement video",
    "embed livestream",
  ],
  presentations: [
    "Import Slides",
    "PowerPoint import",
    "PDF presentation",
    "Google Slides import",
    "Canva slides",
    "sermon deck",
    "guest speaker slides",
  ],
  library: [
    "My Library",
    "saved songs",
    "favorite slides",
    "uploaded files",
    "personal media",
    "reuse last Sunday",
    "saved backgrounds",
  ],
  transcription: [
    "Transcribe Sermon",
    "sermon transcription",
    "auto Bible slides",
    "microphone transcript",
    "audio to text",
    "highlight scriptures",
    "record message notes",
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
    "reload schedule",
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
    "Intermission Settings",
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
const quickSearchPlaceholder = computed(
  () => `Try "${quickSearchSuggestions[quickSearchSuggestionIndex.value]}"`
)
let quickSearchSuggestionInterval: ReturnType<typeof setInterval> | null = null

const handleSearchFocus = () => {
  if (searchBlurTimeout) clearTimeout(searchBlurTimeout)
  isSearchFocused.value = true
}

const handleSearchBlur = () => {
  // Delay so a click on a chip/promo card (which blurs the input first)
  // still registers before the chips disappear.
  searchBlurTimeout = setTimeout(() => {
    if (!searchInput.value?.trim()) {
      isSearchFocused.value = false
    }
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
const hymns = ref<Hymn[]>([])
const emitter = useNuxtApp().$emitter as Emitter<any>
const libraryPage = ref<string>("")

// Active Bible version, used to validate parsed references against the right
// verse index (see the reference filter in `searchedActions`).
const defaultBibleVersion = computed(
  () => appStore.currentState.settings.defaultBibleVersion || "KJV"
)

// Bumped once the verse index for the active version has been built. Read inside
// `searchedActions` so it re-runs and can drop impossible references (e.g. a
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

// Persistent quick-filter chips shown in the home state. Visual shortcuts that
// trigger existing actions; gated through the same subscription check as cards.
const quickFilters: { label: string; action: string; removable?: boolean }[] = [
  { label: "Bible", action: appWideActions.quickActionsFocus },
  { label: "Song lyrics", action: appWideActions.quickActionsFocus },
  { label: "Hymns", action: appWideActions.quickActionsFocus },
  { label: "Library", action: appWideActions.quickActionsFocus },
  { label: "Actions", action: appWideActions.quickActionsFocus },
  { label: "More", action: appWideActions.quickActionsFocus },
]

const handleChipClick = (action: string) => {
  if (!hasAccessToFeature(action) && isPremiumFeatureEnabled.value) {
    emitter.emit("show-upgrade-modal")
    usePosthogCapture("TEAMS_FEATURE_BLOCKED", { feature: action })
    return
  }
  useGlobalEmit(action)
}

const handleTranscribeClick = () => {
  handleChipClick(appWideActions.newTranscribe)
}

const getAllHymns = async () => {
  const allHymns = await db.bibleAndHymns.get("hymns")
  hymns.value = (allHymns?.data || []) as unknown as Hymn[]
  loading.value = false
}

getAllHymns()

// Turns a Song into a searchable quick action that creates a song slide when picked.
const mapSongToAction = (song: Song, fromSaved: boolean): QuickAction => {
  return {
    icon: "i-bx-music",
    name: song?.title || "",
    desc: song?.artist || song?.author || (fromSaved ? "saved song" : "song"),
    action: "new-song",
    meta: `${song?.artist || ""} ${song?.lyrics || ""}`,
    searchableOnly: true,
    songData: { ...song, fromSaved } as Song,
    type: slideTypes.song,
  }
}

// Remote (global) song search results — always fetched alongside the local
// library match so both sources are represented; duplicates and the 3+3 cap
// are resolved when the song group is built in searchedActions. Gated behind
// the Teams subscription like the rest of "new-song" (only skipped when the
// paywall flag is actually enabled, matching hasAccessToFeature usage elsewhere).
const remoteSongActions = ref<QuickAction[]>([])
const isSearchingRemoteSongs = ref(false)
// Guards against out-of-order results when overlapping calls fire (e.g. fast
// typing outpacing the debounce) — only the most recent call is allowed to
// update state.
let remoteSongsRequestId = 0

const fetchRemoteSongsIfNeeded = useDebounceFn(async (query: string) => {
  const requestId = ++remoteSongsRequestId
  const songSearchAllowed =
    hasAccessToFeature("new-song") || !isPremiumFeatureEnabled.value

  if (query.length < 2 || !songSearchAllowed) {
    remoteSongActions.value = []
    isSearchingRemoteSongs.value = false
    return
  }

  isSearchingRemoteSongs.value = true
  try {
    const results = await searchSongs(query, 6)
    if (requestId !== remoteSongsRequestId) return
    remoteSongActions.value = (results || []).map((song) =>
      mapSongToAction(song, false)
    )
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
        desc: `verse and chorus included`,
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
    return Boolean(action?.name && action?.icon && action?.action)
  })
})

const visibleActions = computed(() => {
  return validActions.value.filter((action) => !action.searchableOnly)
})

watch(page, () => {
  if (page.value === "") {
    bibleSearchQuery.value = ""
  }
})

const currentQuickActions = computed(() => {
  return searchInput.value?.length >= 2
    ? searchedActions.value
    : visibleActions.value
})

watch(searchInput, (value) => {
  if (value.startsWith("/") && value.length > 1) {
    searchInput.value = value.replaceAll("/", "")
    return
  }
  focusedActionIndex.value = 0
  hasInteracted.value = false
  const query = value?.replaceAll("/", "").trim() || ""

  // Clear stale results from the previous query immediately, rather than
  // leaving them on screen until the new debounced fetch resolves. Bumping
  // the request IDs also invalidates any in-flight requests for the old query.
  remoteSongsRequestId++
  remoteSongActions.value = []
  isSearchingRemoteSongs.value = false
  remoteBibleRequestId++
  remoteBibleActions.value = []
  isSearchingRemoteBible.value = false

  // A confirmed Bible reference search ("Psa 101", "Eph 3:20") already tells
  // us exactly which book/chapter/verse is wanted, so there's nothing the
  // global song/scripture library search could usefully add — skip it.
  if (isBibleReferenceSearch.value) return

  fetchRemoteSongsIfNeeded(query)
  fetchRemoteBibleIfNeeded(query)
})

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

emitter.on("new-bible", (data) => {
  if (data === "" && !isInSearchResults.value) {
    page.value = "bible"
  }
})

emitter.on("bible-search-demo", () => {
  bibleSearchQuery.value = "Gen 1:1"
})

emitter.on("new-song", (data: any) => {
  if (!data && !isInSearchResults.value) {
    page.value = "song"
  }
})

emitter.on("new-song-search", (query) => {
  songSearchQuery.value = query
  page.value = "song"
})

emitter.on("new-hymn", (data) => {
  if (data === "undefined" && !isInSearchResults.value) {
    page.value = "hymn"
  }
})

emitter.on("new-media", (data) => {
  const fromSaved = data?.[0]?.fromSaved
  const fromDrop = data?.[0]?.fromDrop
  if (!fromSaved && !fromDrop) {
    page.value = "media"
  }
})

emitter.on("new-youtube-video", () => {
  page.value = "youtube"
})

emitter.on("new-vimeo-video", () => {
  page.value = "vimeo"
})

emitter.on("new-search-bible", () => {
  page.value = "search-bible"
})

emitter.on("new-library", () => {
  page.value = "library"
})

emitter.on("new-templates", () => {
  page.value = "templates"
})

emitter.on(appWideActions.newSchedulesList, () => {
  page.value = "schedules-list"
})

emitter.on("new-alert", () => {
  page.value = "alert"
})

emitter.on("remove-alert", () => {
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

emitter.on("add-song", () => {
  libraryPage.value = "add-song"
  page.value = "library"
})

emitter.on("new-countdown", (data) => {
  if (!data) {
    page.value = "countdown"
  }
})

// A payload means a deck is being imported, not that the panel should open.
emitter.on("new-presentation", (data) => {
  if (!data) page.value = "presentation"
})

emitter.on("new-presentation-from-pdf", () => {
  page.value = "presentation-pdf"
})

const handleInputKeydown = (e: KeyboardEvent) => {
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
        const actionName = action?.action || ""
        if (!hasAccessToFeature(actionName) && isPremiumFeatureEnabled.value) {
          emitter.emit("show-upgrade-modal")
          usePosthogCapture("TEAMS_FEATURE_BLOCKED", {
            feature: actionName,
          })
          return
        }
        useGlobalEmit(
          action?.action,
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
        )
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

  emitter.on(appWideActions.quickActionsFocus, () => {
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

    if (searchInput.value) {
      searchInput.value = ""
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
  document.removeEventListener("mousedown", handleOutsidePointerDown)
})

const bibleChapterAndVerse = computed(() => {
  // The optional `(?:-\d+)?` captures a verse range like "5-6" so "John 3 5-6"
  // / "John 3:5-6" resolve to chapter 3, verses 5-6 (useScripture understands
  // the "start-end" verse form) instead of silently dropping the range.
  const regex = /\b\d+\s*:\s*\d+(?:-\d+)?\b|\b\d+\s\d+(?:-\d+)?\b/g
  const bibleBookFollowedByJustChapterMatch = searchInput.value
    ?.replace("/", "")
    .match(/\b\w+\s+\d+\b(?!\S)/g)

  if (
    bibleBookFollowedByJustChapterMatch?.[0] &&
    !searchInput.value?.match(regex)
  ) {
    const standaloneChapter = Number(
      bibleBookFollowedByJustChapterMatch?.[0]?.split(" ")?.[1] || 1
    )
    const verse = 1
    return `${standaloneChapter}:${verse}`
  }

  const match = searchInput.value
    ?.replace("/", "")
    .match(regex)?.[0]
    ?.replaceAll(" ", ":")
  return match?.trim()
})

// The book-name-only portion of the query once a chapter/verse has been
// recognised (see `bibleChapterAndVerse` above) — e.g. "Psa 101" -> "Psa",
// "Psa 127 24" -> "Psa", "Psa 27:4" -> "Psa". Reads off the live
// `searchInput` rather than a frozen/debounced copy so it can't get stuck on
// a stale value once a two-digit number appears anywhere in the query.
const bibleBookQuery = computed(() => {
  if (!bibleChapterAndVerse.value) return ""
  return (
    searchInput.value
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

const isBibleReferenceSearch = computed(() => {
  if (!bibleChapterAndVerse.value || !bibleBookQuery.value) return false
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
  const input = searchInput.value?.toLowerCase() || ""
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

// Reference set of the static, user-runnable quick actions (the ones authored
// in `quickActionsArr`). Used by the search grouping to tell an *action* the
// user can run — "Display Bible", "Add Media", "Add Countdown Timer" — apart
// from a dynamic library *result* (an actual Bible verse, song or hymn), which
// is built fresh in the `actions` computed and so isn't in this set. Built once
// (the array is a module constant); membership is by object reference, which
// survives the `.filter()` in `validActions`.
const staticQuickActions = new Set<QuickAction>(quickActionsArr)

const searchedActions = computed(() => {
  const twoDigitNumbers = searchInput.value
    ?.replace("/", "")
    ?.match(/\b\d{2}\b/g)

  // Stop search if input includes two digit number
  if (!twoDigitNumbers) {
    searchInputBeforeTwoDigitNumbers = searchInput.value
  }

  const colonIndex = searchInputBeforeTwoDigitNumbers?.indexOf(":")
  const searchInputBeforeColon =
    colonIndex === -1
      ? searchInputBeforeTwoDigitNumbers
      : searchInputBeforeTwoDigitNumbers?.substring(0, colonIndex)

  // Once a chapter/verse has been recognised, match book names on their own
  // (see `bibleBookQuery`) instead of throwing the chapter/verse digits into
  // the fuzzy search too — otherwise that either fails to match any book once
  // the numbers are something fuzzysort can't line up against a book name
  // (e.g. "Psa 103" matched nothing) or spuriously matches unrelated books
  // whose letters happen to fuzzy-match the digits (e.g. "Psa 101" matching
  // "Ephesians"). `bibleBookQuery` reads off the live `searchInput` rather
  // than the frozen `searchInputBeforeColon` above — that freeze exists to
  // stop the search from flickering while a verse's digits are still being
  // typed, but once a full chapter/verse has been parsed out there's nothing
  // left to protect against, and using the frozen copy can leave this stuck
  // on a stale (even empty) value once a two-digit number appears anywhere.
  const searchInputForMatch = bibleChapterAndVerse.value
    ? bibleBookQuery.value
    : searchInputBeforeColon

  let results: any = fuzzysort.go(searchInputForMatch, validActions.value, {
    keys: ["name", "desc", "meta"],
    // Once we're confident this is an actual Bible reference (see
    // `isBibleReferenceSearch`), only keep genuine book-name matches instead
    // of every loose fuzzy match — a 3-letter book abbreviation like "Psa"
    // would otherwise also weakly match plenty of unrelated songs/hymns.
    ...(isBibleReferenceSearch.value ? { threshold: -1000 } : {}),
  })
  results = results?.map((result: Fuzzysort.Result | any) => result.obj)
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
  // search (see the `searchInput` watcher below) is skipped entirely and
  // there's nothing useful it could add — keep only the local book matches.
  if (!isBibleReferenceSearch.value) {
    // API-searched (global) songs, fetched alongside local library matches
    // (see fetchRemoteSongsIfNeeded)
    if (remoteSongActions.value.length > 0) {
      results = results.concat(remoteSongActions.value)
    }

    // API-searched (global) Bible verses, fetched alongside local book
    // matches (see fetchRemoteBibleIfNeeded)
    if (remoteBibleActions.value.length > 0) {
      results = results.concat(remoteBibleActions.value)
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

  if (timerQuickAction.value) {
    results = [timerQuickAction.value, ...results]
  }

  // Group results by type (hymn, song, bible, media, etc.) so each category
  // stays together instead of interleaving by raw relevance rank. Actions
  // without a `type` fall into a generic "action" bucket. Groups keep the
  // relative order of their best (first) match from the sorting above.
  // The song group is special-cased: up to 3 from the library + 3 from the
  // API (6 total), skipping API songs that duplicate an already-shown
  // library song (matched on title + artist/author).
  const groupedResults = new Map<string, QuickAction[]>()
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
        if (localSongCount >= 3) continue
        localSongCount += 1
      } else {
        if (remoteSongCount >= 3) continue
        remoteSongCount += 1
      }
      seenSongKeys.add(key)
      if (!groupedResults.has(groupKey)) groupedResults.set(groupKey, [])
      groupedResults.get(groupKey)?.push(action)
      continue
    }

    if (!groupedResults.has(groupKey)) groupedResults.set(groupKey, [])
    const group = groupedResults.get(groupKey) as QuickAction[]
    const cap = groupKey === "settings" ? 3 : groupKey === "action" ? 8 : 4
    if (group.length < cap) group.push(action)
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
  const orderedGroups = [
    ...priorityGroupOrder
      .filter((key) => groupedResults.has(key))
      .map((key) => groupedResults.get(key) as QuickAction[]),
    ...Array.from(groupedResults.entries())
      .filter(([key]) => !priorityGroupOrder.includes(key))
      .map(([, group]) => group),
  ]

  const ordered = orderedGroups.flat()

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
  // word), and its -1000 threshold (the same cutoff used for Bible-book
  // matching above) keeps those while dropping unrelated noise. The pinned
  // ones are kept in their existing grouped order rather than raw fuzzysort
  // score, so when both an action and some content match ("bible" →
  // "Display Bible" vs a song titled "Bible Studies") the action still leads.
  // Capped at four. Skipped for confirmed Bible reference searches, whose
  // results are already exclusively the correct Bible books.
  const bestMatchQuery = searchInput.value?.replaceAll("/", "").trim() ?? ""

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
  if (timerQuickAction.value) pin(timerQuickAction.value)

  const closeNameMatches = new Set(
    fuzzysort
      .go(bestMatchQuery, ordered, { key: "name", threshold: -1000 })
      .map((result) => result.obj as QuickAction)
  )
  for (const action of ordered) {
    if (pinned.length >= 4) break
    if (closeNameMatches.has(action)) pin(action)
  }

  if (pinned.length === 0) return ordered

  return [...pinned, ...ordered.filter((action) => !pinnedSet.has(action))]
})

watch(page, () => {
  focusedActionIndex.value = 0
  hasInteracted.value = false
  searchInput.value = ""
  if (page.value === "") {
    libraryPage.value = ""
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
