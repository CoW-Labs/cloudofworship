<template>
  <button
    class="action-card flex gap-3 p-2 py-4 border-t first:border-t-0 border-gray-100 dark:border-primary-950 hover:rounded-md hover:bg-primary-50 dark:hover:bg-primary-800 transition-all cursor-pointer text-left w-[100%]"
    :class="{ 'pointer-events-none opacity-30': action?.unreleased }"
    @click="
      useGlobalEmit(
        `${action?.action}${actionSuffix ? `-${actionSuffix}` : ''}`,
        emitParameter
      )
    "
  >
    <IconWrapper
      :name="action?.icon"
      class="mt-1 text-primary dark:text-primary-300"
      rounded-bg
    />
    <div class="texts">
      <h4 v-if="action?.searchableOnly">
        <span class="font-light italic pr-1 capitalize">
          {{ action?.type || "Action" }}:
        </span>
        <span class="font-semibold">
          {{ action?.name || "" }}
          <span v-if="action?.type === slideTypes.bible">{{
            action?.bibleChapterAndVerse || ""
          }}</span>
        </span>
      </h4>
      <h4 v-else class="font-semibold">
        {{ action?.name || "" }}
      </h4>
      <p class="font-light text-xs mt-1">{{ action?.desc || "" }}</p>
    </div>
  </button>
</template>
<script setup lang="ts">
import type { QuickAction } from "~/types"

const props = defineProps<{
  action: QuickAction
  actionSuffix: String
}>()

const emitParameter = computed(() => {
  switch (props.action?.type) {
    case slideTypes.bible:
      return props.action?.bibleChapterAndVerse
        ? `${props.action?.bibleBookIndex}:${props.action?.bibleChapterAndVerse}`
        : ""
    case slideTypes.hymn:
      return `${props.action?.hymnIndex}`
    default:
      return ""
  }
})
</script>

<style scoped></style>
