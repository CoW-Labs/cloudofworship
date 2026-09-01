<template>
  <div
    ref="editorRoot"
    data-cow-popover-boundary
    class="main relative h-full min-h-0 flex flex-col rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1"
    :class="containerOverflow === 'overflow-x-auto' ? '' : 'overflow-hidden'"
    @dragenter="onBgDragEnter"
    @dragover="onBgDragOver"
    @dragleave="onBgDragLeave"
    @drop="onBgDrop"
  >
    <!-- MEDIA DOWNLOAD PROGRESS — shown while this slide's video/media is being
         fetched into the local cache. Mirrors the loading bar in the Navbar. -->
    <UProgress
      v-if="mediaDownloadProgress !== null"
      class="absolute inset-x-0 top-0 z-50 rounded-none"
      :value="mediaDownloadValue"
      :max="100"
      size="xs"
    />
    <div
      v-if="currentLocalTransfer?.status === 'failed'"
      class="absolute inset-x-2 top-2 z-50 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 shadow dark:bg-red-950/90 dark:text-red-200"
    >
      <span class="truncate">
        This media is only available for this session and is not durably saved.
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <button class="font-semibold hover:underline" @click="retryLocalSave">
          Retry
        </button>
        <button
          class="font-semibold hover:underline"
          @click="removeFailedMedia"
        >
          Remove
        </button>
      </div>
    </div>
    <EmptyState
      v-if="isDraggingBackgroundFile && slide"
      tinted
      icon="i-bx-cloud-upload"
      sub="Drop to set as slide background"
      class="absolute inset-0 z-40 pointer-events-none"
    />
    <div v-if="slide" class="z-20 shrink-0">
      <div
        v-if="slide"
        class="toolbar w-[100%] px-3 py-1 min-h-[44px] bg-[#f1f3f6] dark:bg-[#222938] flex items-center justify-between gap-1"
      >
        <template v-if="slide">
          <div
            class="slide-name flex items-center gap-1 top-1 text-gray-700 dark:text-[#d5dae3] shrink-0"
          >
            <h4 class="font-medium text-nowrap">
              {{ useShortSlideName(slide, { longer: true }) }}
            </h4>
            <SlideChip
              :slide-type="slide?.type"
              :slide-sub-type="(slide?.data as ExtendedFileT)?.type"
              :slide-mode="slide?.slideMode"
              dark-mode
            />
            <!-- Editing by indicator -->
            <CowTooltip
              v-if="editingBy"
              :text="`${editingBy.userName} is on this slide`"
              placement="bottom"
            >
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white shadow animate-pulse ml-1"
                :style="{ backgroundColor: editingBy.theme || '#f59e0b' }"
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
          <div
            class="right-group flex items-center gap-1 flex-1 justify-end min-w-0"
          >
            <div
              class="actions flex items-center gap-1 min-w-0"
              :class="containerOverflow"
            >
              <!-- VERSE SWITCH -->
              <BibleVerseSwitch
                v-if="
                  (slide?.type === slideTypes?.bible ||
                    slide?.type === slideTypes?.hymn ||
                    slide?.type === slideTypes?.song ||
                    slide?.type === slideTypes?.songSetlist) &&
                  !isEmptySongSetlist
                "
                v-model="verse"
                :slide="slide"
                data-tour="verse-switch"
                @previous-verse="handlePreviousVerse"
                @next-verse="handleNextVerse"
                @goto-verse="$emit('goto-verse', verse, selectedBibleVersion)"
                @take-live="$emit('take-live')"
                @predict="predictVerseInput($event as HTMLInputElement)"
              />
              <!-- Chapter verse list — revealed on hover of the verse switcher,
                 or while its input has focus. Must stay the immediate next
                 sibling of .verse-switch for the `+ .verse-preview` CSS to work. -->
              <PreviewVerses
                v-if="
                  (slide?.type === slideTypes.hymn ||
                    slide?.type === slideTypes.song ||
                    slide?.type === slideTypes.songSetlist ||
                    slide?.type === slideTypes.bible) &&
                  !isEmptySongSetlist
                "
                class="preview-verses"
                :slide="slide"
                :verse="verse"
                @goto-verse="$emit('goto-verse', $event, selectedBibleVersion)"
                @goto-song="goToSetlistSong"
                @remove-song="removeSetlistSong"
              />
              <!-- Component to Auto complete Bible Books while typing -->
              <BibleAutoComplete
                v-if="slide?.type === slideTypes.bible && !verse?.includes(':')"
                :verse="verse"
                @goto-book="predictVerseInput(undefined, $event)"
                @book-options="searchedBibleBookOptions = $event"
              />

              <!-- PAGE SWITCH — presentation slides -->
              <div
                v-if="slide?.type === slideTypes.presentation"
                class="page-switch button-group bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 flex items-center gap-1 h-[32px] px-1 pr-1 mr-0 relative"
              >
                <CowTooltip text="Previous page" :shortcut="shortcutIds.previousVerse">
                  <UButton
                    variant="ghost"
                    color="gray"
                    class="p-1 rounded-full text-gray-500 dark:text-[#7d8695]"
                    icon="i-bx-chevron-left"
                    :disabled="(slide.presentationPageIndex ?? 0) <= 0"
                    @click="handlePreviousPage"
                  />
                </CowTooltip>
                <span
                  class="text-xs font-medium px-1 text-gray-900 dark:text-[#d5dae3] min-w-[5ch] text-center"
                >
                  {{ (slide.presentationPageIndex ?? 0) + 1 }} /
                  {{ slide.presentationObjects?.length ?? 1 }}
                </span>
                <CowTooltip text="Next page" :shortcut="shortcutIds.nextVerse">
                  <UButton
                    variant="ghost"
                    color="gray"
                    class="p-1 rounded-full text-gray-500 dark:text-[#7d8695]"
                    icon="i-bx-chevron-right"
                    :disabled="
                      (slide.presentationPageIndex ?? 0) >=
                      (slide.presentationObjects?.length ?? 1) - 1
                    "
                    @click="handleNextPage"
                  />
                </CowTooltip>
              </div>
              <PreviewPages
                v-if="slide?.type === slideTypes.presentation"
                class="preview-pages"
                :slide="slide"
                @goto-page="handleGotoPage"
              />
              <BibleVersionSelect
                v-if="slide?.type === slideTypes?.bible"
                class="h-[34px] shrink-0"
                data-tour="bible-version"
                :bibleVersionInherited="selectedBibleVersion"
                @open="containerOverflow = ''"
                @close="containerOverflow = 'overflow-x-auto'"
                @change="onUpdateBibleVersion($event)"
              />
              <!-- TABS: Scripture / Background / Layout -->
              <div class="tabs flex items-center gap-1 shrink-0">
                <template v-for="(tab, i) in visibleTabs" :key="tab.key">
                  <div
                    v-if="i > 0"
                    class="w-px h-4 bg-gray-200 dark:bg-white/10"
                  ></div>
                  <CoWPopover
                    :open="activePanel === tab.key"
                    :boundary="editorRoot"
                    :max-width="
                      tab.key === 'background'
                        ? backgroundPopoverSize.width
                        : tab.key === 'scripture'
                        ? scripturePopoverSize.width
                        : layoutPopoverSize.width
                    "
                    :max-height="
                      tab.key === 'background'
                        ? backgroundPopoverSize.height
                        : tab.key === 'scripture'
                        ? scripturePopoverSize.height
                        : layoutPopoverSize.height
                    "
                    :boundary-overflow="120"
                    panel-class="!rounded-[18px] !bg-[#f1f3f6] !shadow-none !ring-0 dark:!bg-[#131724]"
                    @update:open="onPanelOpenChange(tab.key, $event)"
                  >
                    <CowTooltip
                      :text="tab.hint"
                      :prevent="activePanel === tab.key"
                    >
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                        :class="
                          activePanel === tab.key
                            ? 'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-[#a7afbd] hover:text-gray-900 dark:hover:text-white'
                        "
                      >
                        {{ tab.label }}
                      </button>
                    </CowTooltip>

                    <template #panel>
                      <div class="h-full w-full bg-[#f1f3f6] dark:bg-[#131724]">
                        <GotoScripture
                          v-if="tab.key === 'scripture'"
                          :verse="verse"
                          :version="selectedBibleVersion"
                          @goto-verse="onScriptureGoto"
                          @close="activePanel = null"
                          @resize="scripturePopoverSize = $event"
                        />
                        <SlideBackgroundPanel
                          v-else-if="tab.key === 'background'"
                          :slide="slide"
                          @select="onSelectBackground"
                          @loading-change="onBgPanelLoading"
                          @upload-files="onPanelUploadFiles"
                          @resize="backgroundPopoverSize = $event"
                          @close="activePanel = null"
                        />
                        <BibleThemeSelection
                          v-else
                          :value="slide?.slideStyle?.theme"
                          @select="onSelectTheme"
                          @resize="layoutPopoverSize = $event"
                        />
                      </div>
                    </template>
                  </CoWPopover>
                </template>
              </div>
            </div>

            <!-- GO LIVE -->
            <CowTooltip
              :text="
                slide.slideMode === 'overlay'
                  ? isActiveOverlay
                    ? 'Clear overlay'
                    : 'Show overlay'
                  : 'Take slide live'
              "
              :shortcut="shortcutIds.promoteActiveSlide"
            >
              <UButton
                variant="ghost"
                color="gray"
                data-tour="editor-go-live"
                class="go-live shrink-0 rounded-full px-4 h-[34px] gap-1.5 font-medium bg-gray-200/80 dark:bg-[#2b3242] text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-[#333c4e]"
                :disabled="
                  currentLocalTransfer?.status === 'pending' ||
                  currentLocalTransfer?.status === 'failed'
                "
                @click="$emit('take-live')"
              >
                <CloseIcon
                  v-if="slide.slideMode === 'overlay' && isActiveOverlay"
                  class="w-4 h-4"
                />
                <StackSimpleIcon
                  v-else-if="slide.slideMode === 'overlay'"
                  class="w-4 h-4"
                />
                <GoLiveIcon v-else class="w-4 h-4" />
                <!-- {{
                  slide.slideMode === "overlay"
                    ? isActiveOverlay
                      ? "Clear Overlay"
                      : "Show Overlay"
                    : "Go Live"
                }} -->
              </UButton>
            </CowTooltip>
          </div>
        </template>
      </div>

      <TipTapToolbar
        v-if="slide?.type === slideTypes.text"
        :editor="focusedEditor"
      />
      <SlideContentToolbar
        v-else-if="slide && !isEmptySongSetlist"
        :slide="slide"
        @update-style="onUpdateSlideStyle($event, false)"
        @update-song-lyrics="onUpdateSongLyrics($event)"
        @update-font="onUpdateSlideStyle({ ...slide.slideStyle, font: $event })"
        @update-lines-per-slide="onUpdateSongLines($event)"
        @update-media-seek-position="
          onUpdateMediaSeekPosition({
            ...slide.slideStyle,
            mediaSeekPosition: 0,
          })
        "
        @update-media-seek="onUpdateMediaSeek($event)"
        @update-bg-fill-type="
          onUpdateSlideStyle({
            ...slide.slideStyle,
            backgroundFillType: $event,
          })
        "
      />
    </div>

    <!-- MAIN CONTENT — preview region (overlay panels layer on top) -->
    <div class="body relative z-0 flex-1 min-h-0 overflow-hidden isolate">
      <EmptyState
        v-if="!slide"
        icon="i-bx-slideshow"
        svg-icon="NoSlidesIcon"
        sub="Select slide above to start editing"
        action=""
        action-text=""
      />
      <template v-else-if="slide">
        <EmptyState
          v-if="isEmptySongSetlist"
          icon="i-lucide-list-music"
          sub="Add songs to this setlist from the song list"
          action=""
          action-text=""
          class="h-[100%] bg-[#222938] rounded-b-2xl"
        />
        <!-- IMAGE NOT AVAILABLE ON THIS DEVICE NOTICE -->
        <div
          v-else-if="imageNotAvailable"
          class="h-[100%] flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#222938] rounded-b-2xl"
        >
          <IconWrapper
            name="i-bx-image-alt"
            size="12"
            class="text-primary-400"
          />
          <div>
            <h3 class="text-white font-semibold text-md">
              {{ imageUnavailableCopy.title }}
            </h3>
            <p
              class="text-primary-300 text-sm mt-1 max-w-[260px] mx-auto"
            >
              {{ imageUnavailableCopy.description }}
            </p>
          </div>
          <CowButton
            v-if="imageUnavailableReason === 'quota'"
            size="sm"
            class="mt-1"
            @click="
              isTeamsPlan
                ? useGlobalEmit(appWideActions.openSettings, 'Storage Settings')
                : useGlobalEmit('show-upgrade-modal')
            "
          >
            <template #leading>
              <IconWrapper name="i-bxs-award" class="w-4 h-4" />
            </template>
            {{ isTeamsPlan ? "Manage Storage" : "Upgrade to Teams" }}
          </CowButton>
        </div>
        <div
          v-else
          class="h-[100%] relative text-white bg-[#222938] bg-no-repeat transition-all rounded-b-2xl overflow-hidden"
          style="container-type: inline-size"
          :class="{
            'bg-center bg-cover':
              slide?.slideStyle?.backgroundFillType ===
                backgroundFillTypes.crop ||
              slide?.slideStyle?.backgroundFillType == undefined,
            'bg-top bg-cover':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.cropTop,
            'bg-bottom bg-cover':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.cropBottom,
            'bg-center bg-contain':
              slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
            'bg-center bg-stretch':
              slide?.slideStyle?.backgroundFillType ===
              backgroundFillTypes.stretch,
            // 'bg-center':
            //   slide?.slideStyle?.backgroundFillType === backgroundFillTypes.center,
          }"
          :style="useSlideBackground(slide)"
        >
          <!-- VIDEO BACKGROUND -->
          <video
            v-if="slide?.backgroundType === backgroundTypes.video"
            :src="slide?.background"
            class="h-[100%] w-[100%] object-cover absolute inset-0"
            crossorigin="anonymous"
          ></video>
          <div class="bg-black opacity-30 absolute inset-0"></div>
          <div
            v-if="slide?.type === slideTypes.text"
            class="text-slide-editor-preview"
          >
            <TipTap
              :slide="slide"
              @update="onUpdateSlideContent"
              @change-focused-editor="focusedEditor = $event"
              :layout="slide?.layout"
              editable
            />
          </div>
          <LiveContent
            v-else
            :slide="slide"
            :padding="editorPreviewPadding"
            :content-visible="true"
            class="static-slide-editor-preview z-10"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOnline } from "@vueuse/core"
