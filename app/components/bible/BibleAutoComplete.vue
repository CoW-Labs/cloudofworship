<template>
  <div
    ref="booksPreview"
    class="books-preview behavior-smooth absolute bg-white dark:bg-[#222938] right-0 left-0 top-[46px] z-40 overflow-auto shadow-lg rounded-b-2xl"
  >
    <div class="flex flex-col gap-2 px-4 py-3">
      <Hint>
        <div class="flex items-center">
          Use <span class="hotkey">Tab</span> or
          <span class="hotkey">
            <UIcon name="i-mdi-arrow-right" class="h-3 w-3" />
          </span>
          to select books, and add a colon (:) separator for verses.
        </div>
      </Hint>
      <Hint v-if="!verse">
        <template #icon>
          <InfoIcon class="h-8 w-8 text-gray-900 dark:text-[#F8F9FB]" />
        </template>
        Start typing to search for books.
      </Hint>
    </div>
    <UButton
      block
      variant="ghost"
      v-for="book in bookOptions"
      :key="book"
      class="item rounded-none flex px-5 py-3 justify-start border-t border-gray-100 dark:border-[#2b3344] hover:bg-gray-100 dark:hover:bg-[#2b3344] cursor-pointer w-[100%] text-left items-start font-normal text-black dark:text-white"
      :class="{
        'bg-gray-100 dark:bg-[#2b3344]': activeBook === book,
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

const props = defineProps<{
  verse: string
}>()

const emit = defineEmits(["book-options", "goto-book"])

const bookOptions = ref<any[]>()
const activeBook = ref<string>()

watch(
  () => props.verse,
  () => {
    let results: any | Fuzzysort.Result[] = fuzzysort.go(
      props.verse,
      bibleBooks
    )
    results = results
      ?.map((result: Fuzzysort.Result | any) => result.target)
      .slice(0, 6)
    // sort by showing string without numbers first
    results.sort((a: string, b: string) => {
      if (a?.includes(" ") && !b?.includes(" ")) {
        return 1
      } else if (!a?.includes(" ") && b?.includes(" ")) {
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
