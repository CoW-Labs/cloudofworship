<template>
  <div class="bible-main min-h-[80vh] h-[100%]" ref="quickActions" tabindex="1">
    <div class="flex gap-2">
      <UInput
        icon="i-bx-search"
        placeholder="Search scriptures"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <!-- SEARCHING BIBLE VERSES -->
    <div
      v-if="searchInput.length >= 2"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
    >
      <ActionCard
        v-for="(action, index) in searchedActions"
        :key="action?.name"
        :action="{ ...action, bibleChapterAndVerse }"
        :class="{
          'bg-primary-50 dark:bg-primary-800 rounded-md':
            index === focusedActionIndex,
        }"
        @click="focusedActionIndex = index"
      />
    </div>

    <!-- RECENTLY OPENED SCRIPTURES -->
    <div
      v-if="
        currentState.recentBibleSearches.length > 0 && searchInput.length < 2
      "
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
    >
      <BibleQueryCard
        v-for="bibleQuery in [...currentState.recentBibleSearches].reverse()"
        :key="bibleQuery"
        :bible-query="bibleQuery"
        type="song"
      />
    </div>

    <EmptyState
      v-if="
        currentState.recentBibleSearches?.length === 0 && searchInput.length < 2
      "
      icon="i-tabler-cloud-search"
      sub="You haven't opened any scriptures yet"
      action-text="Open Genesis 1"
      action="bible-search-demo"
    />
  </div>
</template>
<script setup lang="ts">
import type { QuickAction, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import { useAppStore } from "~/store/app"
let searchInputBeforeTwoDigitNumbers = ""
import fuzzysort from "fuzzysort"

const props = defineProps<{
  query: string
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const searchInput = ref<string>(props.query || "")
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)
const actions = ref<QuickAction[]>([])

watch(
  () => props.query,
  () => {
    searchInput.value = props.query
  }
)

watch(searchInput, () => {
  if (searchInput.value.startsWith("/") && searchInput.value.length > 1) {
    searchInput.value = searchInput.value.replaceAll("/", "")
  }
})

// Initialize actions
const scriptureActions: QuickAction[] = bibleBooks?.map((book, index) => {
  const bibleBookIndex = index + 1 // Does not start from 0, starts from 1
  return {
    icon: "i-bx-bible",
    name: `${book}`,
    desc: `Open the book of ${book}`,
    action: "new-bible",
    meta: `${book} 0:0 1:1 2:2 3:3 4:4 5:5 6:6 7:7 8:8 9:9 10:10 -`,
    searchableOnly: true,
    bibleBookIndex: `${bibleBookIndex}`,
    type: slideTypes.bible,
  }
})
actions.value = scriptureActions

const bibleChapterAndVerse = computed(() => {
  const regex = /\b\d+\s*:\s*\d+\b|\b\d+\s\d+\b/g
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

const searchedActions = computed<QuickAction[]>(() => {
  const twoDigitNumbers = searchInput.value?.match(/\b\d{2}\b/g)

  // Stop search if input includes two digit number
  if (!twoDigitNumbers) {
    searchInputBeforeTwoDigitNumbers = searchInput.value
  }

  focusedActionIndex.value = 0
  const colonIndex = searchInputBeforeTwoDigitNumbers?.indexOf(":")
  const searchInputBeforeColon =
    colonIndex === -1
      ? searchInputBeforeTwoDigitNumbers
      : searchInputBeforeTwoDigitNumbers?.substring(0, colonIndex)

  let results: any | Fuzzysort.Result[] = fuzzysort.go(
    searchInputBeforeColon,
    actions.value,
    {
      keys: ["name", "desc", "meta"],
    }
  )
  results = results?.map((result: Fuzzysort.Result | any) => result.obj)

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
  return results?.slice(0, 10)
})

const onSearchInput = useDebounceFn(async () => {
  // getSongs(searchInput.value)
}, 1000)

onMounted(() => {
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        focusedActionIndex.value < searchedActions.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter":
        const action = searchedActions.value?.[
          focusedActionIndex.value
        ] as unknown as QuickAction
        useGlobalEmit(
          action?.action,
          action?.type === slideTypes.bible
            ? `${action?.bibleBookIndex}:${bibleChapterAndVerse.value}`
            : action?.type === slideTypes.hymn
            ? action?.hymnIndex
            : ""
        )
        break
      default:
        return
    }
  })
})
</script>