import { remapChunkIndex, splitVerseByLines } from "~/composables/useHymn"
import CoWPopover from "~/components/cow/CoWPopover.vue"
import type { Editor } from "@tiptap/core"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import {
  mediaCloudFailureReason,
  unavailableMediaCopy,
} from "~/utils/mediaCloudSync"
import type {
  ExtendedFileT,
  MediaCloudSyncReason,
  Slide,
  SlideStyle,
  Song,
  SongSetlistData,
} from "~/types"
import { escapePriority } from "~/composables/useEscapeKey"
import {
  computeNextVerseLabel,
  computePreviousVerseLabel,
} from "~/utils/verseNavigation"

const props = defineProps<{
  slide?: Slide
  editingBy?: {
    userId: string
    userName: string
    avatar?: string
    theme?: string
  } | null
}>()

const appStore = useAppStore()
const authStore = useAuthStore()
const localMedia = useLocalMediaStorage()
const isActiveOverlay = computed(
  () => appStore.currentState.activeOverlaySlide?.id === props.slide?.id
)

// Live download progress for the current slide's media. Media slides are cached
// under `slide.id`; background videos under `slide.backgroundVideoKey`.
const {
  progressFor,
  transferFor,
  beginLocalSave,
  setLocalSaveProgress,
  completeLocalSave,
  failLocalSave,
} = useMediaDownloadProgress()
const currentLocalTransfer = computed(() =>
  props.slide
    ? transferFor(props.slide.id) || transferFor(props.slide.backgroundVideoKey)
    : null
)
const mediaDownloadProgress = computed<number | null>(() => {
  const slide = props.slide
  if (!slide) return null
  const localTransfer =
    transferFor(slide.id) || transferFor(slide.backgroundVideoKey)
  if (localTransfer?.status === "pending") {
    return localTransfer.progress * 100
  }
  const byId = progressFor(slide.id)
  if (byId !== null) return byId
  return progressFor(slide.backgroundVideoKey)
})
// UProgress renders determinate when given a finite value, otherwise (unknown
// total size → NaN) it falls back to the indeterminate animation.
const mediaDownloadValue = computed<number | undefined>(() =>
  Number.isFinite(mediaDownloadProgress.value)
    ? (mediaDownloadProgress.value as number)
    : undefined
)

