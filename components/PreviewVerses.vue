<template>
  <div
    ref="versesPreview"
    class="verse-preview behavior-smooth absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 py-2 overflow-auto shadow-lg rounded-b-md"
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
      :id="
        slide?.type === slideTypes.bible
          ? convertStringToSlug(`${bibleChapter + '-' + verseTemp?.verse}`)
          : convertStringToSlug(verse).replace(/\d+/g, '')
      "
      class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
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
import { useAppStore } from "~/store/app"
import type { Scripture, Slide } from "~/types"

const props = defineProps<{
  slide: Slide
  verse: string
}>()

const allChapterVerses = ref<any[]>()
const relatedData = ref<any>({})
const bibleChapter = computed(() => props.verse?.split(":")?.[0])
const versesPreview = ref<HTMLDivElement | null>(null)

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
      // console.log(props.slide)
      const song = await useSong(props.slide?.data || props.slide?.songId)
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
