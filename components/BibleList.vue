<template>
  <div class="bible-main min-h-[80vh] h-[100%]" ref="quickActions">
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
    bibleBookIndex,
    type: slideTypes.bible,
  }
})
actions.value = scriptureActions

const bibleChapterAndVerse = computed(() => {
  const regex = /\b\d+\s*:\s*\d+\b/g
  return searchInput.value.match(regex)?.[0]?.replaceAll(" ", "")
})

const searchedActions = computed(() => {
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

  let results = fuzzysort.go(searchInputBeforeColon, actions.value, {
    keys: ["name", "desc", "meta"],
  })
  results = results?.map((result) => result.obj)

  // Sort by showing [searchableOnly] actions last
  results.sort((a, b) => {
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
    results.sort((a, b) => {
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
</script>
