<template>
  <!-- GRID TYPE CARD -->
  <div
    v-if="gridType"
    class="slide-card gap-3 h-[120px] rounded-lg bg-primary hover:bg-primary-700 transition-all cursor-pointer relative overflow-hidden"
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
      <DeferredSlidePreview
        preview-class="slide-preview text-white overflow-hidden md-preview"
        :slide="slide"
        :slide-label="slide?.name"
        :slide-styles="currentState.settings.slideStyles"
        :eager="selected"
      />
      <div
        class="overlay-gradient absolute inset-0"
        :class="{ 'border-4 border-primary': selected }"
      ></div>
      <div
        class="texts flex items-start gap-2 text-white absolute top-1 right-2 left-2"
      >
        <h4 class="font-medium ws-nowrap mt-2 text-left text-xs">
          {{ useShortSlideName(slide) }}
        </h4>
        <SlideChip
          :slide-type="slide?.type"
          :slide-mode="slide?.slideMode"
          class="mt-1"
          dark-mode
        />
      </div>

      <!-- Editing indicator - avatar circle -->
      <div v-if="editingBy" class="absolute bottom-2 left-2 group/editing">
        <UTooltip
          :text="`${editingBy.userName} is on this slide`"
          :popper="{ placement: 'top' }"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white shadow-lg animate-pulse"
            :style="{
              backgroundColor: editingBy.theme || '#f59e0b',
            }"
          >
            <img
              v-if="editingBy.avatar"
              :src="editingBy.avatar"
              :alt="editingBy.userName"
              class="w-full h-full rounded-full object-cover"
            />
            <span v-else>{{
              editingBy.userName?.charAt(0)?.toUpperCase() || "?"
            }}</span>
          </div>
        </UTooltip>
      </div>
    </button>

    <!-- Bottom gradient for action icon contrast -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg"
    ></div>

    <!-- SLIDE ACTIONS MENU -->
    <div
      class="actions absolute bottom-2 right-2 flex gap-1"
      :class="{ 'menu-open': actionsMenuOpen }"
    >
      <MoreActionsMenu
        v-slot="{ close }"
        flush
        trigger-class="rounded-full hover:!bg-white/10"
        icon-class="text-white"
        @update:open="actionsMenuOpen = $event"
      >
        <UButton
          v-if="
            slide.slideMode !== 'overlay' &&
            (slide.type === slideTypes.text || slide.type === slideTypes.bible)
          "
          variant="ghost"
          color="gray"
          block
          @click.stop.prevent="
            () => {
              $emit('duplicate', slide)
              close()
            }
          "
        >
          <template #leading><CopyIcon class="w-4 h-4" /></template>
          Duplicate Slide
        </UButton>

        <UButton
          v-if="canDuplicateAsOverlay"
          variant="ghost"
          color="gray"
          block
          @click.stop.prevent="
            () => {
              $emit('duplicate-as-overlay', slide)
              close()
            }
          "
        >
          <template #leading><StackSimpleIcon class="w-4 h-4" /></template>
          Duplicate as Overlay
        </UButton>

        <ConfirmDialog
          v-if="
            slide?.slideMode !== 'overlay' &&
            (slide?.type === slideTypes.text ||
              slide?.type === slideTypes.media ||
              slide?.type === slideTypes.hymn ||
              slide?.type === slideTypes.song)
          "
          button-icon="i-bx-save"
          no-tooltip
          button-variant="ghost"
          button-color="gray"
          :button-label="
            slide?.type === slideTypes.hymn
              ? 'Save Hymn as Song'
              : 'Save to Library'
          "
          :header="
            slide?.type === slideTypes.hymn
              ? 'Save Hymn as Song'
              : 'Save to Library'
          "
          button-styles=""
          :label="
            slide?.type === slideTypes.hymn
              ? 'You are about to save this hymn as a song for easy update, song slide benefits and future access. Continue?'
              : 'You are about to save this slide to your library for quick and easy access in the future. Continue?'
          "
          @confirm="
            () => {
              handleSaveConfirm()
              close()
            }
          "
        >
          <template #icon><SaveIcon class="w-4 h-4" /></template>
        </ConfirmDialog>

        <UButton
          v-if="
            (slide?.type === slideTypes.text ||
              slide?.type === slideTypes.media ||
              slide?.type === slideTypes.bible) &&
            slide?.slideMode !== 'overlay' &&
            authStore.user?.role === 'superadmin'
          "
          variant="ghost"
          color="gray"
          block
          @click.stop.prevent="
            () => {
              handleSaveAsTemplateClick()
              close()
            }
          "
        >
          <template #leading><TemplatesIcon class="w-4 h-4" /></template>
          Save as Template
        </UButton>

        <ConfirmDialog
          button-icon="i-tabler-trash"
          no-tooltip
          button-variant="ghost"
          button-color="red"
          button-label="Delete Slide"
          header="Delete slide"
          button-styles="more-item-danger"
          label="Are you sure you want to delete this slide? This action is not reversible"
          @confirm="
            () => {
              useGlobalEmit(appWideActions.deleteSlide, slide)
              close()
            }
          "
        >
          <template #icon><DeleteIcon class="w-4 h-4" /></template>
        </ConfirmDialog>
      </MoreActionsMenu>
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
    class="group slide-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-[#171d2b] rounded-lg hover:bg-white dark:hover:bg-[#2b3242] transition-all cursor-pointer relative"
    :id="slide?.id"
    @click="
      slide?.slideMode === 'overlay'
        ? handleOverlayAction()
        : goLive(slide?.id || '0')
    "
  >
    <DeferredSlidePreview
      preview-class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
      :slide="slide"
      :slide-label="slide?.name"
      :slide-styles="currentState.settings.slideStyles"
    />
    <div class="texts flex-col justify-between">
      <h4 class="font-medium mt-2">{{ slide?.name }}</h4>
      <SlideChip
        :slide-type="slide?.type"
        :slide-mode="slide?.slideMode"
        class="mt-1"
      />
    </div>
    <!-- DELETE SLIDE BUTTON -->
    <div class="actions absolute bottom-2 right-2 flex gap-1">
      <UTooltip text="Preview/Edit Slide" :popper="{ placement: 'top' }">
        <UButton
          size="xs"
          variant="ghost"
          class="px-1 text-primary-500 hover:bg-primary-white"
          @click.stop.prevent="
            useGlobalEmit(appWideActions.newActiveSlide, slide)
          "
        >
          <template #leading><EditIcon class="w-4 h-4" /></template>
        </UButton>
      </UTooltip>
    </div>
  </button>
