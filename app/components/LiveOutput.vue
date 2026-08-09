<template>
  <div ref="liveColumn" class="live-output-column flex flex-col h-full w-full">
    <!-- LIVE PREVIEW (headerless, video panel) -->
    <div
      :style="{ height: livePreviewHeight + 'px', flexShrink: 0 }"
      class="min-h-0 overflow-hidden rounded-2xl bg-black shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
    >
      <div class="relative w-full h-full flex items-center justify-center">
        <LiveProjectionOnly
          slide-label
          :slide="liveSlide"
          :full-screen="false"
          :content-visible="true"
          :slide-styles="currentState.settings.slideStyles"
          class="lg-preview w-full h-full"
        />
      </div>
    </div>

    <div
      class="v-resize-handle h-3 shrink-0 rounded cursor-ns-resize opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startVResize($event)"
    />

    <TranscriptsPanel
      v-if="showTranscripts"
      :visible="showTranscripts"
      :style="{ height: transcriptPanelHeight + 'px', flexShrink: 0 }"
      class="min-h-0"
      @close="showTranscripts = false"
    />

    <div
      v-if="showTranscripts"
      class="v-resize-handle h-3 shrink-0 rounded cursor-ns-resize opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startTranscriptResize($event)"
    />

    <AppSection
      heading="Slide Schedule"
      class="flex-1 min-h-0"
      :secondary-buttons="[
        {
          label: 'Go Live',
          action: 'go-live',
          icon: 'i-bx-slideshow',
          svgIcon: 'GoLiveIcon',
          color: 'black',
          confirmAction: false,
          visible: true,
          variant: 'danger',
        },
      ]"
      :is-live-window-active="windowRefs?.length > 0"
    >
      <template #actions>
        <CowButton
          variant="primary"
          size="2xs"
          class="whitespace-nowrap !px-3 !py-1.5 text-xs gap-1.5"
          :disabled="!liveSlide"
          @click="goIntermission"
        >
          <template #leading>
            <IconWrapper name="i-bx-coffee" size="3.5" />
          </template>
          Intermission
        </CowButton>
      </template>
      <div class="main flex flex-col flex-1 min-h-0">
        <div
          v-if="liveOutputSlides?.length === 0 || !liveOutputSlides"
          class="ctn overflow-auto overflow-x-hidden flex-1 min-h-0"
        >
          <EmptyState
            icon="i-bx-slideshow"
            svg-icon="NoSlidesIcon"
            sub="No slides yet"
            action=""
            action-text=""
          />
        </div>
        <draggable
          v-show="!(liveOutputSlides?.length === 0 || !liveOutputSlides)"
          v-model="liveOutputSlides"
          group="slides"
          class="slides-ctn overflow-auto overflow-x-hidden flex-1 min-h-0 rounded-lg bg-gray-100 dark:bg-[#222938]"
          item-key="id"
          :animation="200"
          ghost-class="opacity-50"
          :delay="150"
          :delay-on-touch-only="true"
          :touch-start-threshold="5"
          @end="draggingSlide = null"
        >
          <!-- SLIDE CARD (DUPLICATED FROM THE SLIDECARD.VUE, TO MAKE DRAGGABLE WORK AS IT COULD NOT WORK IN COMPONENT) -->
          <template #item="{ element: slide, index }">
            <button
              class="group slide-card flex w-[100%] text-left gap-3 p-2 border-t first:border-t-0 border-gray-100 dark:border-[#171d2b] rounded-lg hover:bg-white dark:hover:bg-[#2b3242] transition-all cursor-pointer relative"
              :id="slide?.id"
              v-memo="[
                slide?.id,
                slide?.updatedAt,
                slide?.name,
                liveSlide?.id === slide?.id,
                currentState.activeOverlaySlide?.id === slide?.id,
                ctrlOrMetaActive,
              ]"
              :class="{
                'bg-red-100 dark:bg-red-900': liveSlide?.id === slide?.id,
                'bg-cyan-100 dark:bg-cyan-950':
                  currentState.activeOverlaySlide?.id === slide?.id,
              }"
              @click="handleScheduleSlideAction(slide)"
              @dblclick="useGlobalEmit(appWideActions.newActiveSlide, slide)"
              @dragstart="draggingSlide = slide"
              @dragover.prevent="
                slide?.type === slideTypes.songSetlist &&
                  draggingSlide?.type === slideTypes.song
              "
              @drop.stop.prevent="handleDropOnSetlist(slide)"
            >
              <DeferredSlidePreview
                preview-class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
                :slide="slide"
                :slide-label="slide?.name"
                :slide-styles="currentState.settings.slideStyles"
                :eager="liveSlide?.id === slide?.id"
              />
              <div class="texts flex-col justify-between">
                <h4
                  class="font-medium mt-2 overflow-hidden truncate w-40 2xl:w-56"
                >
                  {{ slide?.name }}
                </h4>
                <SlideChip
                  :slide-type="slide?.type"
                  :slide-mode="slide?.slideMode"
                  class="mt-1"
                />
              </div>
              <LiveSlideIndicator
                :visible="
                  slide.slideMode !== 'overlay' && liveSlide?.id === slide?.id
                "
                hide-text
                class="mt-3 left-20 right-auto"
              />
              <!-- DELETE SLIDE BUTTON -->
              <div class="actions absolute bottom-2 right-2 flex gap-1">
                <UTooltip
                  text="Preview/Edit Slide"
                  :popper="{ placement: 'top' }"
                >
                  <UButton
                    size="xs"
                    variant="ghost"
                    class="px-1 text-primary-500 hover:bg-primary-white"
                    @click.stop.prevent="
                      useGlobalEmit(appWideActions.newActiveSlide, slide)
                    "
                  >
                    <template #leading>
                      <EditIcon class="w-4 h-4" />
                    </template>
                  </UButton>
                </UTooltip>

                <ConfirmDialog
                  button-icon="i-tabler-trash"
                  button-styles="px-1 text-red-500 hover:bg-primary-white"
                  button-color="red"
                  header="Delete slide"
                  label="Are you sure you want to delete this slide? This action is not reversible"
                  @confirm="useGlobalEmit(appWideActions.deleteSlide, slide)"
                >
                  <template #icon>
                    <DeleteIcon class="w-4 h-4" />
                  </template>
                </ConfirmDialog>
              </div>
              <!-- SLIDE INDEX -->
              <div
                v-show="ctrlOrMetaActive"
                class="text-xs mono font-bold bg-gray-500 text-gray-100 inline-grid place-items-center p-1 px-1.5 min-w-[25px] rounded-md bottom-4 left-4 absolute"
              >
                {{ index === liveOutputSlides.length - 1 ? 0 : index + 1 }}
              </div>
            </button>
          </template>
        </draggable>
      </div>
    </AppSection>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useOnline } from "@vueuse/core"
