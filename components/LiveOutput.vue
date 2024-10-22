<template>
  <AppSection
    heading="Slide Schedule"
    class="max-w-[400px]"
    :secondary-buttons="[
      {
        label: 'Go Live',
        action: 'go-live',
        icon: 'i-bx-slideshow',
        color: 'primary',
        confirmAction: false,
        visible: true,
        variant: 'solid',
      },
    ]"
    :is-live-window-active="windowRefs?.length > 0"
  >
    <div class="main">
      <div
        v-if="liveOutputSlides?.length === 0 || !liveOutputSlides"
        class="ctn h-[calc(100vh-80px-220px-80px)] overflow-auto mb-4 overflow-x-hidden"
      >
        <EmptyState
          icon="i-bx-slideshow"
          sub="No slides yet"
          action=""
          action-text=""
        />
      </div>
      <draggable
        v-show="!(liveOutputSlides?.length === 0 || !liveOutputSlides)"
        v-model="liveOutputSlides"
        group="slides"
        class="slides-ctn h-[calc(100vh-80px-220px-80px)] overflow-auto mb-4 overflow-x-hidden"
        item-key="name"
      >
        <!-- SLIDE CARD (DUPLICATED FROM THE SLIDECARD.VUE, TO MAKE DRAGGABLE WORK AS IT COULD NOT WORK IN COMPONENT) -->
        <template #item="{ element: slide }">
          <button
            class="group slide-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-primary-950 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900 transition-all cursor-pointer relative"
            :id="slide?.id"
            :class="{
              'bg-red-100 dark:bg-red-900': liveSlide?.id === slide?.id,
            }"
            @click="appStore.setLiveSlide(slide?.id || '0')"
            @dblclick="useGlobalEmit(appWideActions.newActiveSlide, slide)"
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
              <h4
                class="font-medium mt-2 overflow-hidden truncate w-40 2xl:w-56"
              >
                {{ slide?.name }}
              </h4>
              <SlideChip :slide-type="slide?.type" class="mt-1" />
            </div>
            <LiveSlideIndicator
              :visible="liveSlide?.id === slide?.id"
              hide-text
              class="ml-2 mt-4 left-20 right-auto"
            />
            <!-- DELETE SLIDE BUTTON -->
            <div class="actions absolute bottom-2 right-2 flex gap-1">
              <UTooltip
                text="Preview/Edit Slide"
                :popper="{ placement: 'top' }"
              >
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

              <ConfirmDialog
                button-icon="i-tabler-trash"
                button-styles="px-1 text-red-500 hover:bg-primary-white"
                button-color="red"
                header="Delete slide"
                label="Are you sure you want to delete this slide? This action is not reversible"
                @confirm="useGlobalEmit(appWideActions.deleteSlide, slide)"
              >
              </ConfirmDialog>
            </div>
          </button>
        </template>
      </draggable>
      <LiveProjectionOnly
        slide-label
        :slide="liveSlide"
        :full-screen="false"
        :content-visible="true"
        :slide-styles="currentState.settings.slideStyles"
        class="lg-preview"
      />
    </div>
  </AppSection>
</template>

<script setup lang="ts">
import draggable from "vuedraggable"
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"

const appStore = useAppStore()
const toast = useToast()
const { currentState } = storeToRefs(appStore)
const windowRefs = inject("windowRefs") as any[]

watch(
  () => windowRefs,
  () => {
    // console.log("windowRefs", windowRefs.value)
  }
)

const liveSlide = computed(() => {
  return currentState.value?.activeSlides.find(
    (slide) => slide.id === currentState.value.liveSlideId
  )
})

const liveOutputSlides = computed({
  get() {
    const tempSlides = currentState.value?.liveOutputSlidesId?.map((id) =>
      currentState.value?.activeSlides.find((slide) => slide.id === id)
    ) as Slide[]

    // Filter by current active schedule
    return tempSlides?.filter(
      (slide) => slide.scheduleId === currentState.value?.activeSchedule?._id
    )
  },
  set(newVal) {
    appStore.replaceScheduleActiveSlides(newVal)
    toast.add({ icon: "i-bx-slideshow", title: "Slide order has been updated" })
  },
})

const nextSlide = computed(() => {
  const liveSlideIndex = liveOutputSlides.value?.findIndex(
    (slide: Slide) => slide.id === currentState.value.liveSlideId
  )
  // const tempSlides = liveOutputSlidesId.value?.map((id) =>
  //   appStore.activeSlides.find((slide) => slide.id === id)
  // ) as Slide[]
  const gotoSlideIndex = (liveSlideIndex as number) + 1
  if (gotoSlideIndex < liveOutputSlides.value?.length) {
    return liveOutputSlides.value[gotoSlideIndex]
  }
})

const previousSlide = computed(() => {
  const liveSlideIndex = liveOutputSlides.value?.findIndex(
    (slide: Slide) => slide.id === currentState.value?.liveSlideId
  )
  // const tempSlides = liveOutputSlidesId.value?.map((id) =>
  //   appStore.activeSlides.find((slide) => slide.id === id)
  // ) as Slide[]
  const gotoSlideIndex = (liveSlideIndex as number) - 1 || 0
  if (gotoSlideIndex < liveOutputSlides.value?.length) {
    return liveOutputSlides.value[gotoSlideIndex]
  }
})

onMounted(() => {
  useCreateShortcut("ArrowDown", () => {
    if (nextSlide.value) {
      appStore.setLiveSlide(nextSlide.value.id)
    }
  })
  useCreateShortcut("ArrowUp", () => {
    if (previousSlide.value) {
      appStore.setLiveSlide(previousSlide.value.id)
    }
  })
})

// const makeSlideActive = (slide: Slide, goLive: boolean = false) => {
//   if (goLive) {
//     appStore.setActiveSlides(slides.value)
//     appStore.setLiveSlide(activeSlide.value.id)
//   }
// }
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
</style>
