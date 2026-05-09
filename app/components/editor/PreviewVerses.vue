<template>
  <div
    ref="versesPreview"
    class="verse-preview behavior-smooth absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 overflow-auto shadow-lg rounded-b-md"
  >
    <div
      v-if="slide?.type === slideTypes.songSetlist"
      class="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-primary-200 dark:bg-primary-900 px-4 py-3 border-b border-primary-200 dark:border-primary-950"
    >
      <div
        v-for="(item, index) in setlistData.songs"
        :key="item.id"
        role="button"
        tabindex="0"
        class="group relative min-w-[150px] max-w-[210px] rounded-md border border-transparent px-3 py-2 pr-9 text-left transition-all cursor-pointer outline-none text-black dark:text-white"
        :class="
          index === setlistData.activeSongIndex
            ? 'bg-primary-300 dark:bg-primary-600 shadow-sm ring-2 ring-primary-300 dark:ring-primary-500/50'
            : 'bg-primary-100 dark:bg-primary-700 hover:bg-primary-300 dark:hover:bg-primary-600 focus:bg-primary-300 dark:focus:bg-primary-600'
        "
        @click="$emit('goto-song', index)"
        @keydown.enter.prevent="$emit('goto-song', index)"
        @keydown.space.prevent="$emit('goto-song', index)"
      >
        <p class="truncate text-sm font-bold leading-tight">
          {{ item.song?.title || `Song ${index + 1}` }}
        </p>
        <p
          class="truncate text-xs leading-tight text-black/70 dark:text-white/70"
        >
          {{ item.song?.artist || "Unknown artist" }}
        </p>
        <div
          class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        >
          <UButton
            icon="i-tabler-trash"
            size="xs"
            variant="ghost"
            color="gray"
            class="h-8 w-8 p-0 grid place-items-center hover:bg-primary-300 dark:hover:bg-primary-500"
            @click.stop="$emit('remove-song', index)"
          />
        </div>
      </div>
    </div>

    <!-- Bible verses -->
    <template v-if="slide?.type === slideTypes.bible">
      <UButton
        block
        variant="ghost"
        v-show="verseTemp?.scripture.trim()"
        v-for="(verseTemp, index) in allChapterVerses"
        :key="`verse-${index}`"
        :id="convertStringToSlug(`${bibleChapter + '-' + verseTemp?.verse}`)"
        class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
        :class="{
          'bg-primary-300 dark:bg-primary-900':
            `${bibleChapter}:${verseTemp?.verse}` === verse,
        }"
        @click="$emit('goto-verse', `${bibleChapter}:${verseTemp?.verse}`)"
      >
        <div class="flex-initial min-w-[8ch] text-xs font-semibold">
          {{
            `${bibleChapter?.substring(bibleChapter?.lastIndexOf(" "))}:${
              verseTemp?.verse
            }`
          }}
        </div>
        <div class="flex-initial w-[100%] text-xs">
          {{ verseTemp?.scripture }}
        </div>
      </UButton>
    </template>

    <!-- Hymn verses with chorus after Verse 1 -->
    <template v-else-if="slide?.type === slideTypes.hymn">
      <UButton
        block
        variant="ghost"
        v-show="item.content?.trim()"
        v-for="(item, index) in hymnVersesWithChorus"
        :key="`hymn-${index}`"
        :id="item.type === 'chorus' ? 'chorus' : `verse-${item.verseNum}`"
        class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
        :class="{
          'bg-primary-300 dark:bg-primary-900':
            item.type === 'chorus'
              ? verse === 'Chorus'
              : `Verse ${item.verseNum}` === verse,
        }"
        @click="
          $emit(
            'goto-verse',
            item.type === 'chorus' ? 'Chorus' : `Verse ${item.verseNum}`
          )
        "
      >
        <div class="flex-initial min-w-[8ch] text-xs font-semibold">
          {{ item.type === "chorus" ? "Chorus" : `Verse ${item.verseNum}` }}
        </div>
        <div class="flex-initial w-[100%] text-xs">
          {{ item.content }}
        </div>
      </UButton>
    </template>

    <!-- Song verses -->
    <template v-else>
      <UButton
        block
        variant="ghost"
        v-show="verseTemp?.trim()"
        v-for="(verseTemp, index) in relatedData?.verses"
        :key="`verse-${index}`"
        :id="convertStringToSlug(`Verse ${Number(index) + 1}`)"
        class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
        :class="{
          'bg-primary-300 dark:bg-primary-900':
            `Verse ${Number(index) + 1}` === verse,
        }"
        @click="$emit('goto-verse', `Verse ${Number(index) + 1}`)"
      >
        <div class="flex-initial min-w-[8ch] text-xs font-semibold">
          {{ `Verse ${Number(index) + 1}` }}
        </div>
        <div class="flex-initial w-[100%] text-xs">
          {{ verseTemp }}
        </div>
      </UButton>
    </template>
  </div>
</template>
<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type {
  Scripture,
  Slide,
  BibleVerse,
  Song,
  SongSetlistData,
} from "~/types"

const props = defineProps<{
  slide: Slide
  verse: string
}>()

const allChapterVerses = ref<BibleVerse[]>()
const relatedData = ref<any>({})
const bibleChapter = computed(() => props.verse?.split(":")?.[0])
const versesPreview = ref<HTMLDivElement | null>(null)
const setlistData = computed<SongSetlistData>(() => {
  const data = props.slide?.data as SongSetlistData | undefined
  return {
    songs: Array.isArray(data?.songs) ? data.songs : [],
    activeSongIndex: data?.activeSongIndex || 0,
  }
})

