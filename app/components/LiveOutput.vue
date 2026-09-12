<template>
  <div
    ref="liveColumn"
    class="live-output-column flex flex-col h-full w-full"
    :class="mobile ? 'gap-2' : ''"
  >
    <!-- LIVE PREVIEW (headerless, video panel) -->
    <div
      :style="
        mobile
          ? { aspectRatio: '16 / 9', width: '100%', flexShrink: 0 }
          : { height: livePreviewHeight + 'px', flexShrink: 0 }
      "
      data-tour="live-preview"
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

    <!-- CONTROLLED OUTPUT — which screen this device's taps land on. A phone
         has no projector of its own, so without this line an operator cannot
         tell whether taking a slide live moves the congregation screen or
         nothing at all. Hidden when no other device is offering an output. -->
    <button
      v-if="mobile && (isControllingRemoteHost || availableHosts.length > 0)"
      type="button"
      class="controlled-output shrink-0 flex items-center gap-2.5 w-full rounded-xl border border-white/80 bg-white px-3 py-2 text-left dark:border-[#202838] dark:bg-[#171d2b]"
      @click="liveMenuRef?.open()"
    >
      <span
        class="w-2 h-2 rounded-full shrink-0"
        :class="
          isControllingRemoteHost
            ? 'bg-red-500'
            : 'bg-gray-300 dark:bg-[#3a4252]'
        "
      />
      <span class="min-w-0 flex-1">
        <span
          class="block text-xs font-medium text-gray-700 dark:text-[#a7afbd] truncate"
        >
          {{
            isControllingRemoteHost
              ? `Controlling ${targetHost?.userName}'s screen`
              : "Not controlling a screen"
          }}
        </span>
        <span
          class="block text-[11px] text-gray-500 dark:text-[#6f7889] truncate"
        >
          {{
            isControllingRemoteHost
              ? targetHost?.deviceLabel
              : "Slides you take live only reach the livestream"
          }}
        </span>
      </span>
      <span
        class="text-[11px] font-medium text-primary-600 dark:text-primary-300 shrink-0"
      >
        {{ isControllingRemoteHost ? "Change" : "Connect" }}
      </span>
    </button>

    <div
      v-if="!mobile"
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
      v-if="showTranscripts && !mobile"
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
          // Opens a second OS window on a projector or external display, which
          // a phone has no way to do. The other half of its popover — the
          // livestream URL — is in the menu beside it on mobile.
          visible: !mobile,
          variant: 'danger',
        },
      ]"
      :is-live-window-active="windowRefs?.length > 0"
    >
      <template #actions>
        <!-- One-tap Blank, exactly as the desktop header has always had it.
             Hidden on mobile, where the same action lives in the menu below. -->
        <CowTooltip
          v-if="!mobile"
          text="Blank the live output"
          shortcut="blank-output"
        >
          <CowButton
            variant="primary"
            size="2xs"
            class="whitespace-nowrap !px-3 !py-1.5 text-xs gap-1.5"
            :disabled="!liveSlide"
            @click="goIntermission"
          >
            <template #leading>
              <IconWrapper name="i-bx-hide" size="3.5" />
            </template>
            Blank
          </CowButton>
        </CowTooltip>

        <!-- LIVE OUTPUT MENU — mobile only. The desktop header keeps the layout
             it has always had (Blank, then Go Live). This menu exists because a
             phone has neither route: Go Live is hidden there (no second window
             to open), and it is the popover behind Go Live that normally offers
             the livestream URL. -->
        <MoreActionsMenu
          v-if="mobile"
          ref="liveMenuRef"
          flush
          trigger-class="rounded-full"
          @update:open="liveMenuOpen = $event"
        >
          <template #default="{ close }">
            <!-- OUTPUT DEVICES — the screens offering themselves for control
                 right now. Picking one is the only way a tap on this phone
                 reaches a projector; until then nothing here is addressed to
                 any screen, which is what keeps a phone out of a service it
                 was not invited into. -->
            <UButton
              v-for="host in availableHosts"
              :key="host.hostId"
              variant="ghost"
              color="gray"
              block
              @click.stop.prevent="
                () => {
                  close()
                  connectToHost(host.hostId)
                }
              "
            >
              <template #leading>
                <IconWrapper
                  :name="
                    host.hostId === targetHost?.hostId
                      ? 'i-bx-check-circle'
                      : 'i-lucide-monitor'
                  "
                  size="4"
                />
              </template>
              {{ host.userName }}'s screen
            </UButton>

            <UButton
              v-if="availableHosts.length === 0"
              variant="ghost"
              color="gray"
              block
              disabled
            >
              <template #leading>
                <IconWrapper name="i-lucide-monitor" size="4" />
              </template>
              No output device online
            </UButton>

            <UButton
              v-if="isControllingRemoteHost"
              variant="ghost"
              color="gray"
              block
              @click.stop.prevent="
                () => {
                  close()
                  stopControlling()
                }
              "
            >
              <template #leading>
                <IconWrapper name="i-bx-unlink" size="4" />
              </template>
              Stop controlling
            </UButton>

            <UButton
              variant="ghost"
              color="gray"
              block
              @click.stop.prevent="
                () => {
                  close()
                  canUseLivestreamLink
                    ? copyLivestreamURL()
                    : useGlobalEmit(appWideActions.showUpgradeModal)
                }
              "
            >
              <template #leading>
                <IconWrapper
                  :name="
                    isClipboardCopying ? 'i-bx-check-circle' : 'i-bx-clipboard'
                  "
                  size="4"
                />
              </template>
              Copy livestream link
              <IconWrapper
                v-if="!canUseLivestreamLink"
                name="i-bxs-award"
                class="inline-flex w-4 h-4 text-xs text-[#FF8980]"
              />
            </UButton>

            <UButton
              variant="ghost"
              color="gray"
              block
              :disabled="!liveSlide"
              @click.stop.prevent="
                () => {
                  close()
                  goIntermission()
                }
              "
            >
              <template #leading>
                <IconWrapper name="i-bx-hide" size="4" />
              </template>
              Blank the live output
            </UButton>
          </template>
        </MoreActionsMenu>

        <!-- REMOTE CONTROL — shown only on the device whose screen is being
             driven from someone else's phone, so a takeover is never silent.
             "Stop" turns the permission off here rather than kicking one
             device, which is the switch the operator can find again later.
             Last in the slot because the row is reversed, which puts this
             furthest from Blank and Go Live. -->
        <div
          v-if="!mobile && activeRemoteController"
          class="flex items-center gap-2 whitespace-nowrap text-xs"
        >
          <CowTooltip
            :text="`${activeRemoteController.name} is taking slides live on this output from the mobile app`"
          >
            <span
              class="flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-1 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-200"
            >
              <IconWrapper name="i-bx-mobile" size="3.5" />
              <span class="max-w-[8rem] truncate">{{
                activeRemoteController.name
              }}</span>
            </span>
          </CowTooltip>
          <button
            class="font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-300"
            @click.stop="stopRemoteControl"
          >
            Stop
          </button>
        </div>
      </template>
      <div class="main flex flex-col flex-1 min-h-0" data-tour="schedule-slides">
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
            <CowTooltip
              :text="scheduleCardHint(slide)"
              :open-delay="700"
              class="w-full"
            >
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
                  openActionsSlideId === slide?.id,
                ]"
                :class="{
                  'bg-red-100 dark:bg-red-900': liveSlide?.id === slide?.id,
                  'bg-cyan-100 dark:bg-cyan-950':
                    currentState.activeOverlaySlide?.id === slide?.id,
                }"
                @click="handleScheduleSlideAction(slide)"
                @dblclick="editSlide(slide)"
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
                <!-- EDIT / DELETE SLIDE — side by side on desktop, where the
                     row has the width for them and hover reveals them. A phone
                     has neither, and two exposed icons on a 100%-wide row are
                     two things to hit by accident while scrolling the schedule
                     mid-service, so there they fold into the same "more" menu
                     the rest of the app uses. -->
                <div
                  class="actions absolute bottom-2 right-2 flex gap-1"
                  :class="{ 'menu-open': openActionsSlideId === slide?.id }"
                >
                  <MoreActionsMenu
                    v-if="mobile"
                    flush
                    trigger-class="rounded-full"
                    @update:open="
                      openActionsSlideId = $event ? slide?.id ?? null : null
                    "
                  >
                    <template #default="{ close }">
                      <UButton
                        variant="ghost"
                        color="gray"
                        block
                        @click.stop.prevent="
                          () => {
                            close()
                            editSlide(slide)
                          }
                        "
                      >
                        <template #leading>
                          <EditIcon class="w-4 h-4" />
                        </template>
                        Edit slide
                      </UButton>

                      <ConfirmDialog
                        button-icon="i-tabler-trash"
                        no-tooltip
                        button-variant="ghost"
                        button-color="red"
                        button-label="Delete Slide"
                        button-styles="more-item-danger"
                        header="Delete slide"
                        label="Are you sure you want to delete this slide? This action is not reversible"
                        @confirm="
                          () => {
                            useGlobalEmit(appWideActions.deleteSlide, slide)
                            close()
                          }
                        "
                      >
                        <template #icon>
                          <DeleteIcon class="w-4 h-4" />
                        </template>
                      </ConfirmDialog>
                    </template>
                  </MoreActionsMenu>

                  <template v-else>
                    <CowTooltip text="Preview / edit slide">
                      <UButton
                        size="xs"
                        variant="ghost"
                        class="px-1 text-primary-500 hover:bg-primary-white"
                        @click.stop.prevent="editSlide(slide)"
                      >
                        <template #leading>
                          <EditIcon class="w-4 h-4" />
                        </template>
                      </UButton>
                    </CowTooltip>

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
                  </template>
                </div>
              <!-- SLIDE INDEX -->
              <div
                v-show="ctrlOrMetaActive"
                class="text-xs mono font-bold bg-gray-500 text-gray-100 inline-grid place-items-center p-1 px-1.5 min-w-[25px] rounded-md bottom-4 left-4 absolute"
              >
                {{ index === liveOutputSlides.length - 1 ? 0 : index + 1 }}
              </div>
              </button>
            </CowTooltip>
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
import { shortcutIds } from "~/utils/shortcuts"

