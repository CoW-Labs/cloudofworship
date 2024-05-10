<template>
  <AppSection
    heading="Quick Actions"
    :sub-heading="searchInput.length < 2 ? page?.replace('-', ' ') : 'Search'"
    class="max-w-[330px] relative"
    @header-click="searchInput.length < 2 ? (page = '') : (searchInput = '')"
  >
    <Transition name="fade-sm">
      <!-- ACTIONS HOME SECTION -->
      <div v-if="page === ''" class="main min-h-[100%]" ref="quickActions">
        <div class="flex gap-2">
          <UInput
            icon="i-bx-search"
            placeholder="Search scripture, hymns, actions"
            v-model="searchInput"
            color="black"
            class="w-[100%]"
          />
          <UButton
            v-if="searchInput.length >= 2"
            icon="i-bx-x"
            color="primary"
            @click="searchInput = ''"
          ></UButton>
        </div>

        <!-- BASIC ACTIONS -->
        <div
          v-if="searchInput.length < 2"
          class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-180px)]"
        >
          <ActionCard
            v-for="(action, index) in actions?.filter(
              (a) => !a?.searchableOnly
            )"
            :key="action?.name"
            :action="action"
            :class="{
              'bg-primary-50 dark:bg-primary-800 rounded-md':
                index === focusedActionIndex,
            }"
            @click="focusedActionIndex = index"
          />
        </div>

        <!-- SEARCHING ACTIONS -->
        <div
          v-else
          class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-180px)]"
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
      </div>

      <!-- SONG SECTION -->
      <SongsList
        v-else-if="page === 'song'"
        :query="songSearchQuery"
        @close="page = ''"
      />

      <!-- HYMN SECTION -->
      <HymnList v-else-if="page === 'hymn'" @close="page = ''" />

      <!-- MEDIA(IMAGE/VIDEO) SECTION-->
      <AddMedia v-else-if="page === 'media'" @close="page = ''" />

      <!-- SEARCH BIBLE SECTION-->
      <SearchBibleList v-else-if="page === 'search-bible'" @close="page = ''" />

      <!-- LIBRARY SECTION-->
      <PersonalLibrary
        v-else-if="page === 'library'"
        :page="libraryPage"
        @close="page = ''"
      />

      <!-- LIBRARY SECTION-->
      <AddAlert v-else-if="page === 'alert'" @close="page = ''" />
    </Transition>
  </AppSection>
</template>

<script setup lang="ts">
import type { Hymn, QuickAction } from "~/types"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { quickActionsArr } from "~/utils/constants"
import fuzzysort from "fuzzysort"

let searchInputBeforeTwoDigitNumbers = ""
const searchInput = ref<string>("")
const focusedActionIndex = ref<number>(0)
const quickActions = ref<HTMLDivElement | null>(null)
const appStore = useAppStore()
const page = ref<string>("") // song, search
const songSearchQuery = ref<string>("")
const hymns = useNuxtApp().$hymns as Array<Hymn>
const emitter = useNuxtApp().$emitter as Emitter<any>
const libraryPage = ref<string>("")

const actions = quickActionsArr.concat(
  bibleBooks?.map((book, index) => {
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
  }),
  hymns?.map((hymn: Hymn) => {
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
  })
)

emitter.on("new-song", ({ fromSaved }) => {
  if (!fromSaved) {
    page.value = "song"
  }
})

emitter.on("new-song-search", (query) => {
  songSearchQuery.value = query
  page.value = "song"
})

emitter.on("new-hymn", (data) => {
  if (data === "undefined") {
    page.value = "hymn"
  }
})

emitter.on("new-media", ({ fromSaved }) => {
  if (!fromSaved) {
    page.value = "media"
  }
})

emitter.on("new-search-bible", () => {
  page.value = "search-bible"
})

emitter.on("new-library", () => {
  page.value = "library"
})

emitter.on("new-alert", () => {
  page.value = "alert"
})

emitter.on("remove-alert", () => {
  appStore.setAlert(null)
  useToast().add({
    icon: "i-bx-trash",
    title: "Active alert has been removed",
  })
})

emitter.on("add-song", () => {
  libraryPage.value = "add-song"
  page.value = "library"
})

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
        const action = searchedActions.value?.[focusedActionIndex.value]
        useGlobalEmit(
          action?.action,
          `${action?.bibleBookIndex}:${bibleChapterAndVerse.value}`
        )
        break
      default:
        return
    }
  })
})

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

  let results = fuzzysort.go(searchInputBeforeColon, actions, {
    keys: ["name", "desc", "meta"],
  })
  results = results?.map((result) => result.obj)

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

watch(page, () => {
  focusedActionIndex.value = 0
  searchInput.value = ""
  if (page.value === "") {
    libraryPage.value = ""
  }
})
</script>

<style scoped></style>