</template>

<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)

// Subscription check
const { hasAccessToFeature } = useSubscription()

const props = defineProps<{
  slide: Slide
  live: boolean
  gridType: boolean
  selected: boolean
  selectable: boolean
  checkboxSelected: boolean
  editingBy?: {
    userId: string
    userName: string
    avatar?: string
    theme?: string
  } | null // User currently editing this slide
}>()

const emit = defineEmits([
  "save-slide",
  "save-as-template",
  "duplicate",
  "duplicate-as-overlay",
  "show-overlay",
  "clear-overlay",
  "delete",
  "bulk-selected",
  "click",
])

const actionsMenuOpen = ref(false)

const isActiveOverlay = computed(
  () => currentState.value.activeOverlaySlide?.id === props.slide.id
)
const canDuplicateAsOverlay = computed(
  () =>
    props.slide.slideMode !== "overlay" &&
    (props.slide.type === slideTypes.time ||
      (props.slide.type === slideTypes.text &&
        [slideLayoutTypes.full_text, slideLayoutTypes.heading_sub].includes(
          props.slide.layout
        )))
)

const handleOverlayAction = () => {
  if (!hasAccessToFeature(appWideActions.showSlideOverlay)) {
    useGlobalEmit(appWideActions.showUpgradeModal)
    return
  }

  emit(isActiveOverlay.value ? "clear-overlay" : "show-overlay", props.slide)
}

const applyLiveSlide = (slideId: string) => {
  const slide = appStore.currentState.activeSlides.find(
    (activeSlide) => activeSlide.id === slideId || activeSlide._id === slideId
  )
  if (!slide) return
  if (slide.slideMode === "overlay") return

  useBroadcastPost(slide)
  appStore.setLiveSlide(slideId)
}

const goLive = (slideId: string) => {
  applyLiveSlide(slideId)
}

const handleSaveConfirm = () => {
  if (!hasAccessToFeature("new-library")) {
    useGlobalEmit("show-upgrade-modal")
    usePosthogCapture("UPGRADE_PROMPT_SHOWN", {
      feature: "My Library",
      location: "slide_card_save",
    })
  } else {
    emit("save-slide", props.slide?.id)
  }
}

const handleSaveAsTemplateClick = () => {
  if (!hasAccessToFeature("new-templates")) {
    useGlobalEmit("show-upgrade-modal")
    usePosthogCapture("UPGRADE_PROMPT_SHOWN", {
      feature: "Slide Templates",
      location: "slide_card_template",
    })
  } else {
    emit("save-as-template", props.slide)
  }
}
</script>

<style scoped>
.slide-card .actions {
  visibility: hidden;
  opacity: 0;
  transform: translateX(10px);
  transition: 0.3s;
}

.slide-card:hover .actions,
.slide-card .actions.menu-open {
  visibility: visible;
  opacity: 1;
  transform: translateX(0);
}

.slide-card.selectable .actions {
  display: none;
}

/* On touch devices, always show actions since hover doesn't exist */
@media (hover: none) {
  .slide-card .actions {
    visibility: visible;
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
