<template>
  <div
    class="search-bible-main min-h-[80vh] h-[100%] flex flex-col"
    ref="quickActions"
  >
    <div
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2">
        <UInput
          :placeholder="getPlaceholderByFilter()"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
          @input="onSearchInput"
          @input.capture="loading = true"
          @keyup.enter="getVerses($event.target.value)"
        >
          <template #leading>
            <SearchIcon class="w-4 h-4 text-gray-400 dark:text-[#9aa3b2]" />
          </template>
        </UInput>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-2.5 !py-0 max-h-[40px] rounded-lg"
          @click="$emit('close')"
        >
          <CloseIcon class="w-4 h-4" />
        </CowButton>
      </div>

      <!-- CHIP GROUP -->
      <div
        class="button-row flex flex-nowrap items-center mt-2 gap-2 pb-1"
        v-if="!shouldUseOnlineSearch"
      >
        <UTabs
          :items="testamentTabs"
          v-model:model-value="testamentTabIndex"
          size="sm"
        />
        <!-- <CowDropdown
          label="Bible book"
          class="flex-1"
          :model-value="isBookFilterSelected ? selectedFilter : ''"
          @update:model-value="selectedFilter = $event"
          :searchable="true"
          :options="bibleBooks"
        /> -->
      </div>

      <div
        v-if="loading"
        class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto"
        :class="
          shouldUseOnlineSearch
            ? 'max-h-[calc(100vh-200px)]'
            : 'max-h-[calc(100vh-260px)]'
        "
      >
        <CowSkeleton variant="row" :count="15" />
      </div>
      <template v-else>
        <!-- SEARCHING BIBLE VERSES -->
        <div
          class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto"
          :class="
            shouldUseOnlineSearch
              ? 'max-h-[calc(100vh-200px)]'
              : 'max-h-[calc(100vh-260px)]'
          "
        >
          <ActionCard
            v-for="(verse, index) in verses"
            :key="`verse ${index}`"
            :ref="(el) => setItemRef(el, index)"
            :action="turnToBibleTypeAction(verse)"
            type="bible"
            action-suffix="whole-search"
            compact
            show-subtext
            :active="hasInteracted && index === focusedActionIndex"
            :class="{
              'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
            }"
            @click="focusedActionIndex = index"
            @mouseenter="onRowMouseEnter(index)"
          >
            <template #desc>
              <span v-html="highlightText(verse.scripture, searchInput)" />
            </template>
          </ActionCard>
        </div>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { QuickAction, BibleVerse } from "~/types"