const retryLocalSave = async () => {
  const slide = props.slide
  if (!slide) return
  beginLocalSave(slide.id)
  try {
    if (slide.type === slideTypes.presentation) {
      for (const page of slide.presentationObjects || []) {
        const response = await fetch(page.imageUrl)
        const blob = await response.blob()
        await localMedia.saveBlob({
          key: `${slide.id}-page-${page.page}`,
          groupId: slide.id,
          category: "presentation-page",
          kind: "image",
          blob,
          mimeType: blob.type || "image/png",
          recoverable: false,
          userInitiated: true,
          onProgress: (fraction) => setLocalSaveProgress(slide.id, fraction),
        })
        page.imageUrl =
          (await localMedia.getPlaybackUrl(`${slide.id}-page-${page.page}`)) ||
          page.imageUrl
      }
      slide.background =
        slide.presentationObjects?.[slide.presentationPageIndex || 0]
          ?.imageUrl || slide.background
    } else {
      const file = slide.data as ExtendedFileT
      if (!(file?.blob instanceof Blob)) {
        throw new Error("The original session file is no longer available.")
      }
      const blob =
        file.type === "image" ? await useCompressedImage(file.blob) : file.blob
      await localMedia.saveBlob({
        key: slide.id,
        groupId: slide.id,
        category: "slide",
        kind:
          file.type === "audio"
            ? "audio"
            : file.type === "video"
            ? "video"
            : "image",
        blob,
        mimeType: blob.type,
        originalName: file.name,
        recoverable: false,
        userInitiated: true,
        onProgress: (fraction) => setLocalSaveProgress(slide.id, fraction),
      })
      const url = await localMedia.getPlaybackUrl(slide.id)
      if (url) {
        file.url = url
        if (file.type !== "audio") slide.background = url
      }
      delete file.blob
    }
    completeLocalSave(slide.id)
    emit("slide-update", slide)
  } catch (error) {
    failLocalSave(slide.id, error)
  }
}

const removeFailedMedia = () => {
  if (!props.slide) return
  ;(useNuxtApp().$emitter as Emitter<any>).emit("delete-slide", props.slide)
}

const emit = defineEmits([
  "slide-update",
  "inactive-slide-update",
  "update-live-output-slides",
  "goto-verse",
  "update-bible-version",
  "update-lines-per-slide",
  "take-live",
])

// Render non-text slides from their existing HTML instead of asking six
// TipTap/ProseMirror instances to parse every verse change.
const editorPreviewPadding = computed(() => {
  const padding = appStore.currentState.settings.slideStyles.windowPadding
  const scale = (value: number | undefined) => ((value || 24) * 6) / 24

  return {
    top: scale(padding?.top),
    right: scale(padding?.right),
    bottom: scale(padding?.bottom),
    left: scale(padding?.left),
  }
})

const editorRoot = ref<HTMLElement | null>(null)
const focusedEditor = ref<Editor | undefined>()
const backgroundImageLoading = ref<boolean>(false)
const backgroundVideoLoading = ref<boolean>(false)

// Only one editor action popover can be open at a time.
type PanelKey = "scripture" | "background" | "layout"
type PopoverSize = { width: number; height: number }
const activePanel = ref<PanelKey | null>(null)
const getInitialBackgroundPopoverSize = (): PopoverSize =>
  props.slide?.backgroundType === backgroundTypes.solid ||
  props.slide?.backgroundType === backgroundTypes.gradient
    ? { width: 401, height: 200 }
    : { width: 753, height: 314 }