import draggable from "vuedraggable"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"
import { tabSessionId } from "~/composables/useRealtimeSlides"

const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()
const { applyOverlaySettings } = useOverlaySettings()
const ctrlOrMetaActive = ref(false)
const showTranscripts = ref(false)
const draggingSlide = ref<Slide | null>(null)
const shortcutCleanups: Array<() => void> = []
const { currentState } = storeToRefs(appStore)
const windowRefs = inject("windowRefs") as any[]

const online = useOnline()
const { hasAccessToFeature } = useSubscription()

// Vertical resize between the "Live preview" panel and "Slide Schedule".
// Both heights are fractions of the column, so the schedule keeps a usable
// share of the panel on short screens.
const { panelBounds, panelSize, commitPanelSize } = usePanelLayout()
const livePreviewBounds = panelBounds("livePreviewHeight")
const transcriptBounds = panelBounds("transcriptPanelHeight")
const livePreviewLayoutHeight = panelSize("livePreviewHeight")
const transcriptLayoutHeight = panelSize("transcriptPanelHeight")
const livePreviewHeight = ref(livePreviewLayoutHeight.value)
const transcriptPanelHeight = ref(transcriptLayoutHeight.value)
const liveColumn = ref<HTMLDivElement | null>(null)
let vResizeStartY = 0
let vResizeStartHeight = 0
let isVResizing = false
let transcriptResizeStartY = 0
let transcriptResizeStartHeight = 0
let isTranscriptResizing = false

watch(livePreviewLayoutHeight, (height) => {
  if (!isVResizing) livePreviewHeight.value = height
})
watch(transcriptLayoutHeight, (height) => {
  if (!isTranscriptResizing) transcriptPanelHeight.value = height
})

