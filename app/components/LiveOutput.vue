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
        <Transition name="cow-pair">
          <LivePairProjection
            v-if="livePairSlides"
            slide-label
            audio-muted
            :slides="livePairSlides"
            :full-screen="false"
            :slide-styles="currentState.settings.slideStyles"
            :camera-mode="mobile ? 'placeholder' : 'preview'"
            class="lg-preview w-full h-full"
          />
        </Transition>
        <Transition name="cow-single">
          <LiveProjectionOnly
            v-if="!livePairSlides"
            slide-label
            :slide="liveSlide"
            :full-screen="false"
            :content-visible="true"
            :slide-styles="currentState.settings.slideStyles"
            :camera-mode="mobile ? 'placeholder' : 'preview'"
            class="lg-preview w-full h-full"
          />
        </Transition>
      </div>
    </div>

    <!-- CONTROLLED OUTPUT — which screen this device's taps land on. A phone
         has no projector of its own, so without this line an operator cannot
         tell whether taking a slide live moves the congregation screen or
         nothing at all. Hidden when no other device is offering an output. -->
    <div
      v-if="mobile && (hasRemoteTarget || availableHosts.length > 0)"
      class="controlled-output shrink-0 flex items-center gap-2.5 w-full rounded-xl border border-white/80 bg-white px-3 py-2 text-left dark:border-[#202838] dark:bg-[#171d2b]"
      role="button"
      tabindex="0"
      @click="liveMenuRef?.open()"
      @keydown.enter.prevent="liveMenuRef?.open()"
      @keydown.space.prevent="liveMenuRef?.open()"
    >
      <span
        class="w-2 h-2 rounded-full shrink-0"
        :class="
          isControllingRemoteHost
            ? 'bg-red-500'
            : hasRemoteTarget
            ? 'bg-amber-400'
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
              : hasRemoteTarget
              ? `Reconnecting to ${selectedHost?.userName || 'the output'}…`
              : "Not controlling a screen"
          }}
        </span>
        <span
          class="block text-[11px] text-gray-500 dark:text-[#6f7889] truncate"
        >
          {{
            isControllingRemoteHost
              ? targetHost?.deviceLabel
              : hasRemoteTarget
              ? "Slides are paused until that screen reconnects"
              : "Slides you take live only reach the livestream"
          }}
        </span>
      </span>
      <!-- The row is tappable anywhere, but a phone gives no hover to reveal
           that, so the action is also a real button with the solidity the rest
           of the app's buttons have. -->
      <CowButton
        variant="secondary"
        size="2xs"
        class="shrink-0 whitespace-nowrap !px-3 !py-1.5 text-xs"
        @click.stop="liveMenuRef?.open()"
      >
        {{ hasRemoteTarget ? "Change" : "Connect" }}
      </CowButton>
    </div>

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
            @click="goBlank"
          >
            <template #leading>
              <IconWrapper name="i-ph-eye-slash" size="3.5" />
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
                      ? 'i-ph-check-circle'
                      : 'i-ph-monitor'
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
                <IconWrapper name="i-ph-monitor" size="4" />
              </template>
              No output device online
            </UButton>

            <UButton
              v-if="hasRemoteTarget"
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
                <IconWrapper name="i-ph-link-break" size="4" />
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
                    : useGlobalEmit(appWideActions.showUpgradeModal, {
                        feature: 'livestream-url',
                      })
                }
              "
            >
              <template #leading>
                <IconWrapper
                  :name="
                    isClipboardCopying ? 'i-ph-check-circle' : 'i-ph-broadcast'
                  "
                  size="4"
                />
              </template>
              Copy livestream link
              <IconWrapper
                v-if="!canUseLivestreamLink"
                name="i-ph-crown-simple-fill"
                class="inline-flex w-4 h-4 text-xs text-[#FF8980]"
              />
              <template v-if="livestreamSessionsLabel" #trailing>
                <span
                  class="ms-auto text-[11px] font-normal tabular-nums text-gray-500 dark:text-[#9ba3b2]"
                >
                  {{ livestreamSessionsLabel.replace(" free sessions left", " left") }}
                </span>
              </template>
            </UButton>

            <UButton
              variant="ghost"
              color="gray"
              block
              @click.stop.prevent="
                () => {
                  close()
                  canUseStageStreamLink
                    ? copyStageStreamURL()
                    : useGlobalEmit(appWideActions.showUpgradeModal, {
                        feature: 'stagestream-url',
                      })
                }
              "
            >
              <template #leading>
                <IconWrapper
                  :name="
                    isStageLinkCopying ? 'i-ph-check-circle' : 'i-ph-link'
                  "
                  size="4"
                />
              </template>
              Copy stage display link
              <IconWrapper
                v-if="!canUseStageStreamLink"
                name="i-ph-crown-simple-fill"
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
                  goBlank()
                }
              "
            >
              <template #leading>
                <IconWrapper name="i-ph-eye-slash" size="4" />
              </template>
              Blank the live output
            </UButton>
          </template>
        </MoreActionsMenu>

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
        <CowDraggable
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
          :move="onScheduleSortMove"
          @end="onScheduleDragEnd"
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
                  isScheduleSlideLive(slide),
                  scheduleRowSlide(slide)?.id,
                  dropTargetId === slide?.id,
                  currentState.activeOverlaySlide?.id === slide?.id,
                  ctrlOrMetaActive,
                  openActionsSlideId === slide?.id,
                ]"
                :class="{
                  'ring-2 ring-primary-400': dropTargetId === slide?.id,
                  'bg-red-100 dark:bg-red-900': isScheduleSlideLive(slide),
                  'bg-cyan-100 dark:bg-cyan-950':
                    currentState.activeOverlaySlide?.id === slide?.id,
                }"
                @click="handleScheduleSlideAction(slide)"
                @dblclick="editSlide(slide)"
                @dragstart="onScheduleDragStart(slide)"
                @dragover="onScheduleRowDragOver($event, slide)"
                @drop.stop.prevent="handleDropOnScheduleSlide(slide)"
              >
                <!-- Held over the middle of a camera row: letting go pairs. -->
                <div
                  v-if="dropTargetId === slide?.id && draggingSlide?.type !== slideTypes.song"
                  class="absolute inset-0 z-10 flex items-center justify-center gap-1.5 rounded-lg bg-primary-600/60 text-white text-xs font-semibold pointer-events-none"
                >
                  <UIcon name="i-tabler-layout-columns" class="w-4 h-4" />
                  {{ appStore.pairForSlide(slide?.id) ? "Drop to replace" : "Drop to pair" }}
                </div>
                <!-- A pair shows as one row, previewing the member this window
                     is editing. -->
                <DeferredSlidePreview
                  preview-class="slide-preview w-24 min-w-24 h-16 text-white overflow-hidden sm-preview relative"
                  :slide="scheduleRowSlide(slide)"
                  :slide-label="scheduleRowSlide(slide)?.name"
                  :slide-styles="currentState.settings.slideStyles"
                  :eager="isScheduleSlideLive(slide)"
                />
                <div class="texts flex-col justify-between">
                  <h4
                    class="font-medium mt-2 overflow-hidden truncate w-40 2xl:w-56"
                  >
                    {{ scheduleRowSlide(slide)?.name }}
                  </h4>
                  <div class="flex items-center gap-1 mt-1">
                    <SlideChip
                      :slide-type="scheduleRowSlide(slide)?.type"
                      :slide-mode="scheduleRowSlide(slide)?.slideMode"
                    />
                    <CowTooltip
                      v-if="appStore.pairForSlide(slide?.id)"
                      text="Slide pair: both slides go live together"
                    >
                      <UIcon
                        name="i-tabler-layout-columns"
                        class="w-4 h-4 text-primary-500"
                      />
                    </CowTooltip>
                  </div>
                </div>
                <LiveSlideIndicator
                  :visible="
                    slide.slideMode !== 'overlay' && isScheduleSlideLive(slide)
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
                            useGlobalEmit(appWideActions.deleteSlide, scheduleRowSlide(slide))
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
                      @confirm="useGlobalEmit(appWideActions.deleteSlide, scheduleRowSlide(slide))"
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
        </CowDraggable>
      </div>
    </AppSection>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useOnline } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { appWideActions } from "~/utils/constants"