const backgroundPopoverSize = ref<PopoverSize>(
  getInitialBackgroundPopoverSize()
)
const scripturePopoverSize = ref<PopoverSize>({ width: 753, height: 330 })
const layoutPopoverSize = ref<PopoverSize>({ width: 753, height: 330 })

// Toolbar tabs that toggle the overlay panels. Scripture/Layout are Bible-only;
// Background mirrors the old "add background" visibility (hidden for presentation
// and non-audio media slides).
const visibleTabs = computed(() => {
  const isAudio = (props.slide?.data as ExtendedFileT)?.type?.includes("audio")
  const isBible = props.slide?.type === slideTypes.bible
  const showBackground =
    props.slide?.type !== slideTypes.presentation &&
    (props.slide?.type !== slideTypes.media || isAudio)
  const tabs: { key: PanelKey; label: string; hint: string }[] = []
  if (isBible)
    tabs.push({
      key: "scripture",
      label: "Scripture",
      hint: "Browse and jump to any verse",
    })
  if (showBackground)
    tabs.push({
      key: "background",
      label: "Background",
      hint: "Set an image, video or colour behind this slide",
    })
  if (isBible)
    tabs.push({
      key: "layout",
      label: "Layout",
      hint: "Change how the verse and reference are arranged",
    })
  return tabs
})

const onPanelOpenChange = (key: PanelKey, open: boolean) => {
  if (open) {
    activePanel.value = key
  } else if (activePanel.value === key) {
    activePanel.value = null
  }
}

// Navigate to a verse chosen in the Scripture picker, then close the panel.
const onScriptureGoto = (title: string) => {
  emit("goto-verse", title, selectedBibleVersion.value)
  activePanel.value = null
}

// Reflect background upload/loading on the toolbar if needed.
const onBgPanelLoading = (loading: boolean) => {
  backgroundImageLoading.value = loading
}

// Files dropped/selected in the Background panel's upload zone — reuse the
// existing drag-and-drop handlers so there's a single upload path.
const onPanelUploadFiles = (files: File[], kind: "image" | "video") => {
  files.forEach((file) => {
    if (kind === "image") addDroppedBackgroundImage(file)
    else addDroppedBackgroundVideo(file)
  })
}

// Close any open panel when its trigger slide goes away or the type no longer
// supports the active panel.
watch(
  () => props.slide?.id,
  () => {
    activePanel.value = null
    backgroundPopoverSize.value = getInitialBackgroundPopoverSize()
  }
)

const slideContents = ref<Array<string>>([])
const verse = ref<string>(props.slide?.title || "")
const searchedBibleBookOptions = ref<string[]>([])
const containerOverflow = ref<string>("overflow-x-auto")
const selectedBibleVersion = ref<string>(
  appStore.currentState.settings.defaultBibleVersion
)
const shortcutCleanups: Array<() => void> = []
const { getSetlistData, refreshSongSetlistSlide, removeSongFromSetlist } =
  useSongSetlist()

watch(
  () => props.slide,
  (newSlide) => {
    if (newSlide) {
      selectedBibleVersion.value =
        newSlide.slideStyle?.bibleVersion ||
        appStore.currentState.settings.defaultBibleVersion
    }
  },
  { immediate: true }
)

const setlistData = computed<SongSetlistData>(() => getSetlistData(props.slide))
const isEmptySongSetlist = computed(
  () =>
    props.slide?.type === slideTypes.songSetlist &&
    setlistData.value.songs.length === 0
)

/**
 * Detect media that cannot be restored on this device. Every lookup goes
 * through the shared storage service so legacy IndexedDB bytes are migrated
 * lazily before we show the unavailable notice.
 */
const imageNotAvailable = ref(false)
const imageUnavailableReason = ref<MediaCloudSyncReason>()
const imageUnavailableCopy = ref(unavailableMediaCopy(null, "Image"))
let imageAvailabilityGeneration = 0

// Media this session is still holding is not missing media: an image the
// operator just added keeps its source Blob until compression and the write to
// local storage have both finished, and that whole window used to be reported
// as "added on another device" — a sync failure the operator can do nothing
// about, and the wrong story on a device that is simply offline.
const hasSessionCopy = (slide?: Slide) =>
  (slide?.data as ExtendedFileT)?.blob instanceof Blob

const checkImageAvailability = async () => {
  const requestGeneration = ++imageAvailabilityGeneration
  const slide = props.slide
  const slideId = slide?.id
  // Reset immediately when the slide changes so the notice doesn't stick
  imageNotAvailable.value = false
  imageUnavailableReason.value = undefined
  imageUnavailableCopy.value = unavailableMediaCopy(null, "Image")

  if (!slide || !slideId) return
  if (slide.type !== slideTypes.media) return
  if (slide.backgroundType !== "image") return

  if (hasSessionCopy(slide)) return
  // The write to local storage assigns the playback URL once it lands, and the
  // status change re-runs this check.
  if (transferFor(slideId)?.status === "pending") return

  const bg = slide.background
  if (!bg) return

  // If the background is already a remote URL, it's available everywhere
  if (bg.startsWith("http://") || bg.startsWith("https://")) return

  try {
    const localUrl = await localMedia.ensureLocal(slideId, {
      category: "slide",
      kind: "image",
      groupId: slideId,
    })
    if (!localUrl) {
      const syncState =
        (await localMedia.getCloudSyncState(slideId)) ||
        slide.mediaCloudSync?.[slideId]
      if (
        requestGeneration === imageAvailabilityGeneration &&
        props.slide?.id === slideId
      ) {
        imageUnavailableReason.value = syncState?.reason
        imageUnavailableCopy.value = unavailableMediaCopy(syncState, "Image")
        imageNotAvailable.value = true
      }
    }
  } catch (err) {
    console.error("Error checking media availability:", err)
    const syncState =
      (await localMedia.getCloudSyncState(slideId)) ||
      slide.mediaCloudSync?.[slideId]
    if (
      requestGeneration === imageAvailabilityGeneration &&
      props.slide?.id === slideId
    ) {
      imageUnavailableReason.value = syncState?.reason
      imageUnavailableCopy.value = unavailableMediaCopy(syncState, "Image")
      imageNotAvailable.value = true
    }
  }
}

// Re-checked on the background and transfer status too, not just the slide id:
// a save that finishes (or a resolve pass that fills the URL in) has to clear a
// notice that was raised while the bytes were still on their way to disk.
watch(
  () => [
    props.slide?.id,
    props.slide?.background,
    currentLocalTransfer.value?.status,
  ],
  () => {
    void checkImageAvailability()
  },
  { immediate: true }
)

const { isTeamsPlan } = useSubscription()

// Track total verses in the current Bible chapter for sequential navigation
const chapterVerseCount = ref<number>(0)

const fetchChapterVerseCount = async () => {
  if (props.slide?.type !== slideTypes.bible || !verse.value?.includes(":"))
    return
  const chapter = await useScriptureChapter(verse.value)
  chapterVerseCount.value = Array.isArray(chapter?.content)
    ? (chapter.content as any[]).length
    : 0
}

