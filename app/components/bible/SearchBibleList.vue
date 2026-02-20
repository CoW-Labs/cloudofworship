<template>
  <div class="search-bible-main min-h-[80vh] h-[100%]" ref="quickActions">
    <div class="flex gap-2">
      <UInput
        icon="i-bx-search"
        :placeholder="getPlaceholderByFilter()"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @input.capture="loading = true"
        @keyup.enter="getVerses($event.target.value)"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <!-- CHIP GROUP -->
    <div class="button-row flex flex-nowrap my-4 gap-1 pb-2">
      <UButton
        :variant="selectedFilter === 'old' ? 'solid' : 'outline'"
        @click="selectedFilter = 'old'"
      >
        Old Test...
      </UButton>
      <UButton
        :variant="selectedFilter === 'new' ? 'solid' : 'outline'"
        @click="selectedFilter = 'new'"
      >
        New Test...
      </UButton>
      <USelectMenu
        :variant="
          selectedFilter === '' ||
          selectedFilter === 'old' ||
          selectedFilter === 'new'
            ? 'outline'
            : 'solid' as SelectVariant
        "
        color="black"
        placeholder="Bible book"
        v-model="selectedFilter"
        searchable
        :ui="{
          variant: {
            outline:
              'focus:ring-0 ring-0 text-primary font-medium border border-primary shadow-none',
            solid:
              'focus:ring-0 ring-0 text-white font-medium border-0 shadow-none bg-primary-500',
          },
        }"
        :options="bibleBooks"
      >
        <template #label>
          <span
            v-if="
              selectedFilter?.length &&
              !(
                selectedFilter === '' ||
                selectedFilter === 'old' ||
                selectedFilter === 'new'
              )
            "
            class="truncate w-12 lg:max-w-20"
            >{{ selectedFilter }}</span
          >
          <span v-else>Book</span>
        </template>
      </USelectMenu>
    </div>

    <div
      v-if="loading"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-260px)]"
    >
      <USkeleton
        v-for="i in 15"
        :key="i"
        class="w-[100%] h-[80px] mt-2"
      ></USkeleton>
    </div>
    <template v-else>
      <!-- SEARCHING BIBLE VERSES -->
      <div class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        <ActionCard
          v-for="(verse, index) in verses"
          :key="`verse ${index}`"
          :action="turnToBibleTypeAction(verse)"
          type="bible"
          action-suffix="whole-search"
          :class="{
            'bg-primary-50 dark:bg-primary-800 rounded-md':
              index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
        />
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { QuickAction, BibleVerse } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import fuzzysort from "fuzzysort"
import type { SelectVariant } from "@nuxt/ui/dist/runtime/types"
const db = useIndexedDB()
const appStore = useAppStore()

const defaultBible = ref<BibleVerse[]>([])
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const verses = ref<BibleVerse[]>()
const searchedVerses = ref<BibleVerse[]>([])
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)
const selectedFilter = ref<string>("")

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
        focusedActionIndex.value < searchedVerses.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter":
        const action = searchedVerses.value?.[focusedActionIndex.value]
        // useGlobalEmit(
        //   action.action,
        //   `${action.bibleBookIndex}:${bibleChapterAndVerse.value}`
        // )
        break
      default:
        return
    }
  })
  usePosthogCapture("SEARCH_BIBLE_PAGE_OPENED")
})

const getDefaultBible = async () => {
  const bible = await db.bibleAndHymns.get(
    appStore.currentState.settings.defaultBibleVersion
  )
  defaultBible.value = bible?.data as unknown as BibleVerse[]
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

    // Prepare search targets with book names for better context
    const searchTargets = formattedDefaultBible.value.map((verse) => ({
      ...verse,
      bookName: bibleBooks?.[Number(verse.book) - 1] || "",
      fullReference: `${bibleBooks?.[Number(verse.book) - 1]} ${
        verse.chapter
      }:${verse.verse}`,
    }))

    // Split query into words for multi-word matching
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0)
    
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
        return queryWords.every(word => combinedText.includes(word))
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
        queryWords.forEach(word => {
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

const onSearchInput = useDebounceFn(async () => {
  getVerses(searchInput.value)
}, 500)
</script>
