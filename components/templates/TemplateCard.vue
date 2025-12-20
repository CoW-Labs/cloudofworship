<template>
  <button
    class="group template-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-primary-950 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900 transition-all cursor-pointer relative"
    @click="$emit('use-template', template)"
  >
    <!-- TEMPLATE PREVIEW -->
    <div
      class="template-preview w-28 min-w-28 h-20 text-white overflow-hidden sm-preview relative rounded"
    >
      <LiveContentWithBackground
        v-if="slideData"
        :slide="slideData"
        :slide-styles="currentState?.settings?.slideStyles"
      />
      <div
        v-else
        class="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center"
      >
        <IconWrapper name="i-bx-slideshow" size="8" class="text-white/50" />
      </div>
    </div>

    <!-- TEMPLATE INFO -->
    <div class="flex-1 flex flex-col justify-between py-1">
      <div>
        <h4 class="font-semibold text-sm line-clamp-1">
          {{ template.name }}
        </h4>
        <p
          v-if="template.description"
          class="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-1"
        >
          {{ template.description }}
        </p>
      </div>
      <div class="flex items-center gap-2 mt-1">
        <SlideChip
          v-if="slideData"
          :slide-type="slideData.type"
          class="text-[10px]"
        />
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 capitalize"
        >
          {{ template.category }}
        </span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { Template, Slide } from "~/types"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const props = defineProps<{
  template: Template
}>()

defineEmits(["use-template"])

// Extract slide data from template
const slideData = computed(() => {
  if (typeof props.template.slideId === "object") {
    return props.template.slideId as Slide
  }
  return null
})
</script>