// Helper to resolve ":LAST" marker to actual last verse number (Bible only)
const resolveLastVerse = async (verseLabel: string): Promise<string> => {
  if (props.slide?.type !== slideTypes.bible || !verseLabel.includes(":LAST"))
    return verseLabel

  const chapterLabel = verseLabel.replace(":LAST", "")
  const chapter = await useScriptureChapter(chapterLabel)
  const lastVerseNumber = Array.isArray(chapter?.content)
    ? (chapter.content as any[]).length
    : 1

  return verseLabel.replace(":LAST", `:${lastVerseNumber}`)
}

// Label arithmetic lives in ~/utils/verseNavigation so the stage display can
// preview the same "next" this toolbar would navigate to.
const nextVerse = computed(() =>
  computeNextVerseLabel(props.slide, verse.value, chapterVerseCount.value)
)

const previousVerse = computed(() =>
  computePreviousVerseLabel(props.slide, verse.value)
)

watch(
  () => props.slide,
  (newSlide, oldSlide) => {
    // Update the verse input when:
    //  • switching to a different slide (id changed) — always reset
    //  • the title changed AND the user is not actively editing the input
    //    (i.e. the document active element is not the verse input field)
    // This prevents the input from snapping back to the last saved title while
    // the user is mid-navigation (the "goes back to recently selected verse" bug),
    // which was caused by the store watcher in PreviewContent re-assigning the
    // same activeSlide object reference, triggering this watcher unnecessarily.
    const verseInputFocused =
      typeof document !== "undefined" &&
      document.getElementById("bible-verse-input") === document.activeElement

    if (newSlide?.id !== oldSlide?.id) {
      // Different slide — always reset verse
      verse.value = newSlide?.title || ""
      slideContents.value = [...(newSlide?.contents || [])]
    } else if (newSlide?.title !== oldSlide?.title && !verseInputFocused) {
      // Same slide, title updated (e.g. after a successful gotoVerse) — update
      verse.value = newSlide?.title || ""
    }

    // Remove toolbar when Slide is updated, if slide.type is not text
    if (props.slide?.type !== slideTypes.text) {
      focusedEditor.value = undefined
    }

    // Fetch chapter verse count for sequential Bible navigation
    fetchChapterVerseCount()
  },
  { immediate: true }
)

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>

// Presentation page navigation
const handleGotoPage = (page: number) => {
  if (!props.slide) return
  const idx = page - 1
  const objects = props.slide.presentationObjects ?? []
  const updatedSlide: Slide = {
    ...props.slide,
    presentationPageIndex: idx,
    background: objects[idx]?.imageUrl || props.slide.background,
  }
  emit("slide-update", updatedSlide)
}

const handleNextPage = () => {
  const idx = (props.slide?.presentationPageIndex ?? 0) + 1
  if (idx >= props.slide?.presentationObjects?.length!) return
  handleGotoPage(idx + 1)
}

const handlePreviousPage = () => {
  const idx = (props.slide?.presentationPageIndex ?? 0) - 1
  if (idx < 0) return
  handleGotoPage(idx + 1)
}

const handleVoiceNextVerse = async () => {
  if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return
  if (nextVerse.value) {
    const resolvedVerse = await resolveLastVerse(nextVerse.value)
    emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
  }
}

const handleVoicePreviousVerse = async () => {
  if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return
  if (previousVerse.value) {
    const resolvedVerse = await resolveLastVerse(previousVerse.value)
    emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
  }
}

const handleVoiceGotoVerseNumber = (verseNumber: number) => {
  if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return
  const supportedSlideTypes = [
    slideTypes.bible,
    slideTypes.hymn,
    slideTypes.song,
    slideTypes.songSetlist,
  ]
  if (!props.slide || !supportedSlideTypes.includes(props.slide.type)) return
  if (!Number.isInteger(verseNumber) || verseNumber < 1) return

  if (props.slide.type === slideTypes.bible) {
    if (chapterVerseCount.value > 0 && verseNumber > chapterVerseCount.value)
      return

    const chapterSeparatorIndex = verse.value.lastIndexOf(":")
    if (chapterSeparatorIndex === -1) return

    const chapterLabel = verse.value.slice(0, chapterSeparatorIndex)
    emit(
      "goto-verse",
      `${chapterLabel}:${verseNumber}`,
      selectedBibleVersion.value
    )
    return
  }

  emit("goto-verse", `Verse ${verseNumber}`, selectedBibleVersion.value)
}

const handleVoiceBibleVersionChange = (version: string) => {
  if (!(appStore.currentState.settings.transcriptionAutoActions ?? true)) return
  if (
    !(
      appStore.currentState.settings.transcriptionVoiceBibleVersionCommands ??
      true
    )
  )
    return
  if (props.slide?.type !== slideTypes.bible) return

  const availableVersion = appStore.currentState.settings.bibleVersions?.find(
    (bibleVersion) =>
      bibleVersion?.id === version &&
      (bibleVersion?.isDownloaded ||
        bibleVersion?.id === appStore.currentState.settings.defaultBibleVersion)
  )
  if (
    !availableVersion &&
    version !== appStore.currentState.settings.defaultBibleVersion
  )
    return
  if (selectedBibleVersion.value === version) return

  onUpdateBibleVersion(version)
}

onMounted(() => {
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.nextVerse, () => {
      if (props.slide?.type === slideTypes.presentation) {
        handleNextPage()
        return true
      }
      if (nextVerse.value) {
        resolveLastVerse(nextVerse.value).then((resolvedVerse) => {
          emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
        })
        return true
      }
      return false
    })
  )
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.previousVerse, () => {
      if (props.slide?.type === slideTypes.presentation) {
        handlePreviousPage()
        return true
      }
      if (previousVerse.value) {
        resolveLastVerse(previousVerse.value).then((resolvedVerse) => {
          emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
        })
        return true
      }
      return false
    })
  )

  // Listen for voice command events
  emitter.on(appWideActions.nextVerse, handleVoiceNextVerse)
  emitter.on(appWideActions.previousVerse, handleVoicePreviousVerse)
  emitter.on(appWideActions.gotoVerseNumber, handleVoiceGotoVerseNumber)
  emitter.on(appWideActions.changeBibleVersion, handleVoiceBibleVersionChange)
})

onUnmounted(() => {
  shortcutCleanups.splice(0).forEach((cleanup) => cleanup())
  emitter.off(appWideActions.nextVerse, handleVoiceNextVerse)
  emitter.off(appWideActions.previousVerse, handleVoicePreviousVerse)
  emitter.off(appWideActions.gotoVerseNumber, handleVoiceGotoVerseNumber)
  emitter.off(appWideActions.changeBibleVersion, handleVoiceBibleVersionChange)
})

