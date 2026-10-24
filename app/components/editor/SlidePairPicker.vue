<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <UCard
      :ui="{
        body: { padding: 'px-3 py-3 sm:px-3' },
        header: { padding: 'px-4 py-3 sm:px-4' },
      }"
    >
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold truncate">
            {{ replacing ? "Change paired slide" : "Pair with" }}
            {{ camera?.name || "camera" }}
          </h3>
          <UButton
            color="gray"
            variant="ghost"
            aria-label="Close"
            @click="isOpen = false"
          >
            <template #leading><CloseIcon class="w-5 h-5" /></template>
          </UButton>
        </div>
      </template>

      <div class="flex flex-col gap-3">
        <CowTeamsPreviewNotice
          v-if="!hasAccessToFeature(appWideActions.slidePair)"
          :feature="appWideActions.slidePair"
        />
        <CowInput v-model="query" label="Search slides" size="sm" />

        <div class="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          <p
            v-if="!rows.length"
            class="py-6 text-center text-sm text-gray-500 dark:text-[#9aa3b2]"
          >
            No slides to pair with.
          </p>
          <button
            v-for="row in rows"
            :key="row.slide.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors"
            :class="
              row.reason
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 dark:hover:bg-[#2b3242]'
            "
            :disabled="!!row.reason"
            @click="pick(row.slide.id)"
          >
            <DeferredSlidePreview
              preview-class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
              :slide="row.slide"
              :slide-styles="currentState.settings.slideStyles"
            />
            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-medium truncate">{{ row.slide.name }}</h4>
              <div class="mt-1 flex items-center gap-2">
                <SlideChip :slide-type="row.slide.type" />
                <span
                  v-if="row.reason"
                  class="text-[11px] text-gray-500 dark:text-[#9aa3b2]"
                >
                  {{ row.reason }}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"
import { appWideActions } from "~/utils/constants"
import { isCameraSlide } from "~/utils/slidePairs"

/**
 * Picks the slide to pair with a camera, from that camera's ⋯ menu: the touch
 * and keyboard way to pair, beside dragging a slide onto the camera. With
 * `pairId` it changes the camera's partner instead.
 */
const props = defineProps<{
  modelValue: boolean
  cameraId: string | null
  pairId?: string | null
}>()
const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  pick: [slideId: string]
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const { hasAccessToFeature } = useSubscription()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})
const query = ref("")
watch(isOpen, (open) => {
  if (open) query.value = ""
})

const camera = computed(() =>
  props.cameraId ? appStore.activeSlidesById.get(props.cameraId) : undefined
)
const pair = computed(() =>
  props.pairId ? appStore.slidePairsById.get(props.pairId) : undefined
)
const replacing = computed(() => !!pair.value)
// When changing a pair's slide, the one that would go out stays listed (it
// is the current choice) but cannot be picked.
const partnerId = computed(() =>
  pair.value?.slideIds.find((id) => id !== props.cameraId)
)

const reasonFor = (slide: Slide): string | null => {
  if (slide.id === partnerId.value) return "Paired now"
  if (appStore.pairForSlide(slide.id)) return "In a pair"
  // The camera stays in the pair, so any other slide keeps it a camera pair.
  return null
}

const rows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return appStore.activeScheduleSlides
    .filter(
      (slide) =>
        slide.id !== props.cameraId &&
        slide.slideMode !== "overlay" &&
        (!needle || (slide.name || "").toLowerCase().includes(needle))
    )
    .map((slide) => ({ slide, reason: reasonFor(slide) }))
    // Slides that can be picked first, cameras last among them: the usual
    // partner is the words or the media, not another camera.
    .sort(
      (a, b) =>
        Number(!!a.reason) - Number(!!b.reason) ||
        Number(isCameraSlide(a.slide)) - Number(isCameraSlide(b.slide))
    )
})

const pick = (slideId: string) => {
  emit("pick", slideId)
  isOpen.value = false
}
</script>