const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()
const { applyOverlaySettings } = useOverlaySettings()
const ctrlOrMetaActive = ref(false)
const showTranscripts = ref(false)
const draggingSlide = ref<Slide | null>(null)
const shortcutCleanups: Array<() => void> = []
const { currentState } = storeToRefs(appStore)
const props = withDefaults(
  defineProps<{
    /**
     * Renders inside the mobile route's live sheet rather than the desktop
     * console's right column: the preview takes a fixed 16:9 instead of a
     * draggable height, and the drag handles go away with it.
     */
    mobile?: boolean
  }>(),
  { mobile: false }
)

const emit = defineEmits<{
  /**
   * A slide was sent to the editor. On mobile the live pane and the editor
   * cannot both be on screen, so the route that opened this pane uses this to
   * step out of the way rather than leaving the editor stacked behind it.
   */
  (e: "edit-slide", slide: Slide): void
}>()

// Which row's actions menu is open, so its icons stay visible while it is (the
// `.actions` group is otherwise hover-only).
const openActionsSlideId = ref<string | null>(null)

const editSlide = (slide: Slide) => {
  emit("edit-slide", slide)
  useGlobalEmit(appWideActions.newActiveSlide, slide)
}

const windowRefs = inject("windowRefs") as any[]

// Live-output menu (output device, livestream link, blank). Shared with the Go
// Live popover in AppSection so both offer the same link under the same Teams
// gate. The ref lets the "controlled output" strip open the same menu rather
// than growing a second picker of its own.
const liveMenuOpen = ref(false)
const liveMenuRef = ref<{ open: () => void; close: () => void } | null>(null)