import { useDebounceFn, useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import fuzzysort from "fuzzysort"

const db = useIndexedDB()
const appStore = useAppStore()
const online = useOnline()
const { checkFlag } = useFeatureFlags()
const { isTeamsPlan } = useSubscription()
const {
  results: onlineSearchResults,
  isSearching,
  search: searchOnline,
  clearResults: clearOnlineResults,
} = useScriptureSearch()

const defaultBible = ref<BibleVerse[]>([])
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const verses = ref<BibleVerse[]>()
const focusedActionIndex = ref(0)
// Preview only shows for the active row once the user has actually
// interacted with the list (hover or first arrow key press) — not for the
// index-0 default before any interaction.
const hasInteracted = ref(false)
const onRowMouseEnter = (index: number) => {
  focusedActionIndex.value = index
  hasInteracted.value = true
}
const quickActions = ref<HTMLDivElement | null>(null)
const selectedFilter = ref<string>("old")
const itemRefs = ref<(HTMLElement | null)[]>([])

const testamentTabs = [
  { label: "Old Testament", key: "old" },
  { label: "New Testament", key: "new" },
]

// Two-way binding for UTabs (index ↔ selectedFilter string)
const testamentTabIndex = computed({
  get: () => (selectedFilter.value === "new" ? 1 : 0),
  set: (i: number) => {
    selectedFilter.value = i === 0 ? "old" : "new"
  },
})

const setItemRef = (el: any, index: number) => {
  itemRefs.value[index] = el?.$el || el || null
}

/**
 * Whether to use the online scripture search endpoint.
 *
 * Logic:
 *   flag OFF (default) → online search for everyone (when online)
 *   flag ON            → online search only for Teams plan users
 */
const shouldUseOnlineSearch = computed(() => {
  if (!online.value) return false
  const teamsOnly = checkFlag("allow-online-scripture-search-for-only-teams")
  return teamsOnly ? isTeamsPlan.value : true
})

const turnToBibleTypeAction = (bibleVerse: BibleVerse) => {
  const bibleChapterAndVerse = `${bibleVerse.chapter}:${bibleVerse.verse}`
  return {
    icon: "i-bx-bible",
    name: `${
      bibleBooks?.[Number(bibleVerse.book) - 1]
    } ${bibleChapterAndVerse}`,
    desc: bibleVerse.scripture,
    action: "new-bible",
    bibleBookIndex: bibleVerse.book,
    type: slideTypes.bible,
    bibleChapterAndVerse,
  }
}

watch(selectedFilter, () => {
  getVerses()
  loading.value = true
  onSearchInput()
})

watch(
  () => appStore.currentState.settings.defaultBibleVersion,
  () => {
    getDefaultBible()
  }
)

const isBookFilterSelected = computed(() => {
  return !["", "old", "new"].includes(selectedFilter.value)
})

const oldTestamentBible = computed(() => {
  return defaultBible.value.filter((b) => Number(b.book) <= 39)
})

const newTestamentBible = computed(() => {
  return defaultBible.value.filter((b) => Number(b.book) > 39)
})

const formattedDefaultBible = computed(() => {
  if (selectedFilter.value === "old") {
    return oldTestamentBible.value
  } else if (selectedFilter.value === "new") {
    return newTestamentBible.value
  } else if (selectedFilter.value === "") {
    return defaultBible.value
  } else {
    const bibleBookIndex =
      bibleBooks.findIndex((b) => b === selectedFilter.value) + 1
    const tempBible = defaultBible.value?.filter(
      (b) => Number(b.book) === bibleBookIndex
    )
    return tempBible
  }
})

onMounted(() => {
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        hasInteracted.value = true
        focusedActionIndex.value < (verses.value?.length || 0) - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        hasInteracted.value = true
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter": {
        const verse = verses.value?.[focusedActionIndex.value]
        if (!verse) return
        const action = turnToBibleTypeAction(verse)
        useGlobalEmit(
          `${action.action}-whole-search`,
          `${action.bibleBookIndex}:${action.bibleChapterAndVerse}`
        )
        break
      }
      default:
        return
    }
  })
  usePosthogCapture("SEARCH_BIBLE_PAGE_OPENED")
})

watch(verses, () => {
  itemRefs.value = []
  focusedActionIndex.value = 0
  hasInteracted.value = false
})

watch(focusedActionIndex, async () => {
  await nextTick()
  itemRefs.value[focusedActionIndex.value]?.scrollIntoView({ block: "nearest" })
})

const getDefaultBible = async () => {
  const version = appStore.currentState.settings.defaultBibleVersion
  if (!version) return
  const bible = await db.bibleAndHymns.get(version)
  defaultBible.value = (bible?.data as unknown as BibleVerse[]) || []
  getVerses()
}

