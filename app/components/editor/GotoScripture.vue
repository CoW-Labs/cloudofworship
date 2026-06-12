<template>
  <div
    ref="panelRef"
    class="goto-scripture flex flex-col w-[46rem] max-w-[90vw] h-[20rem] text-black dark:text-white overflow-hidden"
  >
    <!-- Columns -->
    <div
      class="flex-1 min-h-0 grid grid-cols-[1.3fr_1fr_1fr] divide-x divide-primary-100 dark:divide-primary-800"
    >
      <!-- BOOK -->
      <div class="col-book flex flex-col min-h-0">
        <div class="flex items-center justify-between px-4 pt-3">
          <span class="text-xs font-bold tracking-wide text-primary-400"
            >BOOK</span
          >
        </div>
        <div class="px-4 py-2">
          <UTabs
            :items="testamentTabs"
            v-model:model-value="testamentTabIndex"
            size="xs"
            :ui="{ list: { tab: { size: 'text-[11px]' } } }"
          />
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          <button
            v-for="b in books"
            :key="b.index"
            type="button"
            :data-active="b.index === selectedBookIndex"
            class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-left transition-colors"
            :class="
              b.index === selectedBookIndex
                ? 'bg-primary-500 text-white'
                : 'hover:bg-primary-100 dark:hover:bg-primary-800'
            "
            @click="selectBook(b.index)"
          >
            <span class="font-medium truncate">{{ b.name }}</span>
            <span
              class="text-xs shrink-0"
              :class="
                b.index === selectedBookIndex
                  ? 'text-white/70'
                  : 'text-primary-400'
              "
            >
              {{ b.chapters }}
            </span>
          </button>
        </div>
      </div>

      <!-- CHAPTER -->
      <div class="col-chapter flex flex-col min-h-0">
        <div class="flex items-center gap-2 px-4 pt-3">
          <span class="text-xs font-bold tracking-wide text-primary-400"
            >CHAPTER</span
          >
          <span
            v-if="chapterCount"
            class="text-xs font-semibold text-primary-400 bg-primary-100 dark:bg-primary-800 rounded-full px-2 py-0.5"
          >
            {{ chapterCount }}
          </span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <div v-if="chapterCount" class="grid grid-cols-5 gap-2">
            <button
              v-for="ch in chapters"
              :key="ch"
              type="button"
              :data-active="ch === selectedChapter"
              class="aspect-square rounded-lg text-sm font-medium grid place-items-center transition-colors"
              :class="
                ch === selectedChapter
                  ? 'bg-primary-500 text-white'
                  : 'bg-primary-50 dark:bg-primary-800 hover:bg-primary-200 dark:hover:bg-primary-700'
              "
              @click="selectChapter(ch)"
            >
              {{ ch }}
            </button>
          </div>
          <p v-else class="text-sm text-primary-400 py-6 text-center">
            Select a book
          </p>
        </div>
      </div>

      <!-- VERSE -->
      <div class="col-verse flex flex-col min-h-0">
        <div class="flex items-center gap-2 px-4 pt-3">
          <span class="text-xs font-bold tracking-wide text-primary-400"
            >VERSE</span
          >
          <span
            v-if="verseCount"
            class="text-xs font-semibold text-primary-400 bg-primary-100 dark:bg-primary-800 rounded-full px-2 py-0.5"
          >
            {{ verseCount }}
          </span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <div v-if="verseCount" class="grid grid-cols-5 gap-2">
            <button
              v-for="v in verses"
              :key="v"
              type="button"
              :data-active="isVerseSelected(v)"
              class="aspect-square rounded-lg text-sm font-medium grid place-items-center transition-colors"
              :class="
                isVerseSelected(v)
                  ? 'bg-primary-500 text-white'
                  : 'bg-primary-50 dark:bg-primary-800 hover:bg-primary-200 dark:hover:bg-primary-700'
              "
              @click="selectVerse(v)"
            >
              {{ v }}
            </button>
          </div>
          <p v-else class="text-sm text-primary-400 py-6 text-center">
            Select a chapter
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  getChapterVerseCount,
  prewarmScriptureVersion,
} from "~/composables/useScripture"

const props = defineProps<{
  // Current verse label (e.g. "1 Samuel 17:54") used to pre-select on open
  verse?: string
  // Active Bible version — drives version-correct verse counts
  version?: string
}>()