// Build hymn verses list with chorus after Verse 1
const hymnVersesWithChorus = computed(() => {
  const items: {
    type: "verse" | "chorus"
    content: string
    verseNum: number
  }[] = []
  const verses = relatedData.value?.verses || []
  const chorus = relatedData.value?.chorus
  const hasChorus = props.slide?.hasChorus && chorus && chorus !== "false"

  verses.forEach((verse: string, index: number) => {
    items.push({ type: "verse", content: verse, verseNum: index + 1 })
    // Add chorus after Verse 1
    if (index === 0 && hasChorus) {
      items.push({ type: "chorus", content: chorus, verseNum: 0 })
    }
  })

  return items
})

const getAllChapterVerses = async () => {
  const chapter = await useScriptureChapter(props.verse)
  // console.log("chapter", chapter?.content)
  allChapterVerses.value = chapter?.content as BibleVerse[]
}

// Return connected Hymn / Song object related
const getSongOrHymnObj = async () => {
  switch (props.slide?.type) {
    case slideTypes.hymn:
      const hymn = await useHymn(props.slide?.songId!!)
      relatedData.value = hymn
      break
    case slideTypes.song:
      // console.log(props.slide)
      const song = await useSong(
        (props.slide?.data as Song) || props.slide?.songId!!
      )
      relatedData.value = song
      break
    case slideTypes.songSetlist: {
      const setlistData = props.slide?.data as SongSetlistData | undefined
      const activeItem = setlistData?.songs?.[setlistData?.activeSongIndex || 0]
      relatedData.value = activeItem
        ? await useSong(activeItem.song || activeItem.songId)
        : {}
      break
    }
  }
}

const convertStringToSlug = (str: string) => {
  return str
    .toLowerCase()
    .replaceAll("1 ", "one-")
    .replaceAll("2 ", "two-")
    .replaceAll("3 ", "three-")
    .replaceAll(" ", "-")
    .replaceAll(":", "-")
}

onMounted(() => {
  if (props.verse?.includes(":")) {
    getAllChapterVerses()
  }
  // Scroll active verse into view on first open
  nextTick(() => scrollActiveVerseIntoView())
})

const scrollActiveVerseIntoView = () => {
  if (!versesPreview.value) return

  let selector: string | null = null

  if (props.slide?.type === slideTypes.bible) {
    // Bible button IDs are generated in the template as:
    //   convertStringToSlug(`${bibleChapter}-${verseTemp.verse}`)
    // e.g. bibleChapter="John 3", verse=16 → id="john-3-16"
    // Reconstruct the exact same ID from props.verse ("John 3:16").
    const verseNum = props.verse?.split(":")?.[1]?.split("-")?.[0]
    if (verseNum && bibleChapter.value) {
      const id = convertStringToSlug(`${bibleChapter.value}-${verseNum}`)
      selector = `#${id}`
    }
  } else if (props.slide?.type === slideTypes.hymn) {
    // Hymn IDs: "chorus" or "verse-{n}"
    if (props.verse === "Chorus") {
      selector = "#chorus"
    } else {
      const verseNum = props.verse?.split(" ")?.[1]
      if (verseNum) selector = `#verse-${verseNum}`
    }
  } else {
    // Song IDs: convertStringToSlug("Verse {n}") — digits get stripped to "verse-"
    // Match by the data label instead: look for the item at the correct index.
    const verseNum = props.verse?.split(" ")?.[1]
    if (verseNum) {
      // Find the nth .item button (1-indexed)
      const allItems = versesPreview.value.querySelectorAll(".item")
      const target = allItems[Number(verseNum) - 1] as HTMLElement | undefined
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
  }

  if (selector) {
    try {
      const el = versesPreview.value.querySelector(
        selector
      ) as HTMLElement | null
      el?.scrollIntoView({ block: "nearest" })
    } catch (err) {
      // querySelector throws SyntaxError for invalid selectors (e.g. book names
      // with dots or leading hyphens). This is safe to ignore — the list remains
      // visible; only the auto-scroll is skipped.
    }
  }
}

watch(
  () => props.slide,
  (newVal, oldVal) => {
    if (newVal?.id !== oldVal?.id) {
      // Slide changed — wait for the list to re-render then scroll
      nextTick(() => scrollActiveVerseIntoView())
    }
  },
  { immediate: true }
)

// Scroll whenever the active verse changes (next/prev navigation on the same slide)
watch(
  () => props.verse,
  () => {
    nextTick(() => scrollActiveVerseIntoView())
  }
)

watch(bibleChapter, () => {
  getAllChapterVerses()
  // console.log(bibleChapter.value)
})

watch(
  () => props.slide,
  () => {
    getSongOrHymnObj()
  },
  { immediate: true }
)

// Return bible verses in proximity to currentVerse
// const nearBibleVerses = computed(() => {
//   if (props.slide?.type === slideTypes.bible) {
//     const verseLineup: Scripture[] = []
//     const currentVerse = Number(props.verse?.split(":")?.[1])
//     const verseNumbers = getNumberRange(currentVerse)

//     verseNumbers?.forEach((n) => {
//       if (allChapterVerses.value?.[n]) {
//         verseLineup.push(allChapterVerses.value?.[n])
//       }
//     })

//     return verseLineup
//   }
//   return []
// })

const getNumberRange = (number: number, rangeBound = 20) => {
  const lowerRange = []
  const higherRange = []

  if (number <= rangeBound) {
    for (let i = 1; i <= number; i++) {
      lowerRange.push(i)
    }
  } else {
    for (let i = number - 9; i < number; i++) {
      lowerRange.push(i)
    }
  }

  for (let i = number + 1; i <= number + rangeBound; i++) {
    higherRange.push(i)
  }

  const range = new Set(
    [...lowerRange, number, ...higherRange]?.filter((n) => n !== 0)
  )

  return Array.from(range)
}
</script>