// Taking a slide live goes through here rather than touching the store
// directly, so one device driving another's screen is a routing decision made
// in one place instead of a special case in every call site.
const {
  goLive: setLiveSlide,
  blankOutput,
  availableHosts,
  targetHost,
  isControllingRemoteHost,
  connectToHost,
  stopControlling,
  activeRemoteController,
  stopRemoteControl,
} = useLiveOutputControl()

const { canUseLivestreamLink, isClipboardCopying, copyLivestreamURL } =
  useLivestreamLink()

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
      appStore.activeSlides.map((slide) => [slide.id, slide] as const)
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
    // Set Index for each slide
    const tempSlides = [...newVal].map((slide, index) => ({
      ...slide,
      index,
    }))
    appStore.replaceScheduleActiveSlides(tempSlides)
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
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.nextSlide, () => {
      if (nextSlide.value) {
        setLiveSlide(nextSlide.value.id)
        return true
      }
      return false
    })
  )
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.previousSlide, () => {
      if (previousSlide.value) {
        setLiveSlide(previousSlide.value.id)
        return true
      }
      return false
    })
  )
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.lastSlide, () => {
      if (navigationSlides.value?.at(-1)?.id) {
        setLiveSlide(navigationSlides.value?.at(-1)?.id!!)
        return true
      }
      return false
    })
  )

  // "B" for black/blank is the muscle memory operators bring from PowerPoint,
  // Keynote and ProPresenter. Escape is deliberately NOT bound to this —
  // Headless UI listens for it on the same window target to close modals, and
  // this handler registers first, so it would swallow every dismiss keypress.
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.blankOutput, () => {
      if (!liveSlide.value) return false
      goIntermission()
      return true
    })
  )

  // Create shortcuts for Slides 1-9
  const oneDigitNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  oneDigitNumbers.forEach((digit) => {
    shortcutCleanups.push(
      useCreateShortcut(
        digit.toString(),
        () => {
          if (navigationSlides.value?.at(digit - 1)?.id) {
            setLiveSlide(navigationSlides.value?.at(digit - 1)?.id!!)
            return true
          }
          return false
        },
        { ctrlOrMeta: true, shift: false }
      )
    )
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
  blankOutput()
}

// Clicking a schedule card sends it live; double-clicking opens it in the
// editor. That is the reverse of the preview grid, where a click previews and a
// double-click goes live — so both places spell the pair out.
const scheduleCardHint = (slide: Slide) => {
  if (slide?.slideMode === "overlay") {
    return currentState.value.activeOverlaySlide?.id === slide.id
      ? "Click to clear overlay · Double-click to edit"
      : "Click to show overlay · Double-click to edit"
  }
  return "Click to take live · Double-click to edit"
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
.slide-card:hover .actions,
.slide-card .actions.menu-open {
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