const emit = defineEmits<{
  (e: "goto-verse", title: string): void
  (e: "close"): void
}>()

const testamentTabs = [
  { label: "Old Testament", key: "old" },
  { label: "New Testament", key: "new" },
]

const panelRef = ref<HTMLDivElement | null>(null)
const testament = ref<"old" | "new">("old")

// Two-way binding for UTabs (index ↔ testament string)
const testamentTabIndex = computed({
  get: () => (testament.value === "old" ? 0 : 1),
  set: (i: number) => { testament.value = i === 0 ? "old" : "new" },
})

const selectedBookIndex = ref<number | null>(null)
const selectedChapter = ref<number | null>(null)
const verseStart = ref<number | null>(null)
const verseCount = ref<number>(0)

// Books 1–39 (indices 0–38) are Old Testament; 40+ are New Testament
const OLD_TESTAMENT_LAST_INDEX = 38

const books = computed(() => {
  const start = testament.value === "old" ? 0 : OLD_TESTAMENT_LAST_INDEX + 1
  const end =
    testament.value === "old" ? OLD_TESTAMENT_LAST_INDEX + 1 : bibleBooks.length
  const list: { index: number; name: string; chapters: number }[] = []
  for (let i = start; i < end; i++) {
    list.push({
      index: i,
      name: bibleBooks[i]!,
      chapters: bibleBookChapters[i]!,
    })
  }
  return list
})

const chapterCount = computed(() =>
  selectedBookIndex.value === null
    ? 0
    : bibleBookChapters[selectedBookIndex.value] || 0
)
const chapters = computed(() =>
  Array.from({ length: chapterCount.value }, (_, i) => i + 1)
)
const verses = computed(() =>
  Array.from({ length: verseCount.value }, (_, i) => i + 1)
)

const isVerseSelected = (v: number) => v === verseStart.value

const fetchVerseCount = async () => {
  if (selectedBookIndex.value === null || selectedChapter.value === null) {
    verseCount.value = 0
    return
  }
  verseCount.value = await getChapterVerseCount(
    selectedBookIndex.value + 1,
    selectedChapter.value,
    props.version
  )
}

const selectBook = (index: number) => {
  selectedBookIndex.value = index
  selectedChapter.value = null
  verseStart.value = null
  verseCount.value = 0
}

const selectChapter = async (ch: number) => {
  selectedChapter.value = ch
  verseStart.value = null
  await fetchVerseCount()
  nextTick(scrollSelectedIntoView)
}

const selectVerse = (v: number) => {
  if (selectedBookIndex.value === null || selectedChapter.value === null) return
  verseStart.value = v
  emit(
    "goto-verse",
    `${bibleBooks[selectedBookIndex.value]} ${selectedChapter.value}:${v}`
  )
  emit("close")
}

const scrollSelectedIntoView = () => {
  panelRef.value
    ?.querySelectorAll<HTMLElement>('[data-active="true"]')
    .forEach((el) => el.scrollIntoView({ block: "nearest", inline: "nearest" }))
}

// Parse the current verse label to pre-select book / chapter / verse on open
const parseCurrentVerse = (raw?: string) => {
  if (!raw) return
  const bookChapter = raw.split(":")[0]?.trim()
  if (!bookChapter) return
  const lastSpace = bookChapter.lastIndexOf(" ")
  if (lastSpace === -1) return
  const bookName = bookChapter.slice(0, lastSpace).trim()
  const chapterNum = Number(bookChapter.slice(lastSpace + 1))
  const idx = bibleBooks.findIndex(
    (b) => b.toLowerCase() === bookName.toLowerCase()
  )
  if (idx === -1) return

  selectedBookIndex.value = idx
  testament.value = idx <= OLD_TESTAMENT_LAST_INDEX ? "old" : "new"
  if (Number.isFinite(chapterNum) && chapterNum >= 1)
    selectedChapter.value = chapterNum

  const versePart = raw.split(":")[1]
  if (versePart) {
    const startNum = Number(versePart.split("-")[0])
    if (Number.isFinite(startNum) && startNum >= 1) verseStart.value = startNum
  }
}

onMounted(async () => {
  prewarmScriptureVersion(props.version)
  parseCurrentVerse(props.verse)
  if (selectedBookIndex.value !== null && selectedChapter.value !== null) {
    await fetchVerseCount()
  }
  nextTick(scrollSelectedIntoView)
})
</script>