const getVerses = (query: string = "") => {
  if (query?.length >= 2) {
    loading.value = true

    // Track Bible search
    usePosthogCapture("BIBLE_SEARCH_PERFORMED", {
      searchQuery: query,
      bibleVersion: appStore.currentState.settings.defaultBibleVersion,
    })

    // ── Online search ────────────────────────────────────────────────────
    if (shouldUseOnlineSearch.value) {
      // Clear previous results so stale items don't flash before new ones arrive
      clearOnlineResults()
      searchOnline(query)
      // loading state is driven by the isSearching watcher below
      return
    }

    // ── Offline / local fuzzy search ─────────────────────────────────────
    const searchTargets = formattedDefaultBible.value.map((verse) => ({
      ...verse,
      bookName: bibleBooks?.[Number(verse.book) - 1] || "",
      fullReference: `${bibleBooks?.[Number(verse.book) - 1]} ${
        verse.chapter
      }:${verse.verse}`,
    }))

    // Split query into words for multi-word matching
    const queryWords = Array.isArray(query)
      ? query
      : query
          ?.toLowerCase()
          ?.trim()
          ?.split(/\s+/)
          ?.filter((w) => w.length > 0)

    // If single word or phrase, use fuzzy search
    let results: any[] = []

    if (queryWords.length === 1) {
      // Single word fuzzy search
      const fuzzyResults = fuzzysort.go(query, searchTargets, {
        keys: ["scripture", "bookName", "fullReference"],
        limit: 50,
        threshold: -10000,
        scoreFn: (a) => {
          const scriptureScore = a[0] ? a[0].score : -Infinity
          const bookNameScore = a[1] ? a[1].score * 0.5 : -Infinity
          const referenceScore = a[2] ? a[2].score * 0.7 : -Infinity
          return Math.max(scriptureScore, bookNameScore, referenceScore)
        },
      })
      results = fuzzyResults?.map((result: any) => result.obj) || []
    } else {
      // Multi-word search: find verses containing all words in any order
      results = searchTargets.filter((verse) => {
        const scriptureLower = verse.scripture.toLowerCase()
        const bookNameLower = verse.bookName.toLowerCase()
        const fullReferenceLower = verse.fullReference.toLowerCase()
        const combinedText = `${scriptureLower} ${bookNameLower} ${fullReferenceLower}`

        // Check if all query words are present in any field
        return queryWords.every((word) => combinedText.includes(word))
      })

      // Score and sort results based on word proximity and frequency
      results = results.map((verse) => {
        const scriptureLower = verse.scripture.toLowerCase()
        const bookNameLower = verse.bookName.toLowerCase()

        let score = 0

        // Higher score for exact phrase match
        if (scriptureLower.includes(query.toLowerCase())) {
          score += 1000
        }

        // Score based on word positions (closer words = higher score)
        const positions: number[] = []
        queryWords.forEach((word) => {
          const pos = scriptureLower.indexOf(word)
          if (pos !== -1) {
            positions.push(pos)
            score += 100 // Base score for word in scripture
          } else if (bookNameLower.includes(word)) {
            score += 50 // Word in book name
          }
        })

        // Bonus for words appearing close together
        if (positions.length > 1) {
          positions.sort((a, b) => a - b)
          const maxDistance = positions[positions.length - 1] - positions[0]
          // Shorter distance = higher score
          score += Math.max(0, 100 - maxDistance)
        }

        // Bonus for matching word count
        const wordCount = scriptureLower.split(/\s+/).length
        const matchRatio = queryWords.length / wordCount
        score += matchRatio * 50

        return { ...verse, searchScore: score }
      })

      // Sort by score descending
      results.sort((a: any, b: any) => b.searchScore - a.searchScore)
    }

    verses.value = results.slice(0, 15)
  } else {
    verses.value = formattedDefaultBible.value.slice(0, 15)
  }
  loading.value = false
}

const getPlaceholderByFilter = () => {
  if (shouldUseOnlineSearch.value) return "Search the Bible across translations"
  switch (selectedFilter.value) {
    case "new":
      return `Search the New Testament (${appStore.currentState.settings.defaultBibleVersion})`
    case "old":
      return `Search the Old Testament (${appStore.currentState.settings.defaultBibleVersion})`
    case "":
      return `Search the ${appStore.currentState.settings.defaultBibleVersion} Bible`
    default:
      return `Search ${selectedFilter.value} (${appStore.currentState.settings.defaultBibleVersion})`
  }
}

getDefaultBible()

// Keep loading indicator in sync with the online search request state
watch(isSearching, (val) => {
  if (shouldUseOnlineSearch.value) loading.value = val
})

// Populate verses as online search results arrive
watch(onlineSearchResults, (results) => {
  if (shouldUseOnlineSearch.value) {
    const tempResults = results as unknown as BibleVerse[]
    verses.value = tempResults
  }
})

const onSearchInput = useDebounceFn(async () => {
  getVerses(searchInput.value)
}, 500)
</script>