import type { Slide } from "~/types"
import {
  canBePairTarget,
  continueAsSolo,
  foldPairs,
  isCameraSlide,
  pairRejection,
} from "~/utils/slidePairs"
import { editingMemberOf, livePayloadForSlide } from "~/composables/useSlidePairs"
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

// A pair's row stands for the member it previews, so that is the one the row's
// edit and delete act on.
const editSlide = (slide: Slide) => {
  const target = scheduleRowSlide(slide)
  emit("edit-slide", target)
  useGlobalEmit(appWideActions.newActiveSlide, target)
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
  selectedHost,
  hasRemoteTarget,
  isControllingRemoteHost,
  connectToHost,
  stopControlling,
} = useLiveOutputControl()

const {
  canUseLivestreamLink,
  livestreamSessionsLabel,
  isClipboardCopying,
  copyLivestreamURL,
} = useLivestreamLink()
const { canUseStageStreamLink, isStageLinkCopying, copyStageStreamURL } =
  useStageStreamLink()

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
const openTranscripts = () => {
  // On mobile the transcript panel is a tab of its own, owned by the route, so
  // that the session survives the live sheet being closed. Opening a second
  // copy here would put two of them on the same microphone.
  if (props.mobile) return
  showTranscripts.value = true
}
emitter?.on(appWideActions.newTranscribe, openTranscripts)
onBeforeUnmount(() => emitter?.off(appWideActions.newTranscribe, openTranscripts))

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

