<template>
  <span class="transcript-text">
    <template v-for="(part, index) in parsedParts" :key="index">
      <!-- Regular text -->
      <span v-if="part.type === 'text'">{{ part.content }}</span>
      
      <!-- Bible reference (clickable) -->
      <button
        v-else-if="part.type === 'reference'"
        class="bible-reference inline-flex items-center gap-0.5 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2 decoration-1 decoration-primary-400 dark:decoration-primary-500 font-medium transition-colors cursor-pointer"
        @click="$emit('referenceClick', part.reference)"
      >
        <UIcon name="i-bx-bible" class="text-xs" />
        {{ part.reference.displayLabel }}
      </button>
    </template>
  </span>
</template>

<script setup lang="ts">
import type { BibleReference } from '~/types/transcript'

interface TextPart {
  type: 'text'
  content: string
}

interface ReferencePart {
  type: 'reference'
  reference: BibleReference
}

type ParsedPart = TextPart | ReferencePart

const props = defineProps<{
  text: string
  bibleReferences: BibleReference[]
}>()

defineEmits<{
  referenceClick: [reference: BibleReference]
}>()

/**
 * Parse the text and split it into regular text and Bible reference parts
 */
const parsedParts = computed<ParsedPart[]>(() => {
  if (!props.bibleReferences || props.bibleReferences.length === 0) {
    return [{ type: 'text', content: props.text }]
  }

  const parts: ParsedPart[] = []
  let lastIndex = 0

  // Sort references by startIndex to process in order
  const sortedRefs = [...props.bibleReferences].sort((a, b) => a.startIndex - b.startIndex)

  for (const ref of sortedRefs) {
    // Add text before this reference
    if (ref.startIndex > lastIndex) {
      parts.push({
        type: 'text',
        content: props.text.slice(lastIndex, ref.startIndex),
      })
    }

    // Add the reference
    parts.push({
      type: 'reference',
      reference: ref,
    })

    lastIndex = ref.endIndex
  }

  // Add any remaining text after the last reference
  if (lastIndex < props.text.length) {
    parts.push({
      type: 'text',
      content: props.text.slice(lastIndex),
    })
  }

  return parts
})
</script>

<style scoped>
.bible-reference:hover {
  text-decoration-thickness: 2px;
}
</style>