const startVResize = (event: MouseEvent) => {
  isVResizing = true
  vResizeStartY = event.clientY
  vResizeStartHeight = livePreviewHeight.value
  document.addEventListener("mousemove", onVResizeMove)
  document.addEventListener("mouseup", onVResizeEnd)
  document.body.style.cursor = "ns-resize"
  document.body.style.userSelect = "none"
}
const onVResizeMove = (event: MouseEvent) => {
  const delta = event.clientY - vResizeStartY
  const { min, max } = livePreviewBounds.value
  livePreviewHeight.value = Math.min(
    max,
    Math.max(min, vResizeStartHeight + delta)
  )
}
const onVResizeEnd = () => {
  isVResizing = false
  commitPanelSize("livePreviewHeight", livePreviewHeight.value)
  document.removeEventListener("mousemove", onVResizeMove)
  document.removeEventListener("mouseup", onVResizeEnd)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

const startTranscriptResize = (event: MouseEvent) => {
  isTranscriptResizing = true
  transcriptResizeStartY = event.clientY
  transcriptResizeStartHeight = transcriptPanelHeight.value
  document.addEventListener("mousemove", onTranscriptResizeMove)
  document.addEventListener("mouseup", onTranscriptResizeEnd)
  document.body.style.cursor = "ns-resize"
  document.body.style.userSelect = "none"
}

const onTranscriptResizeMove = (event: MouseEvent) => {
  const delta = event.clientY - transcriptResizeStartY
  const { min, max } = transcriptBounds.value
  transcriptPanelHeight.value = Math.min(
    max,
    Math.max(min, transcriptResizeStartHeight + delta)
  )
}

const onTranscriptResizeEnd = () => {
  isTranscriptResizing = false
  commitPanelSize("transcriptPanelHeight", transcriptPanelHeight.value)
  document.removeEventListener("mousemove", onTranscriptResizeMove)
  document.removeEventListener("mouseup", onTranscriptResizeEnd)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

onBeforeUnmount(() => {
  shortcutCleanups.splice(0).forEach((cleanup) => cleanup())
  // Not persisted here — the resize handlers commit on drag end, and saving on
  // unmount would mark a viewport-derived height as user-chosen.
  document.removeEventListener("mousemove", onVResizeMove)
  document.removeEventListener("mouseup", onVResizeEnd)
  document.removeEventListener("mousemove", onTranscriptResizeMove)
  document.removeEventListener("mouseup", onTranscriptResizeEnd)
})

// Listen for transcription toggle event
const emitter = useNuxtApp().$emitter as any
emitter?.on(appWideActions.newTranscribe, () => {
  showTranscripts.value = true
})

/**
 * Broadcast slide reorder via Socket.IO for realtime collaboration
 */
const broadcastSlideReorder = (slideOrder: string[]) => {
  if (!online.value) return

  const nuxtApp = useNuxtApp()
  const socket = nuxtApp.$socketio as any
  if (socket?.connected) {
    socket.emit("reorder-slides", {
      slideOrder,
      reorderedByName: authStore.user?.fullname || "Anonymous",
      tabId: tabSessionId,
    })
  }
}

// Build the lookup once per activeSlides mutation. The previous implementation
// ran Array.find for every live-output id, turning each verse update into an
// O(n²) schedule scan on larger services.
const activeSlidesById = computed(
  () =>
    new Map(
      currentState.value.activeSlides.map((slide) => [slide.id, slide] as const)
    )
)

const liveSlide = computed(() =>
  currentState.value.liveSlideId
    ? activeSlidesById.value.get(currentState.value.liveSlideId)
    : undefined
)

const liveOutputSlides = computed({
  get() {
    const tempSlides = (currentState.value.liveOutputSlidesId ?? [])
      .map((id) => activeSlidesById.value.get(id))
      .filter((slide): slide is Slide => Boolean(slide))

    // Filter by current active schedule
    return tempSlides.filter(
      (slide) => slide.scheduleId === currentState.value?.activeSchedule?._id
    )
  },
  set(newVal) {
    appStore.replaceScheduleActiveSlides(newVal)
    // Set Index for each slide
    const tempSlides = [...newVal].map((slide, index) => {
      slide.index = index
      return slide
    })
    useGlobalEmit(appWideActions.batchUpdateSlides, tempSlides)

    // Broadcast the reorder to other tabs/devices
    const slideOrder = tempSlides.map((slide) => slide.id)
    broadcastSlideReorder(slideOrder)
  },
})

const navigationSlides = computed(() =>
  liveOutputSlides.value.filter((slide) => slide.slideMode !== "overlay")
)

const nextSlide = computed(() => {
  const liveSlideIndex = navigationSlides.value.findIndex(
    (slide: Slide) => slide.id === currentState.value.liveSlideId
  )
  // const tempSlides = liveOutputSlidesId.value?.map((id) =>
  //   appStore.activeSlides.find((slide) => slide.id === id)
  // ) as Slide[]
  const gotoSlideIndex = (liveSlideIndex as number) + 1
  if (gotoSlideIndex < navigationSlides.value.length) {
    return navigationSlides.value[gotoSlideIndex]
  }
})

const previousSlide = computed(() => {
  const liveSlideIndex = navigationSlides.value.findIndex(
    (slide: Slide) => slide.id === currentState.value?.liveSlideId
  )
  // const tempSlides = liveOutputSlidesId.value?.map((id) =>
  //   appStore.activeSlides.find((slide) => slide.id === id)
  // ) as Slide[]
  if (!liveSlideIndex || liveSlideIndex < 1) return
  const gotoSlideIndex = liveSlideIndex - 1
  if (gotoSlideIndex < navigationSlides.value.length) {
    return navigationSlides.value[gotoSlideIndex]
  }
})

onMounted(() => {
  shortcutCleanups.push(useCreateShortcut("ArrowDown", () => {
    if (nextSlide.value) {
      setLiveSlide(nextSlide.value.id)
      return true
    }
    return false
  }))
  shortcutCleanups.push(useCreateShortcut("ArrowUp", () => {
    if (previousSlide.value) {
      setLiveSlide(previousSlide.value.id)
      return true
    }
    return false
  }))
  shortcutCleanups.push(useCreateShortcut(
    "0",
    () => {
      if (navigationSlides.value?.at(-1)?.id) {
        setLiveSlide(navigationSlides.value?.at(-1)?.id!!)
        return true
      }
      return false
    },
    { ctrlOrMeta: true, shift: false }
  ))

  // Create shortcuts for Slides 1-9
  const oneDigitNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  oneDigitNumbers.forEach((digit) => {
    shortcutCleanups.push(useCreateShortcut(
      digit.toString(),
      () => {
        if (navigationSlides.value?.at(digit - 1)?.id) {
          setLiveSlide(navigationSlides.value?.at(digit - 1)?.id!!)
          return true
        }
        return false
      },
      { ctrlOrMeta: true, shift: false }
    ))
  })

  // Add listener for ctrlOrMeta
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey) {
      ctrlOrMetaActive.value = true
    }
  })
  window.addEventListener("keyup", (event) => {
    ctrlOrMetaActive.value = false
  })
})

