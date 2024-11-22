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
            : 'solid'
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
  onSearchInput(searchInput.value)
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
    let results = fuzzysort.go(query, formattedDefaultBible.value, {
      keys: ["scripture"],
    })
    results = results?.map((result) => result.obj) as BibleVerse[]
    verses.value = results.slice(0, 15)
  } else {
    const rand = Math.floor(Math.random() * 1115 + 15)
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
