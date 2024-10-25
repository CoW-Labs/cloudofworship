<template>
  <button
    class="group slide-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-primary-950 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900 transition-all cursor-pointer relative"
    :id="slide?.id"
    @click="
      useGlobalEmit(`new-${slide?.type}`, [
        slide?.type === slideTypes.media
          ? {
              ...slide?.data,
              url: slide.background,
              fromSaved: true,
              scheduleId: currentState?.activeSchedule?._id,
            }
          : {
              ...slide,
              fromSaved: true,
              scheduleId: currentState?.activeSchedule?._id,
            },
      ])
    "
  >
    <div
      class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
    >
      <LiveContentWithBackground
        :slide="slide"
        :slide-label="slide?.name"
        :slide-styles="currentState?.settings?.slideStyles"
      />
    </div>
    <div class="texts flex-col justify-between">
      <h4 class="font-medium mt-2 break-all">{{ slide?.name }}</h4>
      <SlideChip :slide-type="slide?.type" class="mt-1" />
    </div>
    <!-- DELETE SLIDE BUTTON -->
    <div class="actions absolute bottom-2 right-2 flex gap-1">
      <ConfirmDialog
        button-icon="i-tabler-trash"
        button-styles="px-1 text-xs text-red-500 hover:bg-primary-white"
        button-size="xs"
        header="Delete slide"
        label="Are you sure you want to delete this slide from your library? This action is not reversible"
        @confirm="$emit('delete-slide', slide?.id)"
      >
      </ConfirmDialog>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const emit = defineEmits(["delete-slide"])

const props = defineProps<{
  slide: Slide
  selected: boolean
}>()
</script>

<style scoped>
.slide-card .actions {
  visibility: hidden;
  opacity: 0;
  transform: translateX(10px);
  transition: 0.3s;
}

.slide-card:hover .actions {
  visibility: visible;
  opacity: 1;
  transform: translateX(0);
}

.slide-card.selectable .actions {
  display: none;
}
</style>
