<template>
  <div v-if="pair" class="slide-pair-panel flex flex-col gap-4">
    <CowTeamsPreviewNotice
      v-if="!hasAccessToFeature(appWideActions.slidePair)"
      :feature="appWideActions.slidePair"
    />

    <!-- MEMBER — which slide the editor works on. Each keeps its own controls. -->
    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold text-gray-700 dark:text-[#c3cad6]">
        Choose slide to edit
      </h4>
      <!-- Showing or hiding a member is on the editor toolbar
           (SlidePairVisibility); a hidden member is dimmed here. -->
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="(member, index) in members"
          :key="member.id"
          type="button"
          class="min-w-0 rounded-xl px-3 py-2.5 text-left transition-shadow bg-white dark:bg-[#131a27]"
          :class="optionRing(editingMemberId === member.id)"
          @click="
            useGlobalEmit(appWideActions.setPairActiveMember, {
              pairId: pair.id,
              slideId: member.id,
            })
          "
        >
          <span
            class="block text-sm font-medium truncate"
            :class="{ 'opacity-50': isHidden(member) }"
          >
            {{ index + 1 }}. {{ member.name }}
          </span>
        </button>
      </div>
      <!-- The camera always takes the camera's place. Two cameras follow
           pair order, which this flips. -->
      <CowButton
        v-if="canSwap"
        variant="secondary"
        size="xs"
        class="self-start !px-3 !py-1.5 text-xs gap-1.5"
        @click="swapPair(pair.id)"
      >
        <UIcon name="i-tabler-arrows-exchange" class="w-3.5 h-3.5" />
        Swap the cameras
      </CowButton>
    </section>

    <!-- LAYOUT — can be changed while a slide is hidden; it applies once
         that slide is shown again. -->
    <section class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold text-gray-700 dark:text-[#c3cad6]">
        Layout
      </h4>
      <div class="grid grid-cols-2 gap-2">
        <CowTooltip
          v-for="layout in SLIDE_PAIR_LAYOUTS"
          :key="layout.value"
          :text="layout.hint"
        >
          <button
            type="button"
            class="w-full rounded-xl p-2 flex flex-col gap-1.5 text-left transition-shadow bg-white dark:bg-[#131a27]"
            :class="optionRing(pair.layout === layout.value)"
            :aria-pressed="pair.layout === layout.value"
            @click="setLayout(layout.value)"
          >
            <SlidePairLayoutThumb :layout="layout.value" />
            <span class="text-xs font-medium truncate px-0.5">
              {{ layout.label }}
            </span>
          </button>
        </CowTooltip>
      </div>
    </section>

    <CowButton
      variant="secondary"
      size="xs"
      class="self-start !px-3 !py-1.5 text-xs gap-1.5"
      @click="useGlobalEmit(appWideActions.unpairSlides, pair.id)"
    >
      <UIcon name="i-tabler-layout-columns" class="w-3.5 h-3.5" />
      Unpair slides
    </CowButton>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide, SlidePairLayout } from "~/types"
import { editingMemberOf } from "~/composables/useSlidePairs"
import { appWideActions } from "~/utils/constants"
import {
  SLIDE_PAIR_LAYOUTS,
  isCameraSlide,
} from "~/utils/slidePairs"

/**
 * The editor's Pair settings tab for a slide in a slide pair: which member the
 * editor is on (this window only), which member is on screen and how the pair
 * is laid out. Each member's own content and style stay with that member's
 * usual controls.
 */
const props = defineProps<{ pairId: string }>()

const appStore = useAppStore()
const { hasAccessToFeature } = useSubscription()
const { updatePair, swapPair } = useSlidePairs()

// One member at most is off the screen; see useSlidePairs.toggleHidden.
const isHidden = (member: Slide) => pair.value?.hiddenSlideId === member.id

const pair = computed(() => appStore.slidePairsById.get(props.pairId))

const members = computed<Slide[]>(() =>
  (pair.value?.slideIds ?? [])
    .map((id) => appStore.activeSlidesById.get(id))
    .filter((slide): slide is Slide => !!slide)
)

const editingMemberId = computed(() =>
  pair.value ? editingMemberOf(pair.value) : null
)

const cameraCount = computed(() => members.value.filter(isCameraSlide).length)
// The camera always takes the frame, so only two cameras have an order to swap.
const canSwap = computed(() => cameraCount.value === 2)

const optionRing = (selected: boolean) =>
  selected
    ? "ring-2 ring-primary-500"
    : "ring-1 ring-gray-200 dark:ring-white/10 hover:ring-gray-300 dark:hover:ring-white/20"

const setLayout = (layout: SlidePairLayout) => {
  if (!pair.value || pair.value.layout === layout) return
  void updatePair(pair.value.id, { layout })
  usePosthogCapture("SLIDE_PAIR_LAYOUT_CHANGED", { layout })
}
</script>
