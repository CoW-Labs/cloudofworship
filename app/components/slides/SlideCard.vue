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
    @contextmenu.prevent="moreActionsMenuRef?.open()"
  >
    <CowTooltip
      :text="gridCardHint"
      :prevent="selectable"
      :open-delay="700"
      class="w-full h-full"
    >
      <button
        :class="[
          'w-full h-full transition-all text-left',
          { 'opacity-70 ': selectable },
        ]"
        @click="$emit('click')"
        @dblclick.prevent="$emit('take-live')"
      >
        <DeferredSlidePreview
          preview-class="slide-preview text-white overflow-hidden md-preview"
          :slide="slide"
          :slide-label="slide?.name"
          :slide-styles="currentState.settings.slideStyles"
          :eager="selected"
        />
        <!-- MEDIA STILL DOWNLOADING — the preview has nothing to draw until the
             bytes land on this device, so an untouched card is indistinguishable
             from an empty slide. Covering just the preview (the name and chip
             below are painted after it, so they stay readable) says "this
             thumbnail is still coming" rather than "this slide is empty". -->
        <USkeleton
          v-if="isMediaLoading"
          class="media-loading inset-0 rounded-lg"
          :ui="skeletonUi"
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
          <CowTooltip :text="`${editingBy.userName} is on this slide`">
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
          </CowTooltip>
        </div>
      </button>
    </CowTooltip>

    <!-- Bottom gradient for action icon contrast -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg"
    ></div>

    <!-- SLIDE ACTIONS MENU -->
    <div
      class="actions absolute bottom-2 right-2 flex gap-1"
      :class="{ 'menu-open': actionsMenuOpen }"
    >
      <SlideActionsMenu
        ref="moreActionsMenuRef"
        :slide="slide"
        trigger-class="rounded-full hover:!bg-white/10"
        icon-class="text-white"
        @update:open="actionsMenuOpen = $event"
        @duplicate="$emit('duplicate', $event)"
        @duplicate-as-overlay="$emit('duplicate-as-overlay', $event)"
        @save-slide="$emit('save-slide', $event)"
        @save-as-template="$emit('save-as-template', $event)"
      />
    </div>
    <div
      v-if="selectable"
      class="selectable-actions absolute bottom-4 right-3 flex gap-1"
    >
      <UCheckbox
        name="select"
        :model-value="checkboxSelected"
        :ui="{ base: 'h-6 w-6' }"
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
    <!-- Sits exactly over the thumbnail: the row's padding is p-2 and the
         preview is w-24 h-16, so no wrapper element is needed. -->
    <USkeleton
      v-if="isMediaLoading"
      class="media-loading left-2 top-2 h-16 w-24 rounded-md"
      :ui="skeletonUi"
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
      <CowTooltip text="Preview / edit slide">
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
      </CowTooltip>
    </div>
  </button>
</template>

<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

// Gates the overlay action below. The rest of the card's gating moved to
// SlideActionsMenu along with the actions it guards.
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
  "take-live",
])

// The preview grid and the schedule list both use double-click, but for
// opposite actions — spell out which is which so nobody has to discover it.
const gridCardHint = computed(() =>
  props.slide?.slideMode === "overlay"
    ? "Click to preview · Double-click to show overlay"
    : "Click to preview · Double-click to take live"
)

// Every cache key this card's preview depends on. A media slide's own file is
// stored under the slide id, a deck stores one key per page, and backgrounds
// store under their own key — which is usually the schedule-wide default, so a
// shared background pulls the whole list into the loading state together.
const { progressFor, transferFor } = useMediaDownloadProgress()

const mediaKeys = computed<string[]>(() => {
  const slide = props.slide
  if (!slide) return []
  const ownsFile =
    slide.type === slideTypes.media || slide.type === slideTypes.presentation
  return [
    ownsFile ? slide.id : null,
    ...(slide.presentationObjects || []).map(
      (page) => `${slide.id}-page-${page.page}`
    ),
    slide.backgroundImageKey,
    slide.backgroundVideoKey,
  ].filter((key): key is string => !!key)
})

// Percent for whichever key is busy, or null when none is. Covers both
// directions: a cloud download on this device, and a local save still writing
// on the device that added the file. A `failed` transfer is deliberately not
// loading — the editor owns that state, with its retry and remove actions.
const mediaProgress = computed<number | null>(() => {
  for (const key of mediaKeys.value) {
    const transfer = transferFor(key)
    if (transfer?.status === "pending") return transfer.progress * 100
    const download = progressFor(key)
    if (download !== null) return download
  }
  return null
})

const isMediaLoading = computed(() => mediaProgress.value !== null)

// Matches CowSkeleton, so a card waiting on its media reads the same as the
// placeholder cards the grid shows while a schedule loads. Position is left to
// each call site: the grid card covers itself, the list row only its thumbnail.
const skeletonUi = {
  base: "absolute overflow-hidden animate-pulse pointer-events-none",
  background: "bg-gray-300 dark:bg-gray-600/80",
  rounded: "rounded-md",
}

const actionsMenuOpen = ref(false)
const moreActionsMenuRef = ref<{ open: () => void; close: () => void } | null>(
  null
)

const isActiveOverlay = computed(
  () => currentState.value.activeOverlaySlide?.id === props.slide.id
)
const handleOverlayAction = () => {
  if (!hasAccessToFeature(appWideActions.showSlideOverlay)) {
    useGlobalEmit(appWideActions.showUpgradeModal)
    return
  }

  emit(isActiveOverlay.value ? "clear-overlay" : "show-overlay", props.slide)
}

const applyLiveSlide = (slideId: string) => {
  const slide = appStore.activeSlides.find(
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

</script>

<style scoped>
/* Shimmer sweep, same as CowSkeleton's. */
.media-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  animation: media-loading-shimmer 1.3s ease-in-out infinite;
}

html.dark .media-loading::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.22),
    transparent
  );
}

@keyframes media-loading-shimmer {
  100% {
    transform: translateX(100%);
  }
}

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
