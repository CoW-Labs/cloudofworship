<template>
  <div
    class="verse-preview behavior-smooth absolute bg-primary-100 dark:bg-primary-800 right-0 left-0 top-12 z-20 py-2 overflow-auto shadow-lg rounded-b-md"
  >
    <div class="grid grid-cols-3 2xl:grid-cols-5 gap-2 p-2">
      <button
        v-for="obj in slide.presentationObjects"
        :key="obj.page"
        class="relative rounded overflow-hidden border-2 transition-colors focus:outline-none"
        :class="
          obj.page === (slide.presentationPageIndex ?? 0) + 1
            ? 'border-primary-500'
            : 'border-transparent hover:border-primary-300 dark:hover:border-primary-600'
        "
        @click="$emit('goto-page', obj.page)"
      >
        <img
          :src="obj.imageUrl"
          :alt="`Page ${obj.page}`"
          class="w-full aspect-video object-cover bg-black"
        />
        <span
          class="absolute bottom-0 left-0 right-0 text-center text-[10px] font-semibold py-0.5 bg-primary/70 text-white"
        >
          {{ obj.page }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

defineProps<{
  slide: Slide
}>()

defineEmits<{
  "goto-page": [page: number]
}>()
</script>
