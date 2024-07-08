<template>
  <div
    class="verse-preview absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 py-2 overflow-auto shadow-lg rounded-b-md"
  >
    <!-- <div class="border border-primary"></div> -->
    <UButton
      block
      variant="ghost"
      v-show="
        slide?.type === slideTypes.bible
          ? verseTemp?.scripture.trim()
          : verseTemp?.trim()
      "
      v-for="(verseTemp, index) in slide?.type === slideTypes.bible
        ? allChapterVerses
        : relatedData?.verses"
      :key="`verse-${index}`"
      class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-300 dark:hover:bg-primary-900 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
      :class="{
        'bg-primary-300 dark:bg-primary-900':
          slide?.type === slideTypes.bible
            ? `${bibleChapter}:${verseTemp?.verse}` === verse
            : `Verse ${index + 1}` === verse,
      }"
      @click="
        $emit(
          'goto-verse',
          slide?.type === slideTypes.bible
            ? `${bibleChapter}:${verseTemp?.verse}`
            : `Verse ${index + 1}`
        )
      "
    >
      <div class="flex-initial min-w-[8ch] text-xs font-semibold">
        {{
          slide?.type === slideTypes.bible
            ? `${bibleChapter?.substring(bibleChapter?.lastIndexOf(" "))}:${
                verseTemp?.verse
              }`
            : `Verse ${index + 1}`
        }}
      </div>
      <div class="flex-initial w-[100%] text-xs">
        {{
          slide?.type === slideTypes.bible ? verseTemp?.scripture : verseTemp
        }}
      </div>
    </UButton>
  </div>
</template>
<script setup lang="ts">
import type { Scripture, Slide } from "~/types"

const props = defineProps<{
  slide: Slide
  verse: string
}>()

const allChapterVerses = ref<any[]>()
const relatedData = ref<any>({})
const bibleChapter = computed(() => props.verse?.split(":")?.[0])

const getAllChapterVerses = async () => {
  const chapter = await useScriptureChapter(props.verse)
  allChapterVerses.value = chapter?.content
}

// Return connected Hymn / Song object related
const getSongOrHymnObj = async () => {
  switch (props.slide?.type) {
    case slideTypes.hymn:
      const hymn = await useHymn(props.slide?.songId)
      relatedData.value = hymn
      break
    case slideTypes.song:
      console.log(props.slide)
      const song = await useSong(props.slide?.data || props.slide?.songId, 4)
      relatedData.value = song
      break
  }
}

onMounted(() => {
  if (props.verse?.includes(":")) {
    getAllChapterVerses()
  }
})

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
