<template>
  <!-- GRID TYPE CARD -->
  <div
    v-if="gridType"
    class="slide-card gap-3 h-[120px] rounded-md bg-primary hover:bg-primary-700 transition-all cursor-pointer relative overflow-hidden"
    :id="slide?.id?.replace(/\d+/g, '')"
    :class="[
      selected ? 'border-black' : 'border-transparent',
      { selectable: selectable },
    ]"
  >
    <button
      :class="['transition-all', { 'opacity-70 ': selectable }]"
      @click="$emit('click')"
    >
      <div class="slide-preview text-white overflow-hidden md-preview">
        <LiveContentWithBackground
          :slide="slide"
          :slide-label="slide?.name"
          :slide-styles="currentState.settings.slideStyles"
        />
      </div>
      <div
        class="overlay-gradient absolute inset-0"
        :class="{ 'border-4 border-primary': selected }"
      ></div>
      <div
        class="texts flex items-center gap-2 text-white absolute top-1 right-2 left-2"
      >
        <h4 class="font-medium ws-nowrap mt-1 text-left text-xs">
          {{ useShortSlideName(slide) }}
        </h4>
        <SlideChip :slide-type="slide?.type" class="mt-1" dark-mode />
      </div>
    </button>

    <!-- DELETE AND DUPLICATE SLIDE BUTTON -->
    <div class="actions absolute bottom-2 right-2 flex gap-1">
      <UTooltip
        v-if="slide.type === slideTypes.text || slide.type === slideTypes.bible"
        text="Duplicate Slide"
      >
        <UButton
          icon="i-bx-copy"
          size="xs"
          variant="ghost"
          class="px-1.5 text-white hover:bg-primary-500"
          @click.stop.prevent="$emit('duplicate')"
        >
        </UButton>
      </UTooltip>

      <ConfirmDialog
        v-if="
          slide?.type === slideTypes.text ||
          slide?.type === slideTypes.media ||
          slide?.type === slideTypes.hymn ||
          slide?.type === slideTypes.song
        "
        button-icon="i-bx-save"
        :header="
          slide?.type === slideTypes.hymn
            ? 'Save Hymn as Song'
            : 'Save to Library'
        "
        button-styles="px-1.5 text-white hover:bg-primary"
        :label="
          slide?.type === slideTypes.hymn
            ? 'You are about to save this hymn as a song for easy update, song slide benefits and future access. Continue?'
            : 'You are about to save this slide to your library for quick and easy access in the future. Continue?'
        "
        @confirm="$emit('save-slide', slide?.id)"
      >
      </ConfirmDialog>

      <ConfirmDialog
        button-icon="i-tabler-trash"
        header="Delete slide"
        button-styles="px-1.5 text-white hover:bg-primary"
        label="Are you sure you want to delete this slide? This action is not reversible"
        @confirm="useGlobalEmit(appWideActions.deleteSlide, slide)"
      >
      </ConfirmDialog>
    </div>
    <div
      v-if="selectable"
      class="selectable-actions absolute bottom-4 right-3 flex gap-1"
    >
      <UCheckbox
        name="select"
        :model-value="checkboxSelected"
        :ui="{ base: 'h-8 w-8' }"
        @change="$emit('bulk-selected', $event)"
      />
    </div>
  </div>
  <button
    v-else
    class="group slide-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-primary-950 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900 transition-all cursor-pointer relative"
    :id="slide?.id"
    @click="appStore.setLiveSlide(slide?.id || '0')"
  >
    <div
      class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
    >
      <LiveContentWithBackground
        :slide="slide"
        :slide-label="slide?.name"
        :slide-styles="currentState.settings.slideStyles"
      />
    </div>
    <div class="texts flex-col justify-between">
      <h4 class="font-medium mt-2">{{ slide?.name }}</h4>
      <SlideChip :slide-type="slide?.type" class="mt-1" />
    </div>
    <!-- DELETE SLIDE BUTTON -->
    <div class="actions absolute bottom-2 right-2 flex gap-1">
      <UTooltip text="Preview/Edit Slide" :popper="{ placement: 'top' }">
        <UButton
          icon="i-bx-edit"
          size="xs"
          variant="ghost"
          class="px-1 text-primary-500 hover:bg-primary-white"
          @click.stop.prevent="
            useGlobalEmit(appWideActions.newActiveSlide, slide)
          "
        />
      </UTooltip>
    </div>
  </button>
</template>

<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const props = defineProps<{
  slide: Slide
  live: boolean
  gridType: boolean
  selected: boolean
  selectable: boolean
  checkboxSelected: boolean
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
