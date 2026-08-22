<template>
  <div
    class="verse-switch button-group ml-2 bg-white dark:bg-[#171d2b] rounded-full flex items-center gap-1 h-[34px] px-1 relative text-gray-700 dark:text-[#d5dae3]"
  >
    <CowTooltip text="Previous verse" :shortcut="shortcutIds.previousVerse">
      <UButton
        variant="ghost"
        color="gray"
        class="p-1 rounded-full text-gray-500 dark:text-[#7d8695]"
        icon="i-bx-chevron-left"
        @click="$emit('previous-verse')"
      />
    </CowTooltip>
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <UInput
      placeholder="Verse"
      size="xs"
      variant="none"
      id="bible-verse-input"
      :model-value="modelValue"
      autocomplete="off"
      :inputClass="`bg-transparent border-0 shadow-none outline-none text-center text-gray-800 dark:text-white transition-all ${
        modelValue?.length > 20 ? 'px-1' : ''
      }`"
      :style="`width: ${
        slide?.type === slideTypes.bible
          ? (modelValue?.replaceAll(' ', '').length || 10) + 3
          : (modelValue?.length || 10) + 2
      }ch`"
      @update:model-value="$emit('update:modelValue', $event)"
      @focus=";($event.target as HTMLInputElement).select()"
      @keydown.tab.prevent="$emit('predict', $event.target)"
      @keydown.arrow-right.prevent="$emit('predict', $event.target)"
      @keydown.enter="
        $emit('goto-verse')
        ;($event.target as HTMLInputElement).blur()
      "
      @keydown="
        (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault()
            $emit('take-live')
          }
        }
      "
    />
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <CowTooltip text="Next verse" :shortcut="shortcutIds.nextVerse">
      <UButton
        variant="ghost"
        color="gray"
        class="p-1 rounded-full text-gray-500 dark:text-[#7d8695]"
        icon="i-bx-chevron-right"
        @click="$emit('next-verse')"
      />
    </CowTooltip>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

defineProps<{
  // Current verse label (e.g. "John 3:16"). The parent owns this state since
  // it's shared with sibling pickers (GotoScripture, PreviewVerses, BibleAutoComplete).
  modelValue: string
  // Only read for the input's width formula (Bible refs vs song/hymn verse labels).
  slide?: Slide
}>()

defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "previous-verse"): void
  (e: "next-verse"): void
  (e: "goto-verse"): void
  (e: "take-live"): void
  (e: "predict", target: EventTarget | null): void
}>()
</script>