// Close an open overlay panel on Escape, ahead of the Quick Actions pane's
// own back-navigation but behind anything layered on top of the editor.
useEscapeKey(
  () => {
    if (!activePanel.value) return false
    activePanel.value = null
    return true
  },
  { priority: escapePriority.panel }
)

emitter.on("pause-inactive-slide-video", () => {
  if (props.slide?.type === slideTypes.media) {
    // console.log("pausing video")
  }
})

// Handlers for navigation buttons
const handleNextVerse = async () => {
  if (nextVerse.value) {
    const resolvedVerse = await resolveLastVerse(nextVerse.value)
    emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
  }
}

const handlePreviousVerse = async () => {
  if (previousVerse.value) {
    const resolvedVerse = await resolveLastVerse(previousVerse.value)
    emit("goto-verse", resolvedVerse, selectedBibleVersion.value)
  }
}

const goToSetlistSong = async (songIndex: number) => {
  if (!props.slide) return
  const item = setlistData.value.songs[songIndex]
  const updatedSlide = await refreshSongSetlistSlide(props.slide, {
    activeSongIndex: songIndex,
    verseIndex: item?.verseIndex || 0,
  })
  emit("slide-update", updatedSlide)
}

const removeSetlistSong = async (songIndex: number) => {
  if (!props.slide) return
  const updatedSlide = await removeSongFromSetlist(props.slide, songIndex)
  if (updatedSlide) emit("slide-update", updatedSlide)
}

// const onSelectLayout = (data: string) => {
//   layoutPopoverOpen.value = false
//   const tempSlide: Slide = {
//     ...props.slide,
//     layout: data,
//   }
//   emit("slide-update", tempSlide)
// }

const onSelectBackground = (
  backgroundType: string,
  data:
    | string
    | { image: string; key?: string }
    | { video: string; key?: string }
) => {
  const isImage = typeof data !== "string" && "image" in data
  const isVideo = typeof data !== "string" && "video" in data
  const tempSlide = {
    ...props.slide,
    background:
      typeof data === "string" ? data : isImage ? data.image : data.video,
    backgroundImageKey: isImage ? data.key : undefined,
    backgroundVideoKey: isVideo ? data.key : undefined,
    backgroundType,
  } as Slide
  emit("slide-update", tempSlide)
}

// Drag-and-drop a file onto the slide preview — treated as adding a background
// image/video, mirroring what BgImageSelection/BgVideoSelection do for uploads.
const maxDroppedBgImageSize = computed(() => Infinity)
const maxDroppedBgVideoSize = computed(() => Infinity)
const isDraggingBackgroundFile = ref(false)
let bgDragCounter = 0

const isFileDrag = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types || []).includes("Files")

const onBgDragEnter = (event: DragEvent) => {
  if (!props.slide || !isFileDrag(event)) return
  bgDragCounter++
  isDraggingBackgroundFile.value = true
}

const onBgDragOver = (event: DragEvent) => {
  if (!props.slide || !isFileDrag(event)) return
  event.preventDefault()
}

const onBgDragLeave = (event: DragEvent) => {
  if (!props.slide || !isFileDrag(event)) return
  bgDragCounter = Math.max(0, bgDragCounter - 1)
  if (bgDragCounter === 0) isDraggingBackgroundFile.value = false
}

const addDroppedBackgroundImage = async (file: File) => {
  const online = useOnline()
  try {
    const compressedBlob = await useCompressedImage(file)
    const compressedFile =
      compressedBlob instanceof File
        ? compressedBlob
        : new File([compressedBlob], file.name, {
            type: compressedBlob.type || file.type,
            lastModified: file.lastModified,
          })

    const id = `/custom-image-bg-${useID(6)}.${file.type?.split("/")?.[1]}`
    await localMedia.saveBlob({
      key: id,
      groupId: id,
      category: "background",
      kind: "image",
      blob: compressedFile,
      originalName: file.name,
      recoverable: false,
      userInitiated: true,
    })
    if (online.value) {
      try {
        const uploadedFile = await useUploadImage(compressedFile)
        await localMedia.setCloudSyncState(id, {
          groupId: id,
          status: "uploaded",
          remoteUrl: uploadedFile.file.url,
        })
      } catch (error) {
        await localMedia.setCloudSyncState(id, {
          groupId: id,
          status: "failed",
          reason: mediaCloudFailureReason(error),
          error,
        })
        console.warn("Background image cloud upload failed:", error)
      }
    }
    const imageUrl = await localMedia.getPlaybackUrl(id)
    if (!imageUrl) throw new Error("The saved image could not be opened.")
    onSelectBackground(backgroundTypes.image, { image: imageUrl, key: id })
  } catch (error) {
    console.error("Failed to add dropped background image:", error)
    useToast().add({
      title: "Failed to add background image",
      icon: "i-bx-error",
      color: "red",
    })
  }
}

const addDroppedBackgroundVideo = async (file: File) => {
  try {
    const id = `/custom-video-bg-${useID(6)}.${file.type?.split("/")?.[1]}`
    await localMedia.saveBlob({
      key: id,
      groupId: id,
      category: "background",
      kind: "video",
      blob: file,
      originalName: file.name,
      recoverable: false,
      userInitiated: true,
    })
    if (navigator.onLine) {
      try {
        const uploaded = await useUploadFile(file, { name: file.name })
        await localMedia.setCloudSyncState(id, {
          groupId: id,
          status: "uploaded",
          remoteUrl: uploaded.file.url,
        })
      } catch (error) {
        await localMedia.setCloudSyncState(id, {
          groupId: id,
          status: "failed",
          reason: mediaCloudFailureReason(error),
          error,
        })
        if (/quota|storage limit|storage full/i.test(String(error))) {
          useToast().add({
            title: isTeamsPlan.value
              ? "Cloud storage full"
              : "Free cloud storage full",
            description: isTeamsPlan.value
              ? "This video will only be available on this device until you free up cloud storage."
              : "This video will only be available on this device. Upgrade to Teams for 5GB of synced cloud storage.",
            icon: "i-bx-cloud",
            color: "amber",
          })
        } else {
          console.warn("Background video cloud upload failed:", error)
        }
      }
    }
    const videoUrl = await localMedia.getPlaybackUrl(id)
    if (!videoUrl) throw new Error("The saved video could not be opened.")
    onSelectBackground(backgroundTypes.video, {
      video: videoUrl,
      key: id,
    })
  } catch (error) {
    console.error("Failed to add dropped background video:", error)
    useToast().add({
      title: "Failed to add background video",
      icon: "i-bx-error",
      color: "red",
    })
  }
}

