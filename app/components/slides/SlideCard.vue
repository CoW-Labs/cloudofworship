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
      <MoreActionsMenu
        ref="moreActionsMenuRef"
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

        <!-- A song slide is already backed by the library song it was created
        from, so "save to library" is redundant here — edit the source instead.
        A setlist edits whichever of its songs is currently showing. -->
        <UButton
          v-if="canEditSong && slide?.slideMode !== 'overlay'"
          variant="ghost"
          color="gray"
          block
          @click.stop.prevent="
            () => {
              close()
              handleEditSongClick()
            }
          "
        >
          <template #leading><EditIcon class="w-4 h-4" /></template>
          {{
            slide?.type === slideTypes.songSetlist
              ? "Edit active song in library"
              : "Edit song in library"
          }}
        </UButton>

        <ConfirmDialog
          v-if="
            slide?.slideMode !== 'overlay' &&
            (slide?.type === slideTypes.text ||
              slide?.type === slideTypes.media ||
              slide?.type === slideTypes.hymn)
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
          v-if="canDownloadMedia(slide)"
          variant="ghost"
          color="gray"
          block
          :loading="downloadingMedia"
          @click.stop.prevent="
            () => {
              handleDownloadMediaClick()
              close()
            }
          "
        >
          <template v-if="!downloadingMedia" #leading>
            <DownloadIcon class="w-4 h-4" />
          </template>
          Download Media
        </UButton>

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
import type { Slide, Song, SongSetlistData } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)

// Subscription check
const { hasAccessToFeature } = useSubscription()
const { getLibraryItem } = useLibrary()
const { canDownloadMedia, downloadSlideMedia } = useSlideMediaDownload()

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

const actionsMenuOpen = ref(false)
const moreActionsMenuRef = ref<{ open: () => void; close: () => void } | null>(
  null
)

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

// Opens the library's song editor on the song this slide was created from,
// preferring the saved library copy over the snapshot carried on the slide.
// The song this slide edits: its own for a song slide, the active entry for a
// setlist. Undefined for every other slide type, which hides the action.
const editableSong = computed<Song | undefined>(() => {
  if (props.slide?.type === slideTypes.songSetlist) {
    const data = props.slide?.data as SongSetlistData | undefined
    return data?.songs?.[data?.activeSongIndex || 0]?.song
  }
  if (props.slide?.type === slideTypes.song) {
    return props.slide?.data as Song | undefined
  }
  return undefined
})

const editableSongId = computed(() => {
  if (props.slide?.type === slideTypes.songSetlist) {
    const data = props.slide?.data as SongSetlistData | undefined
    const activeItem = data?.songs?.[data?.activeSongIndex || 0]
    return (
      activeItem?.songId || activeItem?.song?._id || activeItem?.song?.id || ""
    )
  }
  return (
    props.slide?.songId ||
    editableSong.value?._id ||
    editableSong.value?.id ||
    ""
  )
})

// A song slide always knows its song, by object or by id; a setlist needs at
// least one song in it.
const canEditSong = computed(
  () =>
    (props.slide?.type === slideTypes.song ||
      props.slide?.type === slideTypes.songSetlist) &&
    !!editableSongId.value
)

const handleEditSongClick = async () => {
  const songId = editableSongId.value
  const libraryItem = songId ? await getLibraryItem(songId) : undefined
  const song = (libraryItem?.content as Song) || editableSong.value

  if (!song) {
    useToast().add({
      icon: "i-bx-error",
      title: "This slide is not linked to a song yet",
      color: "red",
    })
    return
  }

  useGlobalEmit(appWideActions.addSong, song)
}

// Saves the slide's own media file to the user's computer, named after the
// slide (e.g. "Sunday Promo.mp4" → "sunday_promo.mp4"). Cloud-only media is
// pulled down first, so this can run for a while on a large video.
const downloadingMedia = ref(false)

const handleDownloadMediaClick = async () => {
  if (downloadingMedia.value) return
  downloadingMedia.value = true
  try {
    await downloadSlideMedia(props.slide)
  } finally {
    downloadingMedia.value = false
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