// Built once per activeSlides mutation, in the store. The previous
// implementation ran Array.find for every live-output id, turning each verse
// update into an O(n²) schedule scan on larger services.
const activeSlidesById = computed(() => appStore.activeSlidesById)

const liveSlide = computed(() =>
  currentState.value.liveSlideId
    ? activeSlidesById.value.get(currentState.value.liveSlideId)
    : undefined
)

// What the thumbnail shows when a pair is on screen: the same payload the
// projector gets, built from this device's slides so an edit shows here the
// moment it is made.
const livePairPayload = computed<Slide[] | null>(() => {
  const live = liveSlide.value
  if (!live) return null
  const payload = livePayloadForSlide(live, { keepShape: true })
  return Array.isArray(payload) ? payload : null
})
// The last pair shown. When one of its slides goes on alone (the pair was
// unpaired, or its other slide deleted), the thumbnail carries on with that
// slide in place, as the projector does, instead of being rebuilt.
const lastLivePair = shallowRef<Slide[] | null>(null)
watch(
  livePairPayload,
  (payload) => {
    if (payload) lastLivePair.value = payload
  },
  { immediate: true }
)
watch(
  () => liveSlide.value?.id,
  (id) => {
    if (lastLivePair.value && !lastLivePair.value.some((member) => member.id === id)) {
      lastLivePair.value = null
    }
  }
)
const livePairSlides = computed<Slide[] | null>(
  () =>
    livePairPayload.value ??
    continueAsSolo(lastLivePair.value, liveSlide.value)
)

// A pair is one row in the schedule, headed by its first member. The row
// previews the member this window is editing, and is live while any member is.
const scheduleRowSlide = (slide: Slide) => {
  const pair = appStore.pairForSlide(slide?.id)
  return pair ? activeSlidesById.value.get(editingMemberOf(pair)) || slide : slide
}
// A slide that went live alone and was paired since is still on screen alone,
// and its pair's row is the live one.
const isScheduleSlideLive = (slide: Slide) => {
  const pair = appStore.pairForSlide(slide?.id)
  if (pair) {
    return (
      currentState.value.livePairId === pair.id ||
      pair.slideIds.includes(currentState.value.liveSlideId || "")
    )
  }
  return liveSlide.value?.id === slide?.id
}

