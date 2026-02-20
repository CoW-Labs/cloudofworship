<template>
  <div
    ref="versesPreview"
    class="verse-preview behavior-smooth absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 py-2 overflow-auto shadow-lg rounded-b-md"
  >
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
            item.type === 'chorus' ? verse === 'Chorus' : `Verse ${item.verseNum}` === verse,
        }"
        @click="$emit('goto-verse', item.type === 'chorus' ? 'Chorus' : `Verse ${item.verseNum}`)"
      >
        <div class="flex-initial min-w-[8ch] text-xs font-semibold">
          {{ item.type === 'chorus' ? 'Chorus' : `Verse ${item.verseNum}` }}
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
        :id="convertStringToSlug(verse).replace(/\d+/g, '')"
        class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
        :class="{
          'bg-primary-300 dark:bg-primary-900': `Verse ${index + 1}` === verse,
        }"
        @click="$emit('goto-verse', `Verse ${index + 1}`)"
      >
        <div class="flex-initial min-w-[8ch] text-xs font-semibold">
          {{ `Verse ${index + 1}` }}
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
import type { Scripture, Slide, BibleVerse, Song } from "~/types"

const props = defineProps<{
  slide: Slide
  verse: string
}>()

const allChapterVerses = ref<BibleVerse[]>()
const relatedData = ref<any>({})
const bibleChapter = computed(() => props.verse?.split(":")?.[0])
const versesPreview = ref<HTMLDivElement | null>(null)

// Build hymn verses list with chorus after Verse 1
const hymnVersesWithChorus = computed(() => {
  const items: { type: 'verse' | 'chorus'; content: string; verseNum: number }[] = []
  const verses = relatedData.value?.verses || []
  const chorus = relatedData.value?.chorus
  const hasChorus = props.slide?.hasChorus && chorus && chorus !== "false"

  verses.forEach((verse: string, index: number) => {
    items.push({ type: 'verse', content: verse, verseNum: index + 1 })
    // Add chorus after Verse 1
    if (index === 0 && hasChorus) {
      items.push({ type: 'chorus', content: chorus, verseNum: 0 })
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
  }
}

onMounted(() => {
  if (props.verse?.includes(":")) {
    getAllChapterVerses()
  }
})

watch(
  () => props.slide,
  (newVal, oldVal) => {
    // console.log("slide updated")
    setTimeout(() => {
      // Scroll down to selected verse
      const activeVerse =
        props.slide.type === slideTypes.bible
          ? versesPreview.value?.querySelector(
              `#${convertStringToSlug(props.verse)}`
            )
          : versesPreview.value?.querySelector(
              `#${props.verse?.replace(" ", "-")?.toLowerCase()}`
            )
      activeVerse?.scrollIntoView()
    }, 100)
  },
  { deep: true, immediate: true }
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

const convertStringToSlug = (str: string) => {
  return str
    .toLowerCase()
    .replaceAll("1 ", "one-")
    .replaceAll("2 ", "two-")
    .replaceAll("3 ", "three-")
    .replaceAll(" ", "-")
    .replaceAll(":", "-")
}

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