// const makeSlideActive = (slide: Slide, goLive: boolean = false) => {
//   if (goLive) {
//     appStore.setActiveSlides(slides.value)
//     setLiveSlide(activeSlide.value.id)
//   }
// }

const setLiveSlide = (slideId: string) => {
  const slide = appStore.currentState.activeSlides.find(
    (s) => s.id === slideId || s._id === slideId
  )
  if (!slide) return
  if (slide.slideMode === "overlay") return

  // useDebounceFn(useBroadcastPost, 0)(JSON.stringify(slide))
  useBroadcastPost(slide)
  appStore.setLiveSlide(slideId)
}

const emitOverlaySocketAction = (action: string, slide?: Slide) => {
  if (!online.value) return
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit(action, { ...(slide || {}), tabId: tabSessionId })
  }
}

const toggleSlideOverlay = (slide: Slide) => {
  if (!hasAccessToFeature(appWideActions.showSlideOverlay)) {
    useGlobalEmit(appWideActions.showUpgradeModal)
    return
  }

  if (currentState.value.activeOverlaySlide?.id === slide.id) {
    appStore.setActiveOverlaySlide(null)
    useBroadcastOverlayPost(appWideActions.removeSlideOverlay)
    emitOverlaySocketAction(appWideActions.removeSlideOverlay)
    return
  }

  const overlaySlide = applyOverlaySettings(slide)
  appStore.setActiveOverlaySlide(overlaySlide)
  useBroadcastOverlayPost(appWideActions.showSlideOverlay, overlaySlide)
  emitOverlaySocketAction(appWideActions.showSlideOverlay, overlaySlide)
}

const goIntermission = () => {
  if (!liveSlide.value) return
  useBroadcastPost(null)
  appStore.setLiveSlide("")
}

const handleScheduleSlideAction = (slide: Slide) => {
  if (slide.slideMode === "overlay") {
    toggleSlideOverlay(slide)
    return
  }
  setLiveSlide(slide.id)
}

const handleDropOnSetlist = (targetSlide: Slide) => {
  if (
    targetSlide?.type !== slideTypes.songSetlist ||
    draggingSlide.value?.type !== slideTypes.song ||
    draggingSlide.value.id === targetSlide.id
  ) {
    draggingSlide.value = null
    return
  }

  useGlobalEmit(appWideActions.addSongSlideToSetlist, {
    setlistSlide: targetSlide,
    songSlide: draggingSlide.value,
  })
  draggingSlide.value = null
}
</script>

<style scoped>
.live-output-column :deep(.lg-preview),
.live-output-column :deep(.live-output-ctn),
.live-output-column :deep(.live-output) {
  height: 100%;
  min-height: 100%;
}

.live-output-column :deep(.live-output) {
  border: 0;
  border-radius: 0.5rem;
}

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

/* On touch devices, always show actions since hover doesn't exist */
@media (hover: none) {
  .slide-card .actions {
    visibility: visible;
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
