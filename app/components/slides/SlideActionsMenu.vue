<template>
  <MoreActionsMenu
    ref="menuRef"
    v-slot="{ close }"
    flush
    :trigger-class="triggerClass"
    :icon-class="iconClass"
    @update:open="$emit('update:open', $event)"
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
</template>

<script setup lang="ts">
/**
 * The per-slide actions menu (duplicate, save to library, download media,
 * delete…).
 *
 * Extracted from SlideCard so the slide editor can offer the same actions next
 * to the slide's name. On mobile that is the only place they are reachable at
 * all: the editor covers the grid, so the card's own menu is off screen for as
 * long as the operator is editing.
 */
import { appWideActions } from "~/utils/constants"
import type { Slide, Song, SongSetlistData } from "~/types"
import { useAuthStore } from "~/store/auth"

const authStore = useAuthStore()
const { hasAccessToFeature } = useSubscription()
const { getLibraryItem } = useLibrary()
const { canDownloadMedia, downloadSlideMedia } = useSlideMediaDownload()

const props = defineProps<{
  slide: Slide
  triggerClass?: string
  iconClass?: string
}>()

const emit = defineEmits([
  "duplicate",
  "duplicate-as-overlay",
  "save-slide",
  "save-as-template",
  "update:open",
])

// SlideCard opens this menu from a right-click on the card itself.
const menuRef = ref<{ open: () => void; close: () => void } | null>(null)
defineExpose({
  open: () => menuRef.value?.open(),
  close: () => menuRef.value?.close(),
})

const canDuplicateAsOverlay = computed(
  () =>
    props.slide.slideMode !== "overlay" &&
    (props.slide.type === slideTypes.time ||
      (props.slide.type === slideTypes.text &&
        [slideLayoutTypes.full_text, slideLayoutTypes.heading_sub].includes(
          props.slide.layout
        )))
)

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