const liveOutputSlides = computed({
  get() {
    const tempSlides = (currentState.value.liveOutputSlidesId ?? [])
      .map((id) => activeSlidesById.value.get(id))
      .filter((slide): slide is Slide => Boolean(slide))

    // Filter by current active schedule. A pair is one row, at its first
    // member's place in the schedule.
    return foldPairs(
      tempSlides.filter(
        (slide) => slide.scheduleId === currentState.value?.activeSchedule?._id
      ),
      appStore.pairForSlide
    )
  },
  set(newVal) {
    // The list folds a pair into its first member's row, so a reorder only
    // moves that one. Put the other members back straight after it, or the
    // setter would drop them from the schedule.
    const expanded: Slide[] = []
    newVal.forEach((slide) => {
      expanded.push(slide)
      appStore
        .pairForSlide(slide.id)
        ?.slideIds.filter((memberId) => memberId !== slide.id)
        .forEach((memberId) => {
          const member = activeSlidesById.value.get(memberId)
          if (member) expanded.push(member)
        })
    })
    // Set Index for each slide
    const tempSlides = expanded.map((slide, index) => ({
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

// The row that is live. A live pair's row is its first member, which need not
// be the live (active) slide.
const liveRowIndex = computed(() =>
  navigationSlides.value.findIndex((slide: Slide) => isScheduleSlideLive(slide))
)

const nextSlide = computed(() => {
  const liveSlideIndex = liveRowIndex.value
  // Nothing live in this list: Down must not jump to the top of the schedule.
  if (liveSlideIndex < 0) return undefined
  // const tempSlides = liveOutputSlidesId.value?.map((id) =>
  //   appStore.activeSlides.find((slide) => slide.id === id)
  // ) as Slide[]
  const gotoSlideIndex = (liveSlideIndex as number) + 1
  if (gotoSlideIndex < navigationSlides.value.length) {
    return navigationSlides.value[gotoSlideIndex]
  }
})

const previousSlide = computed(() => {
  const liveSlideIndex = liveRowIndex.value
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
      goBlank()
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
    useGlobalEmit(appWideActions.showUpgradeModal, {
      feature: appWideActions.showSlideOverlay,
    })
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

const goBlank = () => {
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
  if (appStore.pairForSlide(slide?.id)) {
    return "Click to take the pair live · Double-click to edit"
  }
  if (canBePairTarget(slide)) {
    return "Click to take live · Double-click to edit · Drop a slide here to pair it"
  }
  return "Click to take live · Double-click to edit"
}

const handleScheduleSlideAction = (slide: Slide) => {
  if (slide.slideMode === "overlay") {
    toggleSlideOverlay(slide)
    return
  }
  // A pair's row takes the pair live, driven by the slide that is not the
  // camera (see projectLiveSlide).
  setLiveSlide(scheduleRowSlide(slide).id)
}

// The list is also sortable, and Sortable moves rows under the pointer as a
// drag passes over them. Over the middle half of a row that would take the
// dragged slide (a camera to pair with, or a setlist for a song), the row is
// held still so the drop lands on it; over its top or bottom quarter the drag
// reorders as usual, so a slide can still be moved past a camera.
const dropTargetId = ref<string | null>(null)
const onScheduleDragStart = (slide: Slide) => {
  draggingSlide.value = slide
  dropTargetId.value = null
}

const acceptsScheduleDrop = (target: Slide | undefined, source: Slide | null) => {
  if (!target || !source || target.id === source.id) return false
  if (target.type === slideTypes.songSetlist && source.type === slideTypes.song) {
    return true
  }
  const pair = appStore.pairForSlide(target.id)
  if (pair) {
    // A pair with one camera: the dropped slide replaces the camera's partner.
    const cameras = pair.slideIds.filter((id) =>
      isCameraSlide(activeSlidesById.value.get(id))
    )
    return (
      cameras.length === 1 &&
      !pair.slideIds.includes(source.id) &&
      source.slideMode !== "overlay" &&
      !appStore.pairForSlide(source.id)
    )
  }
  return canBePairTarget(target) && !pairRejection(target, source, appStore.pairForSlide)
}

const onScheduleSortMove = (
  evt: {
    related?: HTMLElement
    relatedContext?: { element?: Slide }
  },
  originalEvent?: MouseEvent
) => {
  const target = evt.relatedContext?.element
  if (acceptsScheduleDrop(target, draggingSlide.value) && evt.related && originalEvent) {
    const box = evt.related.getBoundingClientRect()
    const y = originalEvent.clientY - box.top
    if (y > box.height * 0.25 && y < box.height * 0.75) {
      dropTargetId.value = target!.id
      return false
    }
  }
  dropTargetId.value = null
  return true
}

const onScheduleRowDragOver = (event: DragEvent, slide: Slide) => {
  if (dropTargetId.value !== slide?.id) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = "link"
}

const onScheduleDragEnd = () => {
  draggingSlide.value = null
  dropTargetId.value = null
}

const handleDropOnSetlist = (targetSlide: Slide, source: Slide) => {
  if (
    targetSlide?.type !== slideTypes.songSetlist ||
    source.type !== slideTypes.song ||
    source.id === targetSlide.id
  ) {
    return false
  }

  useGlobalEmit(appWideActions.addSongSlideToSetlist, {
    setlistSlide: targetSlide,
    songSlide: source,
  })
  return true
}

// A song dropped on a setlist joins it. A slide let go over the middle of a
// camera row pairs with that camera; over a pair's row, it takes the place of
// the camera's partner.
const handleDropOnScheduleSlide = (targetSlide: Slide) => {
  const source = draggingSlide.value
  const heldOver = dropTargetId.value
  onScheduleDragEnd()
  if (!source || handleDropOnSetlist(targetSlide, source)) return
  if (heldOver !== targetSlide.id || source.id === targetSlide.id) return
  const pair = appStore.pairForSlide(targetSlide.id)
  if (!pair) {
    const rejection = pairRejection(targetSlide, source, appStore.pairForSlide)
    if (rejection) {
      toast.add({ title: rejection, icon: "i-tabler-layout-columns", color: "amber" })
      return
    }
  }
  useGlobalEmit(
    appWideActions.pairSlides,
    pair
      ? { pairId: pair.id, sourceId: source.id }
      : { targetId: targetSlide.id, sourceId: source.id }
  )
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
