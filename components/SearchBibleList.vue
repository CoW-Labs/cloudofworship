<template>
  <div class="search-bible-main min-h-[90vh]" ref="quickActions">
    <div class="flex gap-2">
      <UInput
        icon="i-bx-search"
        placeholder="Search the KJV Bible"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @input.capture="loading = true"
        @keyup.enter="getVerses($event.target.value)"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <div
      v-if="loading"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-180px)]"
    >
      <USkeleton
        v-for="i in 15"
        :key="i"
        class="w-[100%] h-[80px] mt-2"
      ></USkeleton>
    </div>
    <template v-else>
      <!-- SEARCHING BIBLE VERSES -->
      <div class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-180px)]">
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
import fuzzysort from "fuzzysort"
const db = useIndexedDB()

const kjvBible = ref<BibleVerse[]>([])
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const verses = ref<BibleVerse[]>()
const searchedVerses = ref<BibleVerse[]>([])
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)

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

const getBible = async () => {
  const bible = await db.bibleAndHymns.get("KJV")
  kjvBible.value = bible?.data as unknown as BibleVerse[]
  getVerses()
}

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

const getVerses = (query: string = "") => {
  if (query?.length >= 2) {
    loading.value = true
    let results = fuzzysort.go(query, kjvBible.value, {
      keys: ["scripture"],
    })
    results = results?.map((result) => result.obj) as BibleVerse[]
    verses.value = results.slice(0, 15)
  } else {
    const rand = Math.floor(Math.random() * 1115 + 15)
    verses.value = kjvBible.value.slice(rand - 15, rand)
  }
  loading.value = false
}

getBible()

const onSearchInput = useDebounceFn(async () => {
  getVerses(searchInput.value)
}, 500)
</script>
