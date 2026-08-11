<template>
  <div ref="previewColumn" class="preview-column flex flex-col h-full min-w-0">
    <AppSection
      heading="Preview and Edit Content"
      :secondary-buttons="[
        {
          label: 'Select Slides',
          action: appWideActions.selectSlides,
          icon: '',
          color: 'primary',
          confirmAction: false,
          visible: !bulkSelectSlides,
        },
        {
          label: 'Select All',
          action: appWideActions.selectAllSlides,
          icon: 'i-bx-checkbox',
          color: 'primary',
          confirmAction: false,
          visible: bulkSelectSlides,
        },
        {
          label: 'Cancel',
          action: appWideActions.cancelSelectSlides,
          icon: 'i-mdi-close',
          color: 'gray',
          confirmAction: false,
          visible: bulkSelectSlides,
        },
        {
          label: 'Delete Slides',
          action: 'delete-selected-slides',
          color: 'red',
          confirmAction: true,
          visible: bulkSelectedSlides.length > 0,
        },
      ]"
      :style="{ height: previewHeight + 'px', flexShrink: 0 }"
      class="min-h-0"
      @delete-selected-slides="deleteMultipleSlides(bulkSelectedSlides)"
    >
      <div
        ref="slidesScroll"
        class="slides-ctn relative overflow-y-scroll rounded-lg transition flex-1 min-h-0 bg-gray-100 dark:bg-[#222938] touch-pan-y"
        :class="[slides?.length === 0 ? '' : 'p-2']"
        @scroll.passive="onSlidesGridScroll"
        @dragenter="onMediaDragEnter"
        @dragover="onMediaDragOver"
        @dragleave="onMediaDragLeave"
        @drop="onMediaDrop"
      >
        <EmptyState
          v-if="isDraggingMediaFile"
          tinted
          icon="i-bx-cloud-upload"
          sub="Drop to add as media slide"
          class="absolute inset-0 z-20 pointer-events-none"
        />
        <div v-if="isLoadingSlides" class="grid slides-grid gap-3">
          <CowSkeleton variant="grid" :count="10" />
        </div>
        <div v-else-if="slides?.length > 0" class="virtual-slides-grid">
          <div :style="{ height: `${virtualTopSpacer}px` }" />
          <div ref="slidesGrid" class="grid slides-grid gap-3">
            <SlideCard
              v-for="{ slide, index } in virtualSlides"
              :key="slide.id"
              v-memo="[
                slide.id,
                slide.updatedAt,
                slide.name,
                activeSlide?.id === slide?.id,
                bulkSelectSlides,
                bulkSelectedSlides.includes(slide?.id),
                getSlideEditor(slide.id)?.userId,
                currentState.activeOverlaySlide?.id === slide.id,
              ]"
              :slide="slide"
              :live="false"
              :selectable="bulkSelectSlides"
              :id="slide?.id?.replace(/\d+/g, '')"
              :checkbox-selected="bulkSelectedSlides.includes(slide?.id)"
              :editing-by="getSlideEditor(slide.id)"
              grid-type
              :selected="activeSlide?.id === slide?.id"
              @click="
                bulkSelectSlides
                  ? null
                  : makeSlideActive(slide, {
                      goLive: false,
                      newlyCreated: false,
                    })
              "
              @take-live="bulkSelectSlides ? null : handleTakeLiveAction(slide)"
              @duplicate="duplicatePreviewSlide"
              @duplicate-as-overlay="duplicatePreviewSlideAsOverlay"
              @show-overlay="showSlideOverlay"
              @clear-overlay="clearSlideOverlay"
              @delete="deleteSlide"
              @save-slide="saveSlide(slide)"
              @save-as-template="openSaveTemplateModal(slide)"
              @bulk-selected="addToSelectedSlides(slide?.id, $event)"
            />
          </div>
          <div :style="{ height: `${virtualBottomSpacer}px` }" />
        </div>
        <EmptyState
          v-else
          icon="i-tabler-device-desktop-plus"
          svg-icon="NoSlidesIcon"
          sub="No slides yet"
          :action="appWideActions.newBible"
          action-data="23:43:19"
          action-text="Create new slide"
        />
      </div>
    </AppSection>

    <div
      class="v-resize-handle h-3 shrink-0 rounded cursor-ns-resize opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startVResize($event)"
    />

    <AppSection class="flex-1 min-h-0" slot-ctn-styles="!p-0">
      <EditLiveContent
        :slide="activeSlide"
        :editing-by="
          activeSlide?.id ? getSlideEditor(activeSlide.id) : undefined
        "
        @slide-update="onUpdateSlide"
        @inactive-slide-update="onUpdateInactiveSlide"
        @goto-verse="gotoAction"
        @update-bible-version="gotoAction(activeSlide?.title!!, $event)"
        @take-live="handleTakeLiveAction(activeSlide!!)"
      />
    </AppSection>

    <SaveAsTemplateModal
      v-model="showSaveTemplateModal"
      :slide="slideToSaveAsTemplate"
    />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useThrottleFn, useOnline } from "@vueuse/core"
import { go } from "fuzzysort"
import type { Emitter } from "mitt"
import { tabSessionId } from "~/composables/useRealtimeSlides"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  Hymn,
  Scripture,
  Slide,
  Song,
  Countdown,
  Schedule,
  ExtendedFileT,
  PresentationObject,
} from "~/types"
import { toTransportSafePayload } from "~/utils/mediaTransport"
import { appWideActions } from "~/utils/constants"
import {
  getAPIErrorMessage,
  isNetworkError,
  isNotFoundError,
} from "~/utils/apiErrors"

// Incoming realtime slide events are handled once, centrally, in pages/index.vue
// (via useRealtimeSlides wired to the live socket). That handler mutates the
// shared Pinia store, which this component reads reactively — so there is no
// separate socket subscription here. A local onAny() listener used to live here
// but it double-processed every message and went stale after reconnects.

const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()
const { applyOverlaySettings } = useOverlaySettings()
const churchId = authStore.user?.churchId
const lastSelectedScheduleId = ref(
  appStore.currentState.activeSchedule?._id ?? null
)

// Composables
const {
  slides,
  updateLiveOutput,
  batchCreateSlides,
  updateSlide: updateSlideAPI,
  deleteSlide: deleteSlideAPI,
  batchUpdateSlides,
} = useSlides()
const { getLibraryItem } = useLibrary()
const { createSchedule } = useSchedules()
const {
  createTextSlide,
  createBibleSlide,
  createHymnSlide,
  createSongSlide,
  createSongSetlistSlide,
  createMediaSlide,
  createMultipleMediaSlides,
  createPresentationSlide,
  createCountdownSlide,
  createTimeSlide,
  saveSlideToLib,
  duplicateSlide,
  duplicateSlideAsOverlay,
} = useSlideCreation()
const { gotoVerse } = useSlideNavigation()
const { appendSongToSetlist } = useSongSetlist()

// Online status for conditional API/WS calls
const online = useOnline()

// Drag-and-drop media files onto the slide grid — mirrors the AddMedia.vue flow
const maxDroppedImageSize = computed(() => Infinity)
const maxDroppedVideoSize = computed(() => Infinity)
const isDraggingMediaFile = ref(false)
let mediaDragCounter = 0

const isFileDrag = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types || []).includes("Files")

const onMediaDragEnter = (event: DragEvent) => {
  if (!isFileDrag(event)) return
  mediaDragCounter++
  isDraggingMediaFile.value = true
}

const onMediaDragOver = (event: DragEvent) => {
  if (!isFileDrag(event)) return
  event.preventDefault()
}

