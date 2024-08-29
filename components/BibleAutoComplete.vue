<template>
  <div
    ref="booksPreview"
    class="books-preview behavior-smooth absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 py-2 overflow-auto shadow-lg rounded-b-md"
  >
    <div class="info px-4 py-3 bg-primary-300 dark:bg-primary-500">
      <div
        class="rounded-lg p-3 bg-primary-100 dark:bg-primary-900 flex items-center gap-2"
      >
        <IconWrapper name="i-bx-bulb" size="6" color="red" />
        <div class="info flex items-center">
          Use
          <div class="hotkey">Tab</div>
          or
          <div class="hotkey">
            <UIcon name="i-mdi-arrow-right" size="xl" />
          </div>
          select books and add colon (:) separator for verses.
        </div>
      </div>
      <div
        v-if="!verse"
        class="rounded-lg p-3 bg-primary-100 dark:bg-primary-900 flex items-center gap-2 mt-2"
      >
        <IconWrapper name="i-bx-info-circle" size="6" color="red" />
        <div class="info flex items-center">
          Start typing to search for books.
        </div>
      </div>
    </div>
    <UButton
      block
      variant="ghost"
      v-for="book in bookOptions"
      :key="book"
      class="item rounded-none flex px-4 py-3 justify-start border-t border-primary-200 dark:border-primary-950 hover:bg-primary-200 dark:hover:bg-primary-600 cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
      :class="{
        'bg-primary-300 dark:bg-primary-900': activeBook === book,
      }"
      @click="$emit('goto-book', book)"
    >
      <div class="flex-initial min-w-[8ch] text-xs font-semibold">
        {{ book }}
      </div>
    </UButton>
  </div>
</template>
<script setup lang="ts">
import fuzzysort from "fuzzysort"
import { useAppStore } from "~/store/app"
import type { Scripture, Slide } from "~/types"

const props = defineProps<{
  verse: string
}>()

const emit = defineEmits(["book-options", "goto-book"])

const bookOptions = ref<any[]>()
const activeBook = ref<string>()
const relatedData = ref<any>({})

// const versesPreview = ref<HTMLDivElement | null>(null)

// const getAllChapterVerses = async () => {
//   const chapter = await useScriptureChapter(props.verse)
//   allChapterVerses.value = chapter?.content
// }

watch(
  () => props.verse,
  () => {
    let results: string[] = fuzzysort.go(props.verse, bibleBooks)
    results = results?.map((result) => result.target).slice(0, 6)
    results.sort()
    // sort by showing string without numbers first
    results.sort((a, b) => {
      if (a.includes(" ") && !b.includes(" ")) {
        return 1
      } else if (!a.includes(" ") && b.includes(" ")) {
        return -1
      } else {
        return 0
      }
    })
    bookOptions.value = results
    emit("book-options", results)
  }
)
</script>
