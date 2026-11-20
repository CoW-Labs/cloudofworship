<template>
  <div
    class="slide-card group relative border-t first:border-t-0 border-white/80 dark:border-[#171d2b]"
    :id="slide?.id"
    @mouseenter="$emit('hover')"
  >
    <button
      class="flex items-center gap-3 w-[100%] text-left cursor-pointer transition-colors px-3 py-2 hover:bg-white/55 dark:hover:bg-[#2b3242]/60"
      :class="{ 'bg-white/70 dark:bg-[#2b3242]/70': active }"
      @click="addSlide"
    >
      <div class="shrink-0">
        <DeferredSlidePreview
          preview-class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative rounded-md ring-1 ring-black/5 dark:ring-white/10"
          :slide="slide"
          :slide-styles="currentState?.settings?.slideStyles"
        />
      </div>
      <div class="texts min-w-0 flex-1">
        <h4
          class="truncate font-medium text-sm text-gray-800 dark:text-[#a7afbd]"
        >
          <span
            v-if="highlightQuery"
            v-html="highlightText(slide?.name || '', highlightQuery)"
          />
          <template v-else>{{ slide?.name }}</template>
        </h4>
        <SlideChip :slide-type="slide?.type" class="mt-1" />
      </div>
    </button>

    <div
      class="actions flex items-center absolute right-2 bottom-1"
    >
      <UIcon
        v-if="pinned"
        name="i-ph-push-pin-fill"
        class="w-3.5 h-3.5 mr-1 text-gray-400 dark:text-[#7d8695]"
      />
      <MoreActionsMenu v-slot="{ close }" flush>
        <UButton
          variant="ghost"
          color="gray"
          block
          @click="
            () => {
              $emit('toggle-pin', slide?.id)
              close()
            }
          "
        >
          <template #leading>
            <UIcon
              :name="pinned ? 'i-ph-push-pin-slash' : 'i-ph-push-pin'"
              class="w-4 h-4"
            />
          </template>
          {{ pinned ? "Unpin" : "Pin to top" }}
        </UButton>
        <ConfirmDialog
          button-label="Delete"
          button-icon="i-ph-trash"
          button-color="red"
          button-variant="ghost"
          no-tooltip
          header="Delete slide"
          button-styles="more-item-danger"
          label="Are you sure you want to delete this slide from your library? This action is not reversible"
          @confirm="
            () => {
              $emit('delete-slide', slide?.id)
              close()
            }
          "
        >
          <template #icon><DeleteIcon class="w-4 h-4" /></template>
        </ConfirmDialog>
      </MoreActionsMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const props = defineProps<{
  slide: Slide
  truncate?: Boolean
  active?: boolean
  pinned?: boolean
  highlightQuery?: string
}>()

defineEmits(["delete-slide", "hover", "toggle-pin"])

const addSlide = () => {
  const slide = props.slide
  useGlobalEmit(`new-${slide?.type}`, [
    slide?.type === slideTypes.media
      ? {
          ...slide?.data,
          url: slide.background,
          fromSaved: true,
          scheduleId: currentState.value?.activeSchedule?._id,
        }
      : {
          ...slide,
          fromSaved: true,
          scheduleId: currentState.value?.activeSchedule?._id,
        },
  ])
}
</script>
