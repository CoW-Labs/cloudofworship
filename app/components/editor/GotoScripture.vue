<template>
  <div
    ref="panelRef"
    class="goto-scripture flex h-full w-full flex-col overflow-hidden bg-[#f1f3f6] text-gray-800 dark:bg-[#131724] dark:text-[#F8F9FB]"
  >
    <div
      class="grid min-h-0 flex-1 grid-cols-[1.15fr_1fr_1fr] divide-x divide-white/80 dark:divide-[#0D0F1A]"
    >
      <div class="col-book flex min-h-0 flex-col">
        <div class="flex h-9 shrink-0 items-center px-3">
          <span class="text-[12px] font-normal leading-[17px]">Book</span>
        </div>
        <div class="shrink-0 px-3 pb-3">
          <UTabs
            v-model:model-value="testamentTabIndex"
            :items="testamentTabs"
            :content="false"
            class="w-fit"
            :ui="{
              wrapper: 'relative',
              list: {
                background: 'bg-gray-200 dark:bg-[#222838]',
                rounded: 'rounded-full',
                height: 'h-[33px]',
                width: 'w-fit',
                marker: {
                  background: 'bg-white dark:bg-[#2B3140]',
                  rounded: 'rounded-full',
                  shadow: 'shadow-sm dark:shadow-none',
                },
                tab: {
                  active: 'text-gray-950 dark:text-[#F8F9FB]',
                  inactive:
                    'text-gray-600 hover:text-gray-950 dark:text-[#9BA3B2] dark:hover:text-[#F8F9FB]',
                  height: 'h-[25px]',
                  size: 'text-[11px]',
                  font: 'font-normal',
                  rounded: 'rounded-full',
                },
              },
            }"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <button
            v-for="b in books"
            :key="b.index"
            type="button"
            :data-active="b.index === selectedBookIndex"
            class="flex h-8 w-full items-center justify-between gap-2 border-b border-white/80 px-3 text-left text-[12px] transition-colors dark:border-[#0D0F1A]"
            :class="
              b.index === selectedBookIndex
                ? 'bg-white/80 text-gray-900 dark:bg-[#2B3140] dark:text-[#F8F9FB]'
                : 'text-gray-600 hover:bg-white/55 hover:text-gray-900 dark:text-[#9BA3B2] dark:hover:bg-[#1a1f2d] dark:hover:text-[#F8F9FB]'
            "
            @click="selectBook(b.index)"
          >
            <span class="truncate font-normal">{{ b.name }}</span>
            <span
              class="shrink-0 text-[10px]"
              :class="
                b.index === selectedBookIndex
                  ? 'text-gray-500 dark:text-[#F8F9FB]/70'
                  : 'text-gray-400 dark:text-[#697181]'
              "
            >
              {{ b.chapters }}
            </span>
          </button>
        </div>
      </div>

      <div class="col-chapter flex min-h-0 flex-col">
        <div class="flex h-9 shrink-0 items-center gap-2 px-3">
          <span class="text-[12px] font-normal leading-[17px]">Chapter</span>
          <span
            v-if="chapterCount"
            class="rounded-full bg-white px-2 py-0.5 text-[10px] font-normal text-gray-500 dark:bg-[#222838] dark:text-[#9BA3B2]"
          >
            {{ chapterCount }}
          </span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div v-if="chapterCount" class="grid grid-cols-5 gap-2">
            <button
              v-for="ch in chapters"
              :key="ch"
              type="button"
              :data-active="ch === selectedChapter"
              class="grid h-7 place-items-center rounded-full text-[11px] font-normal transition-colors"
              :class="
                ch === selectedChapter
                  ? 'bg-white text-gray-900 ring-2 ring-primary-300 dark:bg-[#E8D1F8] dark:text-[#131724] dark:ring-0'
                  : 'bg-white/70 text-gray-600 hover:bg-white hover:text-gray-900 dark:bg-[#222838] dark:text-[#9BA3B2] dark:hover:bg-[#2B3140] dark:hover:text-[#F8F9FB]'
              "
              @click="selectChapter(ch)"
            >
              {{ ch }}
            </button>
          </div>
          <p
            v-else
            class="py-6 text-center text-[11px] text-gray-400 dark:text-[#697181]"
          >
            Select a book
          </p>
        </div>
      </div>

      <div class="col-verse flex min-h-0 flex-col">
        <div class="flex h-9 shrink-0 items-center gap-2 px-3">
          <span class="text-[12px] font-normal leading-[17px]">Verse</span>
          <span
            v-if="verseCount"
            class="rounded-full bg-white px-2 py-0.5 text-[10px] font-normal text-gray-500 dark:bg-[#222838] dark:text-[#9BA3B2]"
          >
            {{ verseCount }}
          </span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div v-if="verseCount" class="grid grid-cols-5 gap-2">
            <button
              v-for="v in verses"
              :key="v"
              type="button"
              :data-active="isVerseSelected(v)"
              class="grid h-7 place-items-center rounded-full text-[11px] font-normal transition-colors"
              :class="
                isVerseSelected(v)
                  ? 'bg-white text-gray-900 ring-2 ring-primary-300 dark:bg-[#E8D1F8] dark:text-[#131724] dark:ring-0'
                  : 'bg-white/70 text-gray-600 hover:bg-white hover:text-gray-900 dark:bg-[#222838] dark:text-[#9BA3B2] dark:hover:bg-[#2B3140] dark:hover:text-[#F8F9FB]'
              "
              @click="selectVerse(v)"
            >
              {{ v }}
            </button>
          </div>
          <p
            v-else
            class="py-6 text-center text-[11px] text-gray-400 dark:text-[#697181]"
          >
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
  (e: "resize", size: { width: number; height: number }): void
}>()

const panelSize = { width: 753, height: 330 }

const testamentTabs = [
  { label: "Old Testament", key: "old" },
  { label: "New Testament", key: "new" },
]

const panelRef = ref<HTMLDivElement | null>(null)
const testament = ref<"old" | "new">("old")
const testamentTabIndex = computed({
  get: () => (testament.value === "new" ? 1 : 0),
  set: (index: number) => {
    testament.value = index === 1 ? "new" : "old"
  },
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
  emit("resize", panelSize)
  prewarmScriptureVersion(props.version)
  parseCurrentVerse(props.verse)
  if (selectedBookIndex.value !== null && selectedChapter.value !== null) {
    await fetchVerseCount()
  }
  nextTick(scrollSelectedIntoView)
})
</script>
