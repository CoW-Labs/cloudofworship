<template>
  <div
    class="bible-main min-h-[80vh] h-[100%] flex flex-col"
    ref="quickActions"
    tabindex="1"
  >
    <div
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2">
        <UInput
          placeholder="Search scriptures"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
          @input="onSearchInput"
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

      <!-- SEARCHING BIBLE VERSES -->
      <div
        v-if="searchInput.length >= 2"
        class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <ActionCard
          v-for="(action, index) in searchedActions"
          :key="action?.name"
          :ref="(el) => setItemRef(el, index)"
          :action="{ ...action, bibleChapterAndVerse }"
          compact
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

      <!-- RECENTLY OPENED SCRIPTURES -->
      <div
        v-if="
          currentState.recentBibleSearches.length > 0 && searchInput.length < 2
        "
        class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <ActionCard
          v-for="(action, index) in recentBibleActions"
          :key="action.actionArg"
          :ref="(el) => setItemRef(el, index)"
          :action="action"
          compact
          :active="hasInteracted && index === focusedActionIndex"
          :class="{
            'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
          @mouseenter="onRowMouseEnter(index)"
        />
      </div>

      <EmptyState
        v-if="
          currentState.recentBibleSearches?.length === 0 &&
          searchInput.length < 2
        "
        icon="i-tabler-cloud-search"
        sub="You haven't opened any scriptures yet"
        action-text="Open Genesis 1"
        action="bible-search-demo"
      />
    </div>
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
const hasInteracted = ref(false)
const onRowMouseEnter = (index: number) => {
  focusedActionIndex.value = index
  hasInteracted.value = true
}
const quickActions = ref<HTMLDivElement | null>(null)
const actions = ref<QuickAction[]>([])
const itemRefs = ref<(HTMLElement | null)[]>([])

const setItemRef = (el: any, index: number) => {
  itemRefs.value[index] = el?.$el || el || null
}

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

watch(
  () => searchInput.value.length >= 2,
  () => {
    itemRefs.value = []
    focusedActionIndex.value = 0
    hasInteracted.value = false
  }
)

watch(focusedActionIndex, async () => {
  await nextTick()
  itemRefs.value[focusedActionIndex.value]?.scrollIntoView({ block: "nearest" })
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
  hasInteracted.value = false
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

const recentBibleActions = computed<QuickAction[]>(() => {
  return [...currentState.value.recentBibleSearches]
    .reverse()
    .map((bibleQuery) => {
      const colonIndex = bibleQuery.indexOf(":")
      return {
        icon: "i-bx-history",
        name: useScriptureLabel(bibleQuery, { toLongForm: true }),
        desc: "Recently opened",
        action: appWideActions.newBible,
        actionArg: bibleQuery,
        type: slideTypes.bible,
        bibleBookIndex: bibleQuery.substring(0, colonIndex),
        bibleChapterAndVerse: bibleQuery.substring(colonIndex + 1),
        recentSearch: true,
      }
    })
})

const visibleNavActions = computed<QuickAction[]>(() => {
  if (searchInput.value.length >= 2) {
    return searchedActions.value.map((action) => ({
      ...action,
      bibleChapterAndVerse: bibleChapterAndVerse.value,
    }))
  }
  return recentBibleActions.value
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
        hasInteracted.value = true
        focusedActionIndex.value < visibleNavActions.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        hasInteracted.value = true
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter":
        const action = visibleNavActions.value?.[
          focusedActionIndex.value
        ] as unknown as QuickAction
        if (!action) return
        useGlobalEmit(
          action?.action,
          action?.type === slideTypes.bible
            ? `${action?.bibleBookIndex}:${action?.bibleChapterAndVerse}`
            : action?.type === slideTypes.hymn
            ? action?.hymnIndex
            : action?.actionArg || ""
        )
        break
      default:
        return
    }
  })
})
</script>