const onMediaDragLeave = (event: DragEvent) => {
  if (!isFileDrag(event)) return
  mediaDragCounter = Math.max(0, mediaDragCounter - 1)
  if (mediaDragCounter === 0) isDraggingMediaFile.value = false
}

const onMediaDrop = (event: DragEvent) => {
  if (!isFileDrag(event)) return
  event.preventDefault()
  mediaDragCounter = 0
  isDraggingMediaFile.value = false

  const droppedFiles = Array.from(event.dataTransfer?.files || [])
  if (droppedFiles.length === 0) return

  const validFiles: File[] = []
  droppedFiles.forEach((file) => {
    if (
      file.type.startsWith("image") &&
      file.size > maxDroppedImageSize.value * 1024 * 1024
    ) {
      toast.add({
        title: `Image size exceeds ${maxDroppedImageSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    if (
      file.type.startsWith("video") &&
      file.size > maxDroppedVideoSize.value * 1024 * 1024
    ) {
      toast.add({
        title: `Video size exceeds ${maxDroppedVideoSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    if (!/^(image|video|audio)/.test(file.type)) return
    validFiles.push(file)
  })
  if (validFiles.length === 0) return

  // Same shape AddMedia.vue's addMediaEmitter builds for regular files.
  // fromDrop tells QuickActions.vue not to switch its panel to the Add Media
  // page — the slides are already created, no need to navigate there too.
  const mediaFiles = validFiles.map((file) => ({
    blob: file,
    name: file.name,
    size: file.size,
    type: file.type?.split("/")?.[0],
    url: URL.createObjectURL(file),
    fromDrop: true,
  })) as unknown as ExtendedFileT[]

  useGlobalEmit(appWideActions.newMedia, mediaFiles)
}

/**
 * Send slide update via Socket.IO for realtime collaboration
 * Only sends when online. Includes tabId to allow same user on different tabs/devices to receive updates
 */
const broadcastSlideUpdate = async (action: string, data: any) => {
  // Don't broadcast when offline
  if (!online.value) return

  const nuxtApp = useNuxtApp()
  if (!(nuxtApp.$socketio as any)?.connected) return

  // Stripping device-only media URLs reads IndexedDB, so the socket can be torn
  // down (schedule switch, reconnect, unmount) while we await. Re-read
  // `$socketio` afterwards instead of holding the pre-await reference — the
  // proxy behind it points at whichever socket is live *now*.
  const safeData = await toTransportSafePayload(data)
  const socket = nuxtApp.$socketio as any
  if (!socket?.connected) return
  socket.emit(action, { ...safeData, tabId: tabSessionId })
}

/**
 * Broadcast a single slide creation for immediate real-time feedback
 */
const broadcastSlideCreated = (slide: any) => {
  broadcastSlideUpdate("create-slide", slide)
}

/**
 * Get the user currently editing a slide (if any)
 */
const getSlideEditor = (
  slideId: string
):
  | { userId: string; userName: string; avatar?: string; theme?: string }
  | undefined => {
  const editInfo = appStore.currentState.slidesBeingEdited?.[slideId]
  if (editInfo && editInfo.userId !== authStore.user?._id) {
    return editInfo
  }
  return undefined
}

// --- Collaborative on-slide presence ("X is on this slide") ---
// Announced when a user lands on a slide (and re-affirmed on edit), so peers
// see an avatar on a slide someone is already working on. We announce ONCE per
// slide (not per keystroke): the cheap `editingSlideId.value === slideId` guard
// makes repeat calls a single string compare with no socket traffic. While on
// the slide we refresh every 20s — comfortably under the 35s auto-expiry on the
// receive side — so one session is ~1 frame + a heartbeat, not a flood. Peers
// populate `slidesBeingEdited` from the `slide-editing` event (carrying avatar
// + theme; see useRealtimeSlides).
// NOTE: this relies on the server relaying `slide-editing` to room peers.
const editingSlideId = ref<string | null>(null)
let presenceRefreshTimer: ReturnType<typeof setInterval> | null = null

const emitEditingPresence = (slideId: string) => {
  if (!online.value) return
  const socket = useNuxtApp().$socketio as any
  if (!socket?.connected) return
  socket.emit("slide-editing", {
    slideId,
    userId: authStore.user?._id,
    userName: authStore.user?.fullname,
    avatar: authStore.user?.avatar,
    // Normalize to a single leading '#' so peers can use it directly as a CSS color.
    theme: authStore.user?.theme
      ? `#${String(authStore.user.theme).replace(/^#+/, "")}`
      : undefined,
    tabId: tabSessionId,
  })
}

const announceEditing = (slideId?: string) => {
  if (!slideId || editingSlideId.value === slideId) return
  stopEditing()
  editingSlideId.value = slideId
  emitEditingPresence(slideId)
  presenceRefreshTimer = setInterval(() => {
    if (editingSlideId.value) emitEditingPresence(editingSlideId.value)
  }, 20000)
}

const stopEditing = () => {
  if (presenceRefreshTimer) {
    clearInterval(presenceRefreshTimer)
    presenceRefreshTimer = null
  }
  if (editingSlideId.value) {
    // Best-effort instant clear on peers; if it isn't relayed, their copy
    // self-expires after 35s.
    if (online.value) {
      const socket = useNuxtApp().$socketio as any
      if (socket?.connected) {
        socket.emit("unlock-slide", {
          slideId: editingSlideId.value,
          tabId: tabSessionId,
        })
      }
    }
    editingSlideId.value = null
  }
}

// Countdown state - kept in component for tight coupling with slide updates
const activeCountdownInterval = ref<any>(null)
const activeCountdownSlideId = ref<string | null>(null)
const countdownTimeLeft = ref<number>(0)
const countdownStartTime = ref<number>(0)
const countdownDuration = ref<number>(0)
const countdownRAF = ref<number>(0)

// Vertical resize between "Preview and Edit Content" and "Edit Content" sections.
// The split is a fraction of the available column height, so the editor below
// stays visible on short screens instead of being pushed off the bottom.
const { panelBounds, panelSize, commitPanelSize } = usePanelLayout()
const previewBounds = panelBounds("previewHeight")
const previewLayoutHeight = panelSize("previewHeight")
const previewHeight = ref(previewLayoutHeight.value)
const previewColumn = ref<HTMLDivElement | null>(null)
let vResizeStartY = 0
let vResizeStartHeight = 0
let isVResizing = false

watch(previewLayoutHeight, (height) => {
  if (!isVResizing) previewHeight.value = height
})

const startVResize = (event: MouseEvent) => {
  isVResizing = true
  vResizeStartY = event.clientY
  vResizeStartHeight = previewHeight.value
  document.addEventListener("mousemove", onVResizeMove)
  document.addEventListener("mouseup", onVResizeEnd)
  document.body.style.cursor = "ns-resize"
  document.body.style.userSelect = "none"
}
const onVResizeMove = (event: MouseEvent) => {
  const delta = event.clientY - vResizeStartY
  const { min, max } = previewBounds.value
  previewHeight.value = Math.min(max, Math.max(min, vResizeStartHeight + delta))
}
const onVResizeEnd = () => {
  isVResizing = false
  commitPanelSize("previewHeight", previewHeight.value)
  document.removeEventListener("mousemove", onVResizeMove)
  document.removeEventListener("mouseup", onVResizeEnd)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

// Component state
const windowHeight = ref<number>(0)
const activeSlide = ref<Slide>()
const { currentState } = storeToRefs(appStore)
// Drives the slide-grid skeleton. Kept separate from appStore.slidesLoading
// (which only tracks the network request) so the skeleton stays up through
// the local `slides` ref sync + grid render that happens after the fetch
// resolves, not just the fetch itself.
const isLoadingSlides = ref(false)
const slidesGrid = ref<HTMLDivElement | null>(null)
const slidesScroll = ref<HTMLDivElement | null>(null)
const bulkSelectSlides = ref<boolean>(false)
const bulkSelectedSlides = ref<string[]>([])
const slideGridColumns = ref(1)
const slideVirtualStartRow = ref(0)
const slideViewportHeight = ref(0)
// Grid geometry is measured from the DOM (see updateSlideGridMetrics) because
// the card width and height both shrink on short viewports. These are only the
// fallbacks used before the first measurement lands.
const slideCardRowHeight = ref(132)
const slideGridGap = 12
const slideMinCardWidth = 170
const slideOverscanRows = 3
let slidesResizeObserver: ResizeObserver | null = null

// Save as Template Modal
const showSaveTemplateModal = ref(false)
const slideToSaveAsTemplate = ref<Slide | null>(null)

const makeSlideActive = (
  slide: Slide,
  options?: {
    goLive: boolean
    newlyCreated: boolean
  }
) => {
  activeSlide.value = slide
  if (options?.newlyCreated) {
    appStore.appendActiveSlide(slide)
  }
  if (options?.goLive) {
    updateLiveOutput(activeSlide.value, { forceGoLive: true })
  }
}

const updateBibleSlideFromScripture = (
  slide: Slide,
  scripture: Scripture
): Slide => {
  const updatedSlide = { ...slide }
  updatedSlide.title = scripture.label
  updatedSlide.data = scripture
  updatedSlide.slideStyle = {
    ...updatedSlide.slideStyle,
    fontSize: Number(useScreenFontSize(scripture.content as string)),
  }
  updatedSlide.contents = useSlideContent(updatedSlide, scripture)
  updatedSlide.name = useSlideName(updatedSlide)
  return updatedSlide
}

const duplicatePreviewSlide = (slide: Slide) => {
  const newSlide = duplicateSlide(slide)
  if (!newSlide) return

  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  uploadOfflineSlides()
}

const duplicatePreviewSlideAsOverlay = (slide: Slide) => {
  const newSlide = duplicateSlideAsOverlay(slide)
  if (!newSlide) return

  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
}

const showSlideOverlay = (
  slide: Slide,
  options: { capture?: boolean } = { capture: true }
) => {
  const overlaySlide = applyOverlaySettings(slide)
  appStore.setActiveOverlaySlide(overlaySlide)
  useBroadcastOverlayPost(appWideActions.showSlideOverlay, overlaySlide)
  broadcastSlideUpdate(appWideActions.showSlideOverlay, overlaySlide)
  if (options.capture !== false) {
    usePosthogCapture("SLIDE_OVERLAY_SHOWN", {
      slideId: slide.id,
      slideType: slide.type,
    })
  }
}

const clearSlideOverlay = () => {
  appStore.setActiveOverlaySlide(null)
  useBroadcastOverlayPost(appWideActions.removeSlideOverlay)
  broadcastSlideUpdate(appWideActions.removeSlideOverlay, {})
  usePosthogCapture("SLIDE_OVERLAY_CLEARED")
}

const { isLocalMediaReady, transferFor } = useMediaDownloadProgress()
const projectionMediaStorage = useLocalMediaStorage()
const { rehydrateSlideMedia: prepareSlideMediaForProjection } =
  useSlideMediaCache()

const handleTakeLiveAction = async (slide: Slide) => {
  const requiredKeys = [
    ...(slide.type === slideTypes.media ||
    slide.type === slideTypes.presentation
      ? [slide.id]
      : []),
    ...(slide.backgroundVideoKey ? [slide.backgroundVideoKey] : []),
    ...(slide.backgroundImageKey ? [slide.backgroundImageKey] : []),
  ]
  const blockedKey = requiredKeys.find((key) => !isLocalMediaReady(key))
  if (blockedKey) {
    const transfer = transferFor(blockedKey)
    toast.add({
      title:
        transfer?.status === "failed"
          ? "Media is not saved locally"
          : "Media is still being saved",
      description:
        transfer?.status === "failed"
          ? "Retry or remove this media before taking it live."
          : "Wait for local storage to finish before taking it live.",
      icon: "i-bx-error",
      color: "red",
    })
    return
  }

  const externalType = (slide.data as any)?.type
  const localKeys = [
    ...(slide.type === slideTypes.media &&
    externalType !== "youtube" &&
    externalType !== "vimeo"
      ? [slide.id]
      : []),
    ...(slide.type === slideTypes.presentation
      ? (slide.presentationObjects || []).map(
          (page) => `${slide.id}-page-${page.page}`
        )
      : []),
    ...(slide.backgroundVideoKey ? [slide.backgroundVideoKey] : []),
    ...(slide.backgroundImageKey ? [slide.backgroundImageKey] : []),
  ]

  if (localKeys.length) {
    await prepareSlideMediaForProjection(slide, { allowDownload: true })

    // Rehydration rewrites the slide's URLs in place, so read the URL each key
    // resolves to only after it has run.
    const remoteFallbackFor = (key: string) => {
      const pagePrefix = `${slide.id}-page-`
      if (key.startsWith(pagePrefix)) {
        const page = Number(key.slice(pagePrefix.length))
        return slide.presentationObjects?.find((obj) => obj.page === page)
          ?.imageUrl
      }
      if (key === slide.id) {
        return (slide.data as ExtendedFileT)?.url || slide.background
      }
      return slide.background
    }
    const isRemoteUrl = (url?: string | null) =>
      !!url && (url.startsWith("http://") || url.startsWith("https://"))

    // A missing local copy is only fatal when there is nothing else to project.
    // The live window rehydrates (and caches) media on arrival, so a remote URL
    // still projects — it just streams the first time. Blocking on the local
    // copy alone rejected ordinary slides: every song/bible/hymn slide inherits
    // `backgroundImageKey` from the default background settings, so a key added
    // on another device (or evicted here) stopped an otherwise fine slide from
    // going live, while the same slide went live from the schedule list, which
    // never ran this check.
    const unprojectable = await Promise.all(
      localKeys.map(async (key) => {
        if (await projectionMediaStorage.getPlaybackUrl(key)) return null
        return isRemoteUrl(remoteFallbackFor(key)) ? null : key
      })
    )
    if (unprojectable.some(Boolean)) {
      toast.add({
        title: "Media is not available on this device",
        description:
          "This media hasn't synced here yet. Reconnect the device that added it, or re-add the file.",
        icon: "i-bx-error",
        color: "red",
      })
      return
    }
    appStore.updateSlideInActiveSlides(slide)
  }

  if (slide.slideMode === "overlay") {
    if (appStore.currentState.activeOverlaySlide?.id === slide.id) {
      clearSlideOverlay()
    } else {
      showSlideOverlay(slide)
    }
    return
  }

  makeSlideActive(slide, { goLive: true, newlyCreated: false })
}

onMounted(() => {
  windowHeight.value = document.documentElement.offsetHeight
  addEventListener("resize", () => {
    windowHeight.value = document.documentElement.offsetHeight
    updateSlideGridMetrics()
  })
  nextTick(() => {
    updateSlideGridMetrics()
    if (slidesScroll.value) {
      slidesResizeObserver = new ResizeObserver(updateSlideGridMetrics)
      slidesResizeObserver.observe(slidesScroll.value)
    }
  })
  uploadOfflineSlides()
})

onBeforeUnmount(() => {
  // Not persisted here — onVResizeEnd already commits, and saving on unmount
  // would mark a viewport-derived height as user-chosen.
  slidesResizeObserver?.disconnect()
  slidesResizeObserver = null
  stopEditing()
  document.removeEventListener("mousemove", onVResizeMove)
  document.removeEventListener("mouseup", onVResizeEnd)
})

// Move presence with the user's active slide: release the slide they left and
// announce the one they're now on, so peers see an avatar on the slide someone
// is sitting on (not just when actively typing).
watch(
  () => activeSlide.value?.id,
  (newId, oldId) => {
    if (newId === oldId) return
    stopEditing()
    if (newId) announceEditing(newId)
  }
)

const updateSlideGridMetrics = () => {
  const scrollEl = slidesScroll.value
  if (!scrollEl) return

  slideViewportHeight.value = scrollEl.clientHeight

  // Read the resolved grid rather than re-deriving it from a fixed card width:
  // `.slides-grid` narrows its columns on short viewports, so a hardcoded
  // 170px would put the virtualiser's row maths out of step with the layout.
  const gridEl = slidesGrid.value
  const templateColumns = gridEl
    ? getComputedStyle(gridEl).gridTemplateColumns
    : ""
  const measuredColumns = templateColumns.includes("px")
    ? templateColumns.split(/\s+/).filter(Boolean).length
    : 0
  slideGridColumns.value = Math.max(
    1,
    measuredColumns ||
      Math.floor(
        (scrollEl.clientWidth + slideGridGap) /
          (slideMinCardWidth + slideGridGap)
      )
  )

  const cardHeight =
    (gridEl?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0
  if (cardHeight > 0) {
    slideCardRowHeight.value = Math.round(cardHeight + slideGridGap)
  }

  slideVirtualStartRow.value = Math.floor(
    scrollEl.scrollTop / slideCardRowHeight.value
  )
}

const onSlidesGridScroll = () => {
  const scrollEl = slidesScroll.value
  if (!scrollEl) return
  slideVirtualStartRow.value = Math.floor(
    scrollEl.scrollTop / slideCardRowHeight.value
  )
}

const totalSlideRows = computed(() => {
  return Math.ceil((slides.value?.length || 0) / slideGridColumns.value)
})

const virtualStartRow = computed(() => {
  return Math.max(0, slideVirtualStartRow.value - slideOverscanRows)
})

const virtualVisibleRows = computed(() => {
  return (
    Math.ceil(slideViewportHeight.value / slideCardRowHeight.value) +
    slideOverscanRows * 2
  )
})

const virtualEndRow = computed(() => {
  return Math.min(
    totalSlideRows.value,
    virtualStartRow.value + virtualVisibleRows.value
  )
})

const virtualSlides = computed(() => {
  const startIndex = virtualStartRow.value * slideGridColumns.value
  const endIndex = Math.min(
    slides.value?.length || 0,
    virtualEndRow.value * slideGridColumns.value
  )

  return (slides.value || [])
    .slice(startIndex, endIndex)
    .map((slide, offset) => ({
      slide,
      index: startIndex + offset,
    }))
})

const virtualTopSpacer = computed(
  () => virtualStartRow.value * slideCardRowHeight.value
)
const virtualBottomSpacer = computed(() => {
  return Math.max(
    0,
    (totalSlideRows.value - virtualEndRow.value) * slideCardRowHeight.value
  )
})

const scrollToSlide = (slideId?: string) => {
  const scrollEl = slidesScroll.value
  if (!scrollEl || !slideId) return

  const slideIndex = slides.value.findIndex((slide) => slide.id === slideId)
  if (slideIndex < 0) return

  const row = Math.floor(slideIndex / slideGridColumns.value)
  const top = row * slideCardRowHeight.value

  if (
    top < scrollEl.scrollTop ||
    top + slideCardRowHeight.value > scrollEl.scrollTop + scrollEl.clientHeight
  ) {
    scrollEl.scrollTop = top
    onSlidesGridScroll()
  }
}

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("new-slide", () => {
  const newSlide = createTextSlide()
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  uploadOfflineSlides()
})

emitter.on(appWideActions.newTimeSlide, () => {
  const newSlide = createTimeSlide()
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
})

emitter.on("new-text", (slide: Slide[] | Slide) => {
  let newSlide: Slide | null
  if (slide) {
    const sourceSlide = Array.isArray(slide) ? slide[0] : slide
    newSlide = sourceSlide ? duplicateSlide(sourceSlide) : null
  } else {
    newSlide = createTextSlide()
  }
  if (!newSlide) return

  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  // Broadcast slide creation immediately for real-time sync
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
})

emitter.on("new-bible", async (data: string) => {
  if (data) {
    const scripture = await useScripture(data)
    if (scripture) {
      const newSlide = createBibleSlide(scripture)
      slides.value?.push(newSlide)
      makeSlideActive(newSlide, {
        goLive: true,
        newlyCreated: true,
      })
      appStore.setRecentBibleSearches(data)
      // Broadcast slide creation immediately for real-time sync
      broadcastSlideCreated(newSlide)
      uploadOfflineSlides()
    }
  }
})

emitter.on("update-or-create-bible", async (data: string) => {
  if (!data) return

  // Find any existing Bible slide (prefer the live one)
  const existingBibleSlide =
    slides.value?.find(
      (s: Slide) =>
        s.type === slideTypes.bible && s.id === currentState.value?.liveSlideId
    ) || slides.value?.find((s: Slide) => s.type === slideTypes.bible)

  // Resolve the shortLabel to a scripture object — needed for both paths
  // to get the human-readable label (e.g. "Genesis 28:19") that gotoVerse expects.
  const scripture = await useScripture(data)
  if (!scripture) return

  if (existingBibleSlide) {
    const updatedSlide = updateBibleSlideFromScripture(
      existingBibleSlide,
      scripture
    )
    const slideIndex = slides.value.findIndex(
      (s: Slide) => s.id === updatedSlide.id
    )
    if (slideIndex < 0) return
    slides.value.splice(slideIndex, 1, updatedSlide)
    makeSlideActive(updatedSlide, { goLive: true, newlyCreated: false })
    updateSlideOnline(updatedSlide)
  } else {
    const newSlide = createBibleSlide(scripture)
    slides.value?.push(newSlide)
    makeSlideActive(newSlide, { goLive: true, newlyCreated: true })
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
  appStore.setRecentBibleSearches(data)
})

emitter.on("new-bible-whole-search", async (data: string) => {
  const scripture = await useScripture(data)
  if (scripture) {
    const newSlide = createBibleSlide(scripture, { fromWholeBibleSearch: true })
    slides.value?.push(newSlide)
    makeSlideActive(newSlide, {
      goLive: false,
      newlyCreated: true,
    })
    appStore.setRecentBibleSearches(data)
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

emitter.on("new-hymn", async (data: string) => {
  const hymn = await useHymn(data)
  if (hymn) {
    const newSlide = createHymnSlide(hymn)
    slides.value?.push(newSlide)
    makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

emitter.on(appWideActions.newSongSetlist, async (song?: Song) => {
  const resolvedSong = song ? await useSong(song) : undefined
  const newSlide = await createSongSetlistSlide(resolvedSong || undefined)
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
})

const getRelevantSongSetlist = () => {
  if (activeSlide.value?.type === slideTypes.songSetlist) {
    return activeSlide.value
  }
  return slides.value?.find((slide) => slide.type === slideTypes.songSetlist)
}

const addSongAsSeparateSlide = (song: Song) => {
  const newSlide = createSongSlide(song)
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  saveSlide(newSlide)
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
}

const addSongToSetlist = async (setlistSlide: Slide, song: Song) => {
  const updatedSlide = await appendSongToSetlist(setlistSlide, song)
  if (!updatedSlide) return

  const slideIndex = slides.value.findIndex((s) => s.id === updatedSlide.id)
  if (slideIndex >= 0) {
    slides.value.splice(slideIndex, 1, updatedSlide)
  }
  makeSlideActive(updatedSlide, { goLive: false, newlyCreated: false })
  updateLiveOutput(updatedSlide)
  updateSlideOnline(updatedSlide)
  toast.add({
    icon: "i-lucide-list-music",
    title: `${song.title} added to setlist`,
  })
}

emitter.on("new-song", async (data: Song) => {
  if (data) {
    const song = await useSong(data)
    if (song) {
      const setlistSlide = getRelevantSongSetlist()

      if (setlistSlide) {
        addSongToSetlist(setlistSlide, song)
      } else {
        addSongAsSeparateSlide(song)
      }
    }
  }
})

emitter.on("new-song-search", (query: string) => {
  // Do nothing
})

emitter.on("new-media", async (data: ExtendedFileT[]) => {
  if (data && data?.length > 0) {
    let newSlides: Slide[]

    if (
      (data?.[0] as ExtendedFileT & { fromTemplate?: boolean })?.fromTemplate
    ) {
      newSlides = data as unknown as Slide[]
      newSlides.forEach((slide) => {
        delete slide._id
        slide.id = useObjectID()
      })
    } else {
      newSlides = createMultipleMediaSlides(data)
    }

    // Append new slides immediately so the current user sees them right away
    newSlides.forEach((slide) => {
      slides.value?.push(slide)
      appStore.appendActiveSlide(slide)
    })

    // NOTE: Do NOT call uploadOfflineSlides() here for media slides.
    // createMultipleMediaSlides handles: upload → patch URLs → batchCreateSlides
    // → socket broadcast entirely in its own background flow. Calling
    // uploadOfflineSlides() here would race against that flow and send
    // batchCreateSlides with blob: URLs before the images have been uploaded.
  }
})

emitter.on(
  "new-presentation",
  async (data: {
    fileName?: string
    presentationObjects?: PresentationObject[]
    fromImport?: boolean
  }) => {
    if (!data?.presentationObjects?.length || !data.fileName) return

    const newSlide = createPresentationSlide(
      data.fileName,
      data.presentationObjects
    )

    slides.value?.push(newSlide)
    appStore.appendActiveSlide(newSlide)
  }
)

emitter.on("new-active-slide", (data: Slide) => {
  if (data) {
    makeSlideActive(data, { goLive: false, newlyCreated: true })
  }
})

emitter.on("new-countdown", (data: Countdown) => {
  if (data) {
    // Remove existing countdown slides
    const tempSlides = slides.value?.filter(
      (slide) =>
        slide.type !== slideTypes.countdown || slide.slideMode === "overlay"
    )
    slides.value = tempSlides
    stopCountdown()

    const newSlide = createCountdownSlide(data)
    slides.value?.push(newSlide)

    // Take slide live if current active slide is a countdown
    if (
      activeSlide.value?.type === slideTypes.countdown &&
      activeSlide.value.slideMode !== "overlay"
    ) {
      makeSlideActive(newSlide, { goLive: true, newlyCreated: true })
    } else {
      makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
    }
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

// This can start and temporarily pause a countdown
emitter.on("start-countdown", (data: Slide) => {
  startCountdown(data)
})

emitter.on("restart-countdown", (data: Slide) => {
  const countdown = data?.data as Countdown
  if (countdown?.time) {
    startCountdown(data, true)
  }
})

emitter.on("delete-slide", (data: Slide) => {
  deleteSlide(data?.id)
})

emitter.on(
  appWideActions.addSongSlideToSetlist,
  async (data: { setlistSlide: Slide; songSlide: Slide }) => {
    const setlistSlide = slides.value.find(
      (slide) => slide.id === data.setlistSlide?.id
    )
    const songSlide = slides.value.find(
      (slide) => slide.id === data.songSlide?.id
    )

    if (
      !setlistSlide ||
      !songSlide ||
      setlistSlide.type !== slideTypes.songSetlist ||
      songSlide.type !== slideTypes.song
    ) {
      return
    }

    const song = await useSong((songSlide.data as Song) || songSlide.songId!!)
    if (!song) return

    const updatedSlide = await appendSongToSetlist(setlistSlide, song)
    if (!updatedSlide) return

    const slideIndex = slides.value.findIndex((s) => s.id === updatedSlide.id)
    if (slideIndex >= 0) {
      slides.value.splice(slideIndex, 1, updatedSlide)
    }
    makeSlideActive(updatedSlide, { goLive: false, newlyCreated: false })
    updateLiveOutput(updatedSlide)
    updateSlideOnline(updatedSlide)
    await deleteSlide(songSlide.id, false)
    toast.add({
      icon: "i-lucide-list-music",
      title: `${song.title} moved into setlist`,
    })
  }
)

emitter.on("refresh-slides", () => {
  retrieveSlidesOnline(appStore.currentState.activeSchedule?._id!!).catch(
    (error) => console.warn("Unable to refresh schedule slides:", error)
  )
})

emitter.on("upload-offline-slides", () => {
  uploadOfflineSlides()
})

emitter.on("batch-update-slides", (slides: Slide[]) => {
  appStore.setActiveSlides(slides)
  batchUpdateSlides(slides)
})

emitter.on(appWideActions.selectSlides, () => {
  bulkSelectSlides.value = true
})

emitter.on(appWideActions.selectAllSlides, () => {
  addAllSlidesToSelectedSlides()
})

emitter.on(appWideActions.cancelSelectSlides, () => {
  removeAllSelectedSlides()
  bulkSelectSlides.value = false
})

emitter.on("promote-active-slide-live", () => {
  if (activeSlide.value) {
    handleTakeLiveAction(activeSlide.value)
  }
})

emitter.on("selected-schedule", (data: Schedule | string | null) => {
  // Clear Edit Content pane
  // activeSlide.value = undefined

  const incomingId = typeof data === "string" ? data : data?._id ?? null
  const isReselectingSameSchedule =
    incomingId != null && incomingId === lastSelectedScheduleId.value
  lastSelectedScheduleId.value = incomingId

  // App boot re-emits this for the already-active schedule (e.g. on reload) —
  // only clear the live slide when the schedule actually changes.
  if (isReselectingSameSchedule) return

  // Clear live projection
  appStore.setLiveSlide("")
  useBroadcastPost(null)
  clearSlideOverlay()
})

// Utility functions for offline sync
const mergeSlideIds = (
  offlineSlides: Slide[],
  insertedSlides: Slide[],
  duplicateIds: string[]
): Slide[] => {
  // Build a map of id -> _id from successfully inserted slides
  const insertedMap = new Map(
    insertedSlides.map((slide) => [slide.id, slide._id])
  )

  // Duplicate slides already exist on the server — their _id equals their id
  // (because the server sets _id = slide.id on creation)
  const duplicateSet = new Set(duplicateIds)

  return offlineSlides.map((slide) => {
    const copy = { ...slide }
    if (insertedMap.has(copy.id)) {
      copy._id = insertedMap.get(copy.id)
    } else if (duplicateSet.has(copy.id)) {
      // Already exists on server, _id is the same as id
      copy._id = copy.id
    }
    return copy
  })
}

// Concurrency guard for uploadOfflineSlides.
// If a batch upload is already in-flight and new slides arrive, we schedule
// one more run immediately after the current one finishes rather than dropping them.
let isUploadingOfflineSlides = false
let pendingUploadAfterLock = false

const uploadOfflineSlides = async () => {
  // Don't attempt upload when offline
  if (!online.value) return

  // If already uploading, mark that there are new slides waiting and return.
  // The in-flight call will trigger another run when it finishes.
  if (isUploadingOfflineSlides) {
    pendingUploadAfterLock = true
    return
  }

  // Snapshot offline slides at the moment the lock is acquired so that any
  // slides added while the request is in-flight are picked up on the next run.
  const offlineSlides = appStore.currentState.activeSlides.filter(
    (slide) => slide._id === undefined && slide.scheduleId
  )
  if (offlineSlides.length === 0) return

  isUploadingOfflineSlides = true
  pendingUploadAfterLock = false
  try {
    const { inserted, duplicateIds } = await batchCreateSlides(offlineSlides)

    // Only proceed if something was actually processed
    if (inserted.length > 0 || duplicateIds.length > 0) {
      // Merge _id values back into the offline slides
      const reconciledSlides = mergeSlideIds(
        offlineSlides,
        inserted,
        duplicateIds
      )

      // Update the store: replace matching slides so they now carry _id
      const currentSlides = [...appStore.currentState.activeSlides]
      const reconciledMap = new Map(reconciledSlides.map((s) => [s.id, s]))
      const updatedSlides = currentSlides.map((slide) =>
        reconciledMap.has(slide.id) ? reconciledMap.get(slide.id)! : slide
      )
      appStore.setActiveSlides(updatedSlides)

      // Broadcast newly created slides via WebSocket after successful upload
      if (inserted.length > 0) {
        broadcastSlideUpdate("batch-create-slides", {
          slides: reconciledSlides,
        })
      }
    }
  } finally {
    isUploadingOfflineSlides = false
    // If new slides arrived while the request was in-flight, run again now
    if (pendingUploadAfterLock) {
      pendingUploadAfterLock = false
      uploadOfflineSlides()
    }
  }
}

const retrieveSlidesOnline = async (scheduleId: string) => {
  if (!online.value || !scheduleId || !authStore.user?.churchId) {
    return
  }

  // Only block the grid with a skeleton when there's nothing on screen yet —
  // background refreshes (e.g. "refresh-slides") shouldn't blank out
  // already-rendered slides.
  const showSkeletonWhileLoading = !slides.value?.length
  if (showSkeletonWhileLoading) isLoadingSlides.value = true
  appStore.setSlidesLoading(true)

  try {
    const { data, error } = await useAPIFetch(
      `/church/${authStore.user?.churchId}/schedules/${scheduleId}/slides`
    )
    if (!error.value) {
      let tempSlides = (data.value as Slide[]) || []
      if (!Array.isArray(tempSlides)) {
        console.warn(
          "retrieveSlidesOnline: unexpected response shape",
          data.value
        )
        return
      }
      tempSlides.forEach((slide) => {
        if (
          slide.backgroundType === backgroundTypes.video &&
          (slide.backgroundVideoKey === "video-bg-1" ||
            slide.backgroundVideoKey === "/video-bg-1.mp4" ||
            slide.backgroundVideoKey === "video-bg-2" ||
            slide.backgroundVideoKey === "/video-bg-2.mp4" ||
            slide.backgroundVideoKey === "video-bg-3" ||
            slide.backgroundVideoKey === "/video-bg-3.mp4" ||
            slide.backgroundVideoKey === "video-bg-4" ||
            slide.backgroundVideoKey === "/video-bg-4.mp4" ||
            slide.backgroundVideoKey === "video-bg-5" ||
            slide.backgroundVideoKey === "/video-bg-5.mp4" ||
            slide.backgroundVideoKey === "video-bg-6" ||
            slide.backgroundVideoKey === "/video-bg-6.mp4")
        ) {
          slide.background = appStore.currentState.backgroundVideos?.find(
            (bg) => bg.id === slide.backgroundVideoKey
          )?.url
        } else if (
          (slide.backgroundType === backgroundTypes.image ||
            slide.backgroundType === backgroundTypes.video) &&
          slide.background?.includes("blob:")
        ) {
          // Custom (non-preset) image AND video backgrounds: the server may hold
          // a stale, session-dead blob: URL. Restore the still-valid locally
          // rehydrated background so the "server wins" merge can't clobber a
          // working slide with a broken URL.
          const previousBackground = appStore.currentState.activeSlides.find(
            (s) => s.id === slide.id
          )?.background
          if (previousBackground) {
            slide.background = previousBackground
          }
        }
      })
      // Sort slides by index
      tempSlides = [...tempSlides].sort((a, b) => a.index - b.index)

      appStore.setActiveSlides(
        useMergeObjectArray(tempSlides, [...appStore.currentState.activeSlides])
      )
      appStore.setLastSynced(new Date().toISOString())
    } else {
      console.warn("Unable to refresh schedule slides:", error.value)
    }
  } finally {
    appStore.setSlidesLoading(false)
    if (showSkeletonWhileLoading) {
      // Wait for the activeSlides watcher to sync the local `slides` ref and
      // for Vue to flush that update (including mounting the slide cards)
      // before dropping the skeleton, so the grid never shows an empty/half
      // -rendered frame between "fetch done" and "slides actually painted".
      await nextTick()
      isLoadingSlides.value = false
    }
  }
}

// Scroll to the active slide only when a slide is added. Changing the active
// slide alone should not move the grid.
watch(
  () => slides.value?.length ?? 0,
  (newLength, oldLength) => {
    if (newLength <= oldLength) return

    nextTick(() => {
      scrollToSlide(activeSlide.value?.id)
      const slideId = activeSlide.value?.id
      const selectorId = slideId?.replace(/\d+/g, "")
      // Guard against an empty or invalid CSS selector (e.g. slide ID is all digits)
      if (!selectorId || selectorId === "#") return
      try {
        const newestSlide = slidesGrid.value?.querySelector(`#${selectorId}`)
        newestSlide?.scrollIntoView({ behavior: "auto" })
      } catch (err) {
        // querySelector throws SyntaxError on invalid selectors — silently ignore
      }
    })
  }
)

// Update Slides order when they are updated in Slide schedule
watch(
  () => currentState.value.activeSlides,
  (newSlides) => {
    const scheduleId = appStore.currentState.activeSchedule?._id
    const tempSlides = newSlides?.filter(
      (slide) => slide.scheduleId === scheduleId
    )

    if (tempSlides.length > 0) {
      slides.value = tempSlides

      // Only update activeSlide if it exists in the filtered slides
      if (activeSlide.value?.id) {
        const updatedActiveSlide = tempSlides.find(
          (slide) => slide.id === activeSlide.value?.id
        )
        if (updatedActiveSlide) {
          activeSlide.value = updatedActiveSlide
          // sendNewSlideToWebsocket(updatedActiveSlide)
        }
      }
    }
  },
  { immediate: true }
)

// Set slides to slides based on scheduler
watch(
  () => currentState.value.activeSchedule,
  (oldVal, newVal) => {
    if (oldVal?._id !== newVal?._id) {
      slides.value = currentState.value.activeSlides?.filter(
        (slide) =>
          slide.scheduleId === appStore.currentState.activeSchedule?._id
      )

      // Check if activeSchedule is remote object
      if (!currentState.value.activeSchedule?.updatedAt) {
        createSchedule(currentState.value.activeSchedule as Schedule)
      } else {
        // retrieve all slides online
        retrieveSlidesOnline(currentState.value.activeSchedule?._id).catch(
          (error) => console.warn("Unable to refresh schedule slides:", error)
        )
      }
    }
  },
  { immediate: true }
)

// Media (video) slides are never re-synced — their heavy video payload is
// handled by its own upload flow and must not be re-broadcast/re-persisted.
const isMediaVideoSlide = (slide: Slide) =>
  slide.type === slideTypes.media &&
  slide.backgroundType === backgroundTypes.video

// Realtime broadcast cadence (~250ms): fast enough to feel live as a
// collaborator types, but still coalesced so a burst of keystrokes is a few
// socket frames, not dozens. This is the main performance lever on low-end
// machines — every broadcast makes each peer swap the activeSlides array
// reference AND triggers a pinia-shared-state localStorage write, so do NOT
// push this toward per-keystroke.
const broadcastSlideEdit = useThrottleFn(
  (slide: Slide) => {
    if (!online.value || isMediaVideoSlide(slide)) return
    // Broadcast regardless of whether the slide has a server `_id` yet —
    // collaborators hold it by client `id` from the create broadcast, so
    // id-keyed updates apply even before batch upload assigns an `_id`.
    broadcastSlideUpdate("update-slide", {
      ...slide,
      slideId: slide.id,
    })
  },
  250,
  true
)

// HTTP persistence cadence (2s): decoupled from the broadcast above so live
// typing stays responsive without multiplying database writes.
const persistSlideOnline = useThrottleFn(
  async (slide: Slide) => {
    // Don't make API calls when offline; persistence needs a server `_id`.
    if (!online.value || !slide?._id || isMediaVideoSlide(slide)) return

    const tempSlide: Slide | any = { ...slide }
    delete tempSlide._id

    // Remove already added slide properties when updating slide online
    delete tempSlide.id
    delete tempSlide.churchId
    delete tempSlide.type

    if (tempSlide.backgroundType !== backgroundTypes.video) {
      tempSlide.backgroundVideoKey = null
    }

    let data: any, error: any
    try {
      ;({ data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/${slide?._id}`,
        {
          method: "PUT",
          body: tempSlide,
        }
      ))
    } catch (err) {
      console.error("Failed to update slide online:", err)
      // A throw from the fetch wrapper itself leaves `error` unset — treat it as
      // the failure it is rather than falling through to the success branch and
      // stamping a sync that never happened.
      error = { value: err }
    }

    if (!error?.value) {
      appStore.setLastSynced(new Date().toISOString())
      return data?.value
    }

    if (isNotFoundError(error.value)) {
      appStore.removeActiveSlide(slide)
      return null
    }

    // The request never reached the server. Nothing here is recoverable by
    // throwing: this runs detached inside a throttle, so the rejection is
    // unhandled and only ever lands in error tracking. Slide PUTs are
    // deliberately not offline-queued (they're high-frequency and reconciled by
    // realtime), so the next edit re-sends the full slide anyway.
    if (isNetworkError(error.value)) {
      console.warn("Slide sync skipped — request did not reach the server")
      return null
    }

    throw new Error(getAPIErrorMessage(error.value, "Failed to update slide"))
  },
  2000,
  true
)

// Public entry point for "an edit happened": announce presence (once per
// slide), broadcast fast, persist slow.
const updateSlideOnline = (slide: Slide) => {
  announceEditing(slide?.id)
  broadcastSlideEdit(slide)
  persistSlideOnline(slide)
}

const deleteSlide = async (slideId: string, addToast: boolean = true) => {
  if (!slideId) return

  const slideMatchesId = (slide: Slide) =>
    slide.id === slideId || slide._id === slideId
  const tempSlide = slides.value.find(slideMatchesId) as Slide | undefined

  if (!tempSlide) {
    const activeStoreSlide =
      appStore.currentState.activeSlides.find(slideMatchesId)
    const wasLive =
      appStore.currentState.liveSlideId === slideId ||
      (activeStoreSlide
        ? appStore.currentState.liveSlideId === activeStoreSlide.id ||
          appStore.currentState.liveSlideId === activeStoreSlide._id
        : false)

    if (wasLive) {
      appStore.setLiveSlide("")
      useBroadcastPost(null)
    }

    if (
      appStore.currentState.activeOverlaySlide &&
      (appStore.currentState.activeOverlaySlide.id === slideId ||
        appStore.currentState.activeOverlaySlide._id === slideId)
    ) {
      clearSlideOverlay()
    }

    if (activeStoreSlide || wasLive) {
      broadcastSlideUpdate("delete-slide", {
        slideId: activeStoreSlide?.id || slideId,
        _id: activeStoreSlide?._id,
      })
    }

    appStore.setActiveSlides(
      appStore.currentState.activeSlides.filter(
        (slide) => !slideMatchesId(slide)
      )
    )
    return
  }

  const clientSlideId = tempSlide.id || slideId

  // Clear countdown animation if slide is a countdown slide before deleting
  if (tempSlide?.type === slideTypes.countdown) {
    stopCountdown()
  }

  // Clear Edit Content pane if the deleted slide is currently selected
  if (activeSlide.value?.id === slideId) {
    // activeSlide.value = undefined
  }

  // Clear live projection if the deleted slide is currently live
  if (
    appStore.currentState.liveSlideId === clientSlideId ||
    appStore.currentState.liveSlideId === tempSlide._id
  ) {
    appStore.setLiveSlide("")
    useBroadcastPost(null)
  }

  if (
    appStore.currentState.activeOverlaySlide?.id === clientSlideId ||
    appStore.currentState.activeOverlaySlide?._id === tempSlide._id
  ) {
    clearSlideOverlay()
  }

  const slideIndex = slides.value.findIndex(slideMatchesId)
  if (slideIndex >= 0) {
    slides.value.splice(slideIndex, 1)
  }
  appStore.removeActiveSlide(tempSlide)

  // Broadcast deletion via WebSocket for realtime collaboration
  broadcastSlideUpdate("delete-slide", {
    slideId: clientSlideId,
    _id: tempSlide._id,
  })

  // Delete slide online if it has an _id
  if (tempSlide?._id) {
    await deleteSlideAPI(tempSlide)
  }

  // Delete local media bytes and metadata when no library item still owns it.
  // Library rows are keyed `_id || id` (see useLibrary.cacheSlidesInLibrary), so
  // a saved slide is filed under its server id — looking it up by client id
  // alone missed it and sent us into deleteGroup for media that was still owned.
  const itemSaved =
    (await getLibraryItem(clientSlideId)) ||
    (tempSlide._id ? await getLibraryItem(tempSlide._id) : undefined)
  if (!itemSaved) {
    try {
      await useLocalMediaStorage().deleteGroup(clientSlideId)
    } catch (error) {
      // deleteGroup refuses to delete media another slide still points at.
      // That's the correct outcome, not a failure of this deletion — keep the
      // bytes and move on rather than aborting the rest of the flow.
      console.warn("Local media kept — still referenced by another slide", error)
    }
  }

  if (addToast) {
    toast.add({ title: `${tempSlide?.name} deleted`, icon: "i-tabler-trash" })
  }
  usePosthogCapture("DELETE_SLIDE")
}

const deleteMultipleSlides = (slideIds: Array<string>) => {
  // Broadcast batch deletion via WebSocket
  broadcastSlideUpdate("batch-delete-slides", { slideIds })

  slideIds.forEach((slideId) => {
    deleteSlide(slideId, false)
  })
  toast.add({ title: "Multiple slides deleted", icon: "i-tabler-trash" })
  bulkSelectedSlides.value = []
  bulkSelectSlides.value = false
}

const onUpdateSlide = (slide: Slide) => {
  // Always pause countdown slide before updating it
  if (slide.type === slideTypes.countdown) {
    // pause the active countdown animation so edits don't conflict
    stopCountdown()
  }

  // Stamp a client-side updatedAt so v-memo detects the change and re-renders the card
  const updatedSlide: Slide = { ...slide, updatedAt: new Date().toISOString() }

  makeSlideActive(updatedSlide)
  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => updatedSlide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, updatedSlide)

  updateSlideOnline(updatedSlide)
  updateLiveOutput(updatedSlide)

  if (
    appStore.currentState.activeOverlaySlide?.id === updatedSlide.id &&
    updatedSlide.type !== slideTypes.countdown
  ) {
    showSlideOverlay(updatedSlide, { capture: false })
  }

  // When updating of countdown slide is done, resume timer
  if (updatedSlide.type === slideTypes.countdown) {
    startCountdown(updatedSlide)
  }
}

// This function updates specific slide that is not active
const onUpdateInactiveSlide = (slide: Slide) => {
  const updatedSlide: Slide = { ...slide, updatedAt: new Date().toISOString() }

  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => updatedSlide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, updatedSlide)

  // Toolbar actions use the selected slide as their source of truth. Keep that
  // reference in sync even when the edit intentionally uses the inactive-slide
  // persistence path, otherwise toggle buttons continue reading stale styles.
  if (activeSlide.value?.id === updatedSlide.id) {
    activeSlide.value = updatedSlide
  }

  updateSlideOnline(updatedSlide)
  updateLiveOutput(updatedSlide)

  if (appStore.currentState.activeOverlaySlide?.id === updatedSlide.id) {
    showSlideOverlay(updatedSlide, { capture: false })
  }
}

// Countdown management functions
const updateCountdownSlide = (
  slide: Slide,
  timeRemaining: number,
  isPlaying: boolean = true,
  options: { remainingMs?: number; syncOverlay?: boolean } = {}
) => {
  const tempSlide = { ...slide }
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  tempSlide.data = {
    ...tempSlide.data,
    timeLeft: useMilliToTimeString(timeRemaining),
    remainingMs: isPlaying ? options.remainingMs : undefined,
  } as Countdown
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    isMediaPlaying: isPlaying,
  }
  tempSlide.contents = useSlideContent(tempSlide, tempSlide?.data!!)
  slides.value.splice(slideIndex, 1, tempSlide)

  // Countdown controls are rendered from activeSlide, while timer ticks update
  // the slides collection. Synchronize both so play/pause state is immediate.
  if (activeSlide.value?.id === tempSlide.id) {
    activeSlide.value = tempSlide
  }

  const isActiveOverlay =
    appStore.currentState.activeOverlaySlide?.id === tempSlide.id

  // Overlay outputs derive each visible second locally from remainingMs. Only
  // write the persisted/shared store when playback state changes, not per tick.
  if (!isActiveOverlay || options.syncOverlay) {
    updateLiveOutput(tempSlide)
  }
  if (isActiveOverlay && options.syncOverlay) {
    showSlideOverlay(tempSlide, { capture: false })
  }
}

const startCountdown = (slide: Slide, restartCountdown: boolean = false) => {
  const countdown = slide?.data as Countdown
  if (countdown?.time) {
    const duration = useTimeStringToMilli(
      restartCountdown
        ? (slide.data as Countdown)?.time
        : (slide.data as Countdown)?.timeLeft
    )

    if (
      activeCountdownInterval.value !== null &&
      activeCountdownSlideId.value !== slide.id
    ) {
      cancelAnimationFrame(countdownRAF.value)
      activeCountdownInterval.value = null
      countdownTimeLeft.value = 0
    }

    if (activeCountdownInterval.value === null || restartCountdown) {
      // Stop any existing animation
      if (countdownRAF.value) {
        cancelAnimationFrame(countdownRAF.value)
      }

      // Reset or initialize countdown state
      if (restartCountdown || activeCountdownSlideId.value !== slide.id) {
        countdownTimeLeft.value = duration
        countdownDuration.value = duration
      } else {
        countdownTimeLeft.value =
          countdownTimeLeft.value === 0 ? duration : countdownTimeLeft.value
        countdownDuration.value = duration
      }

      // Record start time
      countdownStartTime.value = performance.now()
      const startTimeLeft = countdownTimeLeft.value
      activeCountdownSlideId.value = slide.id

      // Publish the playing state immediately so toolbar controls do not wait
      // for the first one-second countdown tick before switching to pause.
      updateCountdownSlide(slide, countdownTimeLeft.value, true, {
        remainingMs: startTimeLeft,
        syncOverlay: true,
      })

      // Animation function
      const animate = (currentTime: number) => {
        const elapsed = currentTime - countdownStartTime.value
        const remaining = Math.max(0, startTimeLeft - elapsed)

        // Update only when we cross a second boundary to maintain the same visual update rate
        if (
          Math.floor(remaining / 1000) !==
          Math.floor(countdownTimeLeft.value / 1000)
        ) {
          countdownTimeLeft.value = remaining
          updateCountdownSlide(slide, remaining, true, {
            remainingMs: remaining,
          })
        }

        if (remaining > 0) {
          countdownRAF.value = requestAnimationFrame(animate)
          activeCountdownInterval.value = true
        } else {
          countdownTimeLeft.value = 0
          updateCountdownSlide(slide, 0, false, { syncOverlay: true })
          activeCountdownInterval.value = null
          activeCountdownSlideId.value = null
        }
      }

      // Start the animation
      countdownRAF.value = requestAnimationFrame(animate)
      activeCountdownInterval.value = true
    } else {
      // Pause the countdown
      cancelAnimationFrame(countdownRAF.value)
      activeCountdownInterval.value = null
      updateCountdownSlide(slide, countdownTimeLeft.value, false, {
        syncOverlay: true,
      })
    }
  }
}

const stopCountdown = () => {
  if (countdownRAF.value) {
    cancelAnimationFrame(countdownRAF.value)
  }
  activeCountdownInterval.value = null
  activeCountdownSlideId.value = null
  countdownTimeLeft.value = 0
}

const gotoAction = async (title: string, version: string) => {
  if (!activeSlide.value) return

  const updatedSlide = await gotoVerse(activeSlide.value, title, version)
  if (updatedSlide) {
    const slideIndex = slides.value.findIndex((s) => s.id === updatedSlide.id)
    activeSlide.value = updatedSlide
    slides.value.splice(slideIndex, 1, updatedSlide)
    updateLiveOutput(activeSlide.value)
    updateSlideOnline(activeSlide.value)
  }
}

const saveSlide = async (item: Slide) => {
  await saveSlideToLib(item)
}

const openSaveTemplateModal = (slide: Slide) => {
  slideToSaveAsTemplate.value = slide
  showSaveTemplateModal.value = true
}

const addAllSlidesToSelectedSlides = () => {
  bulkSelectedSlides.value = slides.value.map((slide) => slide?.id)
}

const removeAllSelectedSlides = () => {
  bulkSelectedSlides.value = []
  usePosthogCapture("REMOVE_ALL_SELECTED_SLIDES_BTN_CLICKED")
}

const addToSelectedSlides = (slideId: string, isSelected: boolean) => {
  if (isSelected) {
    bulkSelectedSlides.value.push(slideId)
  } else {
    bulkSelectedSlides.value.splice(
      bulkSelectedSlides.value.findIndex((id) => id === slideId),
      1
    )
  }
}

const removeFromSelectedSlides = (slideId: string) => {
  bulkSelectedSlides.value.splice(
    bulkSelectedSlides.value.findIndex((id) => id === slideId),
    1
  )
}
</script>

<style scoped>
.slides-ctn {
  scroll-behavior: smooth;
}
/* .slides-ctn * {
  position: static;
} */
.slides-ctn-3-rows {
  height: 336px;
}

.slides-ctn-2-rows {
  height: 260px;
}
</style>