const onBgDrop = (event: DragEvent) => {
  if (!isFileDrag(event)) return
  event.preventDefault()
  bgDragCounter = 0
  isDraggingBackgroundFile.value = false
  if (!props.slide) return

  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  if (file.type.startsWith("image")) {
    if (file.size > maxDroppedBgImageSize.value * 1024 * 1024) {
      useToast().add({
        title: `Image size exceeds ${maxDroppedBgImageSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    addDroppedBackgroundImage(file)
  } else if (file.type.startsWith("video")) {
    if (file.size > maxDroppedBgVideoSize.value * 1024 * 1024) {
      useToast().add({
        title: `Video size exceeds ${maxDroppedBgVideoSize.value}MB`,
        icon: "i-bx-info-circle",
        color: "red",
      })
      return
    }
    addDroppedBackgroundVideo(file)
  } else {
    useToast().add({
      title: "Unsupported file type",
      description: "Drop an image or video to set as background",
      icon: "i-bx-error",
      color: "red",
    })
  }
}

const onSelectTheme = (themeId: string) => {
  const tempSlide: Slide = {
    ...props.slide!!,
    slideStyle: {
      ...props.slide?.slideStyle,
      theme: themeId,
    },
  }
  emit("slide-update", tempSlide)
}

const onUpdateSlideContent = (editorIndex: number, content: string) => {
  slideContents.value[editorIndex] = content
  const tempSlide: Slide = {
    ...props.slide!!,
    contents: [...slideContents.value],
  }
  // console.log("updated content", tempSlide)
  tempSlide.name = useSlideName(tempSlide)
  emit("slide-update", tempSlide)
  // emit("update-live-output-slides")
}

// Function to update style of slide that is either active or inactive
const onUpdateSlideStyle = (
  slideStyle: SlideStyle,
  isSlideActive: boolean = true
) => {
  const tempSlide: Slide = {
    ...props.slide!!,
    slideStyle,
  }
  tempSlide.name = useSlideName(tempSlide)
  emit(isSlideActive ? "slide-update" : "inactive-slide-update", tempSlide)
}

// For just restarting, to go back to position 0
const onUpdateMediaSeekPosition = (slideStyle: SlideStyle) => {
  onUpdateSlideStyle(slideStyle)

  setTimeout(() => {
    onUpdateSlideStyle({ ...slideStyle, mediaSeekPosition: -1 })
  }, 5000)
}

// For Multiple seek Positions - Technical debt here
// TODO: This function and [onUpdateMediaSeekPosition] need to be merged some way.
const onUpdateMediaSeek = (seekTime: number) => {
  const slideStyle = {
    ...props.slide?.slideStyle,
    mediaSeekPosition: seekTime,
  }
  onUpdateSlideStyle(slideStyle)

  setTimeout(() => {
    onUpdateSlideStyle({ ...slideStyle, mediaSeekPosition: -1 })
  }, 5000)
}

const onUpdateSongLyrics = async (song: Song) => {
  // Defensive: the toolbar already filters failed lookups, but this handler is
  // wired to a template event and must not crash the editor on a null payload.
  if (!song) return

  // A setlist carries a song per entry — swap the refreshed lyrics into the
  // active entry and let the setlist rebuild the slide around it.
  if (props.slide?.type === slideTypes.songSetlist) {
    const data = setlistData.value
    const activeSongIndex = data.activeSongIndex
    const activeItem = data.songs[activeSongIndex]
    if (!activeItem) return

    const songs = data.songs.map((item, index) =>
      index === activeSongIndex
        ? { ...item, song, songId: song._id || song.id }
        : item
    )
    // refreshSongSetlistSlide clamps the verse index, so a refresh that dropped
    // verses lands on the last one instead of blanking the slide.
    const updatedSlide = await refreshSongSetlistSlide(
      { ...props.slide, data: { ...data, songs } },
      { activeSongIndex, verseIndex: activeItem.verseIndex }
    )
    emit("slide-update", updatedSlide)
    useToast().add({
      icon: "i-bx-music",
      title: "Song lyrics updated",
    })
    return
  }

  const tempSlide: Slide = {
    title: song.title,
    ...props.slide!!,
    data: song,
  }
  const currentSongVerseNumber = Number(verse.value?.split(" ")?.[1])
  const currentSongVerse = song.verses?.[currentSongVerseNumber - 1]

  tempSlide.name = useSlideName(tempSlide)
  let fontSize = useScreenFontSize(currentSongVerse || "")
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
  }
  tempSlide.data = song
  tempSlide.contents = useSlideContent(tempSlide, song, currentSongVerse)
  tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
    ? slideLayoutTypes.bible
    : slideLayoutTypes.full_text
  emit("slide-update", tempSlide)
  // console.log(verse.value)
  useToast().add({
    icon: "i-bx-music",
    title: "Song lyrics updated",
  })
}

const onUpdateSongLines = async (linesPerSlide: number) => {
  // Captured before anything re-chunks, so the active chunk can be re-pointed
  // at the line the operator is actually reading (see remapChunkIndex)
  const previousLinesPerSlide =
    props.slide?.slideStyle?.linesPerSlide ??
    appStore.currentState.settings.slideStyles.linesPerSlide

  if (props.slide?.type === slideTypes.hymn) {
    if (!props.slide) return
    appStore.setSlideStyles({
      ...appStore.currentState.settings.slideStyles,
      linesPerSlide,
    })
    const hymn = await useHymn(props.slide.songId as string)
    if (!hymn) {
      useToast().add({
        title: "Hymn not found",
        icon: "i-bx-error",
        color: "red",
      })
      return
    }
    const currentTitle = verse.value || props.slide.title || "Verse 1"
    let rawText: string
    if (currentTitle.startsWith("Chorus")) {
      rawText = hymn.chorus as string
    } else {
      const verseIndex = Number(currentTitle?.split(" ")?.[1]) - 1
      rawText = hymn.verses?.[verseIndex]?.trim() ?? ""
    }
    const chunks = splitVerseByLines(rawText, linesPerSlide)
    const activeIdx = remapChunkIndex(
      splitVerseByLines(rawText, previousLinesPerSlide),
      props.slide.hymnSubVerseIndex ?? 0,
      chunks
    )
    const displayVerse = chunks[activeIdx] ?? ""
    const tempSlide: Slide = {
      ...props.slide,
      slideStyle: {
        ...props.slide.slideStyle,
        linesPerSlide,
        fontSize: Number(useScreenFontSize(displayVerse)),
      },
      hymnSubVerseIndex: activeIdx,
      hymnSubVerseTotal: chunks.length,
    }
    tempSlide.contents = useSlideContent(tempSlide, hymn, displayVerse)
    tempSlide.layout = appStore.currentState.settings
      .songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    emit("slide-update", tempSlide)
    useToast().add({
      icon: "i-tabler-list-numbers",
      title: "Lines per slide updated",
    })
    return
  }

  if (props.slide?.type === slideTypes.songSetlist) {
    appStore.setSlideStyles({
      ...appStore.currentState.settings.slideStyles,
      linesPerSlide,
    })
    const slideStyle = {
      ...props.slide.slideStyle,
      linesPerSlide,
    }
    const activeSongIndex = setlistData.value.activeSongIndex
    const activeItem = setlistData.value.songs[activeSongIndex]
    // useSong() re-chunks the song object in place, so snapshot the current
    // arrangement before asking for the new one
    const previousVerses = [...(activeItem?.song?.verses || [])]
    const previousVerseIndex = activeItem?.verseIndex || 0
    const rechunkedSong = activeItem
      ? await useSong(activeItem.song || activeItem.songId, linesPerSlide)
      : null
    const updatedSlide = await refreshSongSetlistSlide(props.slide, {
      activeSongIndex,
      verseIndex: rechunkedSong?.verses?.length
        ? remapChunkIndex(
            previousVerses,
            previousVerseIndex,
            rechunkedSong.verses
          )
        : previousVerseIndex,
    })
    emit("slide-update", { ...updatedSlide, slideStyle })
    return
  }

  // console.log("updating song lines", linesPerSlide)
  const song = (props.slide?.data as Song) || props.slide?.songId
  // useSong() re-chunks the song object in place, so snapshot the current
  // arrangement before asking for the new one
  const previousVerses = [...((song as Song)?.verses || [])]
  const currentSongVerseNumber = Number(verse.value?.split(" ")?.[1])
  const previousVerseIndex = Number.isFinite(currentSongVerseNumber)
    ? currentSongVerseNumber - 1
    : 0
  const tempSong: Song | null = await useSong(song, linesPerSlide)
  // console.log(tempSong)
  if (tempSong) {
    const activeVerseIndex = previousVerses.length
      ? remapChunkIndex(
          previousVerses,
          previousVerseIndex,
          tempSong.verses || []
        )
      : Math.min(
          Math.max(previousVerseIndex, 0),
          Math.max((tempSong.verses?.length || 1) - 1, 0)
        )
    const currentSongVerse = tempSong.verses?.[activeVerseIndex]
    const tempSlide: Slide = {
      title: tempSong.title,
      ...props.slide!!,
      data: tempSong,
    }
    tempSlide.title = `Verse ${activeVerseIndex + 1}`
    verse.value = tempSlide.title

    tempSlide.name = useSlideName(tempSlide)
    let fontSize = useScreenFontSize(currentSongVerse || "")
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
    }
    tempSlide.data = tempSong
    tempSlide.contents = useSlideContent(tempSlide, tempSong, currentSongVerse)
    tempSlide.layout = appStore.currentState.settings
      .songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    emit("slide-update", tempSlide)
  }
}

const onUpdateBibleVersion = (version: string) => {
  if (!props.slide) return
  onUpdateSlideStyle({ ...props.slide.slideStyle, bibleVersion: version })
  emit("update-bible-version", version)
}

const predictVerseInput = (
  element: HTMLInputElement | undefined,
  specificBook?: string
) => {
  if (verse.value?.trim()) {
    const bibleVerseInput = document.getElementById(
      "bible-verse-input"
    ) as HTMLInputElement
    if (typeof specificBook === "string") {
      verse.value = `${specificBook} 1:1`
      setTimeout(() => {
        bibleVerseInput?.setSelectionRange(
          specificBook.length + 1,
          specificBook.length + 2
        )
        bibleVerseInput?.focus()
      }, 1000)
    } else if (verse.value.endsWith(" ")) {
      // DO nothing
    } else if (verse.value?.includes(":")) {
      setTimeout(() => {
        element?.setSelectionRange(
          (verse.value?.indexOf(":") || 0) + 1,
          (verse.value?.indexOf(":") || 0) + 2
        )
        element?.focus()
      }, 100)
    } else if (searchedBibleBookOptions.value?.[0]) {
      const bookOption = searchedBibleBookOptions.value[0]
      verse.value = `${bookOption} 1:1`
      setTimeout(() => {
        element?.setSelectionRange(bookOption.length + 1, bookOption.length + 2)
        element?.focus()
      }, 100)
    } else {
      // do nothing
    }
    bibleVerseInput?.focus()
  }
}
</script>

<style scoped>
.verse-preview,
.books-preview {
  visibility: hidden;
  max-height: 0px;
  transition: 0.2s;
}
/* .books-preview {
  visibility: visible;
  max-height: 1400px;
} */
.verse-switch:hover + .verse-preview,
.verse-preview:hover,
.books-preview:hover {
  opacity: 1;
  visibility: visible;
  max-height: calc(100% - 3rem);
}

/* Keep the chapter list open while the verse input has focus, so the operator
   can type a reference and still see where they are. Suppressed while the book
   autocomplete is on screen (a bare book name, no ":") — there the chapter list
   has nothing valid to show, and the book list below takes over.
   `~` rather than `+` for .books-preview: .verse-preview sits between them. */
.actions:not(:has(.books-preview)) .verse-switch:focus-within + .verse-preview,
.verse-switch:focus-within ~ .books-preview {
  opacity: 1;
  visibility: visible;
  max-height: calc(100% - 3rem);
}

.preview-pages {
  visibility: hidden;
  max-height: 0px;
  transition: 0.2s;
}
.page-switch:hover + .preview-pages,
.page-switch:focus-within + .preview-pages,
.preview-pages:hover {
  opacity: 1;
  visibility: visible;
  max-height: 350px;
}

/* Lightweight, selectable preview for generated slide content. This keeps the
   direct-HTML performance path while giving the text an editor-like affordance. */
.text-slide-editor-preview,
.static-slide-editor-preview {
  position: absolute !important;
  inset: 0;
  transform: scale(0.88);
  transform-origin: center;
  pointer-events: auto !important;
  user-select: text !important;
  cursor: text;
}

.text-slide-editor-preview :deep(.tiptap-editor) {
  border-radius: 0.4rem;
  box-shadow: 0 0 0 1px rgba(203, 213, 225, 0.32);
  transition: box-shadow 120ms ease, background-color 120ms ease;
}

.text-slide-editor-preview :deep(.tiptap-editor:hover),
.text-slide-editor-preview :deep(.tiptap-editor:focus) {
  background-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 1px rgba(226, 232, 240, 0.72);
}

.text-slide-editor-preview :deep(.ProseMirror::selection),
.text-slide-editor-preview :deep(.ProseMirror *::selection) {
  color: #ffffff;
  background-color: rgba(168, 85, 247, 0.82);
}

.static-slide-editor-preview :deep(.content),
.static-slide-editor-preview :deep(.content *) {
  pointer-events: auto;
  user-select: text !important;
}

.static-slide-editor-preview :deep(.content) {
  border-radius: 0.4rem;
  box-shadow: 0 0 0 1px rgba(203, 213, 225, 0.32);
  transition: box-shadow 120ms ease, background-color 120ms ease;
}

.static-slide-editor-preview :deep(.content:hover) {
  background-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 1px rgba(226, 232, 240, 0.72);
}

.static-slide-editor-preview :deep(.content::selection),
.static-slide-editor-preview :deep(.content *::selection) {
  color: #ffffff;
  background-color: rgba(148, 163, 184, 0.62);
}
</style>
