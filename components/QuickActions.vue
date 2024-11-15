<template>
  <AppSection
    heading="Quick Actions"
    :sub-heading="searchInput.length < 2 ? page?.replace('-', ' ') : 'Search'"
    class="max-w-[330px] relative overflow-visible z-20"
    @header-click="searchInput.length < 2 ? (page = '') : (searchInput = '')"
  >
    <!-- <Transition name="fade-sm" -->
    <!-- ACTIONS HOME SECTION -->
    <div
      v-if="page === ''"
      class="main come-up-1"
      ref="quickActions"
      tabindex="1"
    >
      <div
        class="group search-focus transition-all rounded-md focus-within:p-2 focus-within:bg-primary-100 focus-within:dark:bg-primary-800"
      >
        <div class="flex gap-2">
          <UInput
            icon="i-bx-search"
            placeholder="Search actions, scripture, hymns..."
            v-model="searchInput"
            color="black"
            class="w-[100%]"
            ref="searchInputEl"
          />
          <UButton
            v-if="searchInput.length >= 2"
            icon="i-bx-x"
            color="primary"
            @click="searchInput = ''"
          ></UButton>
        </div>
        <div
          class="hidden max-w-[100%] group-focus-within:flex items-center gap-2 whitespace-nowrap text-md pl-1 pt-3 come-up-1"
        >
          <div>Search anything</div>
          <div class="flex overflow-x-auto scrollbar-none">
            <SlideChip
              v-for="slideType in [
                slideTypes.bible,
                slideTypes.hymn,
                slideTypes.song,
              ]"
              :key="slideType"
              :slide-type="slideType"
              class="mr-1"
              :dark-mode="useColorMode().value === 'dark'"
            />
            & more
          </div>
        </div>
      </div>

      <Transition name="fade-sm">
        <NotFoundBanner
          v-if="searchInput.length >= 4"
          icon="i-bx-music"
          sub="Are you looking for contemporary songs and not hymns?"
          action="new-song-search"
          :query="searchInput"
          action-text="Search here"
        />
      </Transition>

      <!-- BASIC ACTIONS -->
      <div
        v-if="searchInput.length < 2"
        class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <ActionCard
          v-for="(action, index) in actions?.filter((a) => !a?.searchableOnly)"
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
        class="actions-ctn mt-2 overflow-y-auto"
        :class="
          searchInput.length >= 4
            ? 'max-h-[calc(100vh-350px)]'
            : 'max-h-[calc(100vh-190px)]'
        "
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
    <BibleList
      v-else-if="page === 'bible'"
      :query="bibleSearchQuery"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- SONG SECTION -->
    <SongsList
      v-else-if="page === 'song'"
      :query="songSearchQuery"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- HYMN SECTION -->
    <HymnList
      v-else-if="page === 'hymn'"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- MEDIA(IMAGE/VIDEO) SECTION-->
    <AddMedia
      v-else-if="page === 'media'"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- SEARCH BIBLE SECTION-->
    <SearchBibleList
      v-else-if="page === 'search-bible'"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- LIBRARY SECTION-->
    <PersonalLibrary
      v-else-if="page === 'library'"
      class="come-up-1"
      :page="libraryPage"
      @close="page = ''"
    />

    <!-- LIBRARY SECTION-->
    <AddAlert
      v-else-if="page === 'alert'"
      class="come-up-1"
      @close="page = ''"
    />

    <!-- COUNTDOWN SECTION-->
    <AddCountdown
      v-else-if="page === 'countdown'"
      class="come-up-1"
      @close="page = ''"
    />
    <!-- </Transition> -->
  </AppSection>
</template>

<script setup lang="ts">
import type { Hymn, QuickAction } from "~/types"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { quickActionsArr } from "~/utils/constants"
import fuzzysort from "fuzzysort"
const db = useIndexedDB()

let searchInputBeforeTwoDigitNumbers = ""
const searchInputEl = ref<HTMLInputElement>()
const searchInput = ref<string>("")
const focusedActionIndex = ref<number>(0)
const actions = ref<any[]>([])
const quickActions = ref<HTMLDivElement | null>(null)
const appStore = useAppStore()
const page = ref<string>("") // song, search, bible, hymn...
const songSearchQuery = ref<string>("")
const bibleSearchQuery = ref<string>("")
const hymns = ref<Hymn[]>([])
const emitter = useNuxtApp().$emitter as Emitter<any>
const libraryPage = ref<string>("")

const getAllHymns = async () => {
  const allHymns = await db.bibleAndHymns.get("hymns")
  hymns.value = allHymns?.data as unknown as Hymn[]

  actions.value = quickActionsArr.concat(
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
    hymns.value?.map((hymn: Hymn) => {
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
}

getAllHymns()

watch(page, () => {
  if (page.value === "") {
    bibleSearchQuery.value = ""
  }
})

watch(searchInput, () => {
  if (searchInput.value.startsWith("/") && searchInput.value.length > 1) {
    searchInput.value = searchInput.value.replaceAll("/", "")
  }
})

emitter.on("new-bible", (data) => {
  if (data === "") {
    page.value = "bible"
  }
})

emitter.on("bible-search-demo", () => {
  bibleSearchQuery.value = "Gen 1:1"
})

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

emitter.on("new-media", (data) => {
  const fromSaved = data?.[0]?.fromSaved
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
  appStore.setActiveAlert(null)
  useToast().add({
    icon: "i-bx-trash",
    title: "Active alert has been removed",
  })
  const socket = useNuxtApp().$socket as WebSocket
  socket.send(
    JSON.stringify({
      action: "remove-alert",
    })
  )
})

emitter.on("add-song", () => {
  libraryPage.value = "add-song"
  page.value = "library"
})

emitter.on("new-countdown", () => {
  page.value = "countdown"
})

onMounted(() => {
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
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        // console.log("down")
        focusedActionIndex.value < searchedActions.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        // console.log("up")
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

const bibleChapterAndVerse = computed(() => {
  const regex = /\b\d+\s*:\s*\d+\b|\b\d+\s\d+\b/g
  const match = searchInput.value
    ?.replace("/", "")
    .match(regex)?.[0]
    ?.replaceAll(" ", ":")
  return match?.trim()
})

const searchedActions = computed(() => {
  const twoDigitNumbers = searchInput.value
    ?.replace("/", "")
    ?.match(/\b\d{2}\b/g)

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

watch(page, () => {
  focusedActionIndex.value = 0
  searchInput.value = ""
  if (page.value === "") {
    libraryPage.value = ""
  }
})
</script>

<style scoped></style>
