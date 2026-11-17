<template>
  <!-- GRID TYPE CARD -->
  <div
    v-if="gridType"
    class="slide-card gap-3 h-[120px] rounded-lg bg-black transition-all cursor-pointer relative overflow-hidden"
    :id="slide?.id?.replace(/\d+/g, '')"
    :class="[
      selected ? 'border-black' : 'border-transparent',
      {
        selectable: selectable,
        'pair-drop-target': isPairDropTarget,
        'pair-drop-candidate': isPairCandidate && !isPairDropTarget,
      },
    ]"
    :draggable="!selectable && !isLocked"
    @contextmenu.prevent="!isLocked && moreActionsMenuRef?.open()"
    @dragstart="onSlideDragStart"
    @dragend="onSlideDragEnd"
    @dragover="onSlideDragOver"
    @dragleave="onSlideDragLeave"
    @drop="onSlideDrop"
  >
    <CowTooltip
      :text="gridCardHint"
      :prevent="selectable || isBeingDragged"
      :open-delay="700"
      class="w-full h-full"
    >
      <button
        :class="[
          'w-full h-full transition-all text-left rounded-lg overflow-hidden',
          { 'opacity-70 ': selectable },
        ]"
        @click="!isLocked && $emit('click')"
        @dblclick.prevent="!isLocked && $emit('take-live')"
      >
        <DeferredSlidePreview
          preview-class="slide-preview text-white overflow-hidden md-preview"
          :slide="slide"
          :slide-label="slide?.name"
          :slide-styles="currentState.settings.slideStyles"
          :eager="selected"
        />
        <!-- MEDIA STILL DOWNLOADING — the preview has nothing to draw until the
             bytes land on this device, so an untouched card is indistinguishable
             from an empty slide. Covering just the preview (the name and chip
             below are painted after it, so they stay readable) says "this
             thumbnail is still coming" rather than "this slide is empty". -->
        <USkeleton
          v-if="isMediaLoading"
          class="media-loading inset-0 rounded-lg"
          :ui="skeletonUi"
        />
        <!-- CLOUD UPLOAD — bottom left. While files are going to the cloud the
             card shows how far along they are: "Uploading" on the device that is
             sending them, "Syncing" on every other. That takes the place of the
             "only on a device" note, which shows only once nothing is moving.
             Clicks pass through; a teammate's card ignores them anyway while it
             is locked (see isLockedByUpload). -->
        <div
          v-if="isUploading"
          class="upload-status absolute bottom-2 right-12 z-[5] flex flex-col gap-1 pointer-events-none"
          :class="editingBy ? 'left-11' : 'left-2'"
          role="status"
        >
          <span class="text-[11px] font-semibold leading-none text-white">{{
            uploadLabel
          }}</span>
          <CowProgressBar :value="uploadPercent ?? 0" on-dark />
        </div>
        <!-- STAYED BEHIND — the media never left its owner's device, so there is
             nothing to draw. A faint icon says so, instead of a blank card. The
             label and Retry sit below, outside this button. -->
        <div
          v-else-if="deviceOnlyLabel"
          class="absolute inset-0 z-[4] flex items-center justify-center pointer-events-none"
        >
          <UIcon name="i-ph-cloud-slash" class="w-7 h-7 text-white/40" />
        </div>
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

        <!-- Dropping another slide on a camera pairs the two (or, on a pair's
             card, puts it in place of the camera's partner). -->
        <div
          v-if="isPairDropTarget"
          class="absolute inset-0 z-10 flex items-center justify-center bg-primary-600/60 text-white text-xs font-semibold gap-1.5 pointer-events-none"
        >
          <UIcon name="i-tabler-layout-columns" class="w-4 h-4" />
          {{ pair ? "Drop to replace" : "Drop to pair" }}
        </div>

        <!-- While this card is being dragged it says where to take it. -->
        <div v-if="isBeingDragged" :class="DRAG_HINT_CLASS">
          <UIcon name="i-tabler-layout-columns" class="w-4 h-4 shrink-0" />
          {{ DRAG_HINT }}
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

    <!-- STAYED BEHIND label, bottom left, once nothing is uploading. The device
         that owns the files can send them again; nobody else has them. A real
         button, so it sits outside the card's own button. -->
    <div
      v-if="deviceOnlyLabel && !isUploading"
      class="absolute bottom-2 right-12 z-[5] flex items-center gap-1.5 pointer-events-none"
      :class="editingBy ? 'left-11' : 'left-2'"
    >
      <span
        class="min-w-0 truncate rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white"
      >
        {{ deviceOnlyLabel }}
      </span>
      <CowTooltip v-if="canRetryHere" text="Upload it again">
        <button
          type="button"
          class="pointer-events-auto grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/90 text-primary-700 transition hover:bg-white disabled:opacity-60"
          aria-label="Retry upload"
          :disabled="isRetrying"
          @click.stop="retryUpload"
        >
          <UIcon
            :name="isRetrying ? 'i-ph-spinner-gap-bold' : 'i-ph-upload-simple-bold'"
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': isRetrying }"
          />
        </button>
      </CowTooltip>
    </div>

    <!-- SLIDE PAIR — the pair icon and one dot per member. The card previews
         the member this window is editing; a dot switches to another, which
         loads it in the editor with its own controls. What is on screen does
         not change. -->
    <div
      v-if="pair"
      class="pair-switcher absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-white"
    >
      <CowTooltip :text="pairHint">
        <UIcon name="i-tabler-layout-columns" class="w-3.5 h-3.5" />
      </CowTooltip>
      <CowTooltip
        v-for="(memberId, position) in pair.slideIds"
        :key="memberId"
        :text="memberLabel(memberId, position)"
      >
        <button
          type="button"
          class="block w-2 h-2 rounded-full transition"
          :class="
            editingMemberId === memberId
              ? 'bg-white'
              : 'bg-white/40 hover:bg-white/70'
          "
          :aria-label="memberLabel(memberId, position)"
          :aria-pressed="editingMemberId === memberId"
          @click.stop="
            useGlobalEmit(appWideActions.setPairActiveMember, {
              pairId: pair.id,
              slideId: memberId,
            })
          "
        />
      </CowTooltip>
      <CowTeamsPreviewNotice
        v-if="!hasAccessToFeature(appWideActions.slidePair)"
        variant="text"
        title="Teams"
        :feature="appWideActions.slidePair"
        class="!text-[11px] [&_svg]:!w-3 [&_svg]:!h-3"
      />
    </div>

    <!-- Bottom gradient for action icon contrast -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg"
    ></div>

    <!-- SLIDE ACTIONS MENU -->
    <div
      v-if="!isLocked"
      class="actions absolute bottom-2 right-2 flex gap-1"
      :class="{ 'menu-open': actionsMenuOpen }"
    >
      <SlideActionsMenu
        ref="moreActionsMenuRef"
        :slide="slide"
        trigger-class="rounded-full hover:!bg-white/10"
        icon-class="text-white"
        @update:open="actionsMenuOpen = $event"
        @duplicate="$emit('duplicate', $event)"
        @duplicate-as-overlay="$emit('duplicate-as-overlay', $event)"
        @save-slide="$emit('save-slide', $event)"
        @save-as-template="$emit('save-as-template', $event)"
      />
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
    :class="{ 'opacity-60 cursor-not-allowed': isLocked }"
    @click="
      isLocked
        ? undefined
        : slide?.slideMode === 'overlay'
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
    <!-- Sits exactly over the thumbnail: the row's padding is p-2 and the
         preview is w-24 h-16, so no wrapper element is needed. -->
    <USkeleton
      v-if="isMediaLoading"
      class="media-loading left-2 top-2 h-16 w-24 rounded-md"
      :ui="skeletonUi"
    />
    <div class="texts flex-col justify-between">
      <h4 class="font-medium mt-2">{{ slide?.name }}</h4>
      <SlideChip
        :slide-type="slide?.type"
        :slide-mode="slide?.slideMode"
        class="mt-1"
      />
      <div v-if="isUploading" class="mt-1 w-28" role="status">
        <p class="mb-1 text-xs leading-none text-gray-500 dark:text-gray-400">
          {{ uploadLabel }}
        </p>
        <CowProgressBar :value="uploadPercent ?? 0" />
      </div>
      <p
        v-else-if="deviceOnlyLabel"
        class="mt-1 text-xs text-gray-500 dark:text-gray-400"
      >
        {{ deviceOnlyLabel }}
      </p>
    </div>
    <!-- DELETE SLIDE BUTTON -->
    <div v-if="!isLocked" class="actions absolute bottom-2 right-2 flex gap-1">
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
import type { Slide, SlidePair } from "~/types"
import {
  SLIDE_PAIR_LAYOUTS,
  canBePairTarget,
  isCameraSlide,
  pairRejection,
  pairRoles,
} from "~/utils/slidePairs"
import { draggingSlideId, editingMemberOf } from "~/composables/useSlidePairs"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { useIntervalFn } from "@vueuse/core"
import useIndexedDB from "~/composables/useIndexedDB"
import { cloudKeysForSlide, isLockedByUpload } from "~/utils/pendingUpload"
import useSlideUploadProgress, {
  UPLOAD_STALE_AFTER_MS,
} from "~/composables/useSlideUploadProgress"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)

// Gates the overlay action below. The rest of the card's gating moved to
// SlideActionsMenu along with the actions it guards.
const { hasAccessToFeature } = useSubscription()

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
  /** Set when this card stands for a slide pair; `slide` is the member shown. */
  pair?: SlidePair
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
  "pair-drop",
])

// ── Drag a slide onto a camera to pair them ─────────────────────────────────
// A type of our own, so the grid's media-file drop (which looks for "Files")
// and this never mistake one for the other. Only a camera takes a drop: every
// pair has one. A pair's card takes one when it holds a single camera, and the
// dropped slide replaces the camera's partner.
const SLIDE_DRAG_TYPE = "application/x-cow-slide"
const isPairDropTarget = ref(false)

const isSlideDrag = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types || []).includes(SLIDE_DRAG_TYPE)

const acceptsPairDrop = (sourceId: string | null) => {
  if (!props.gridType || props.selectable || !sourceId) return false
  if (isLocked.value) return false
  const source = appStore.activeSlidesById.get(sourceId)
  if (!source || sourceId === props.slide.id) return false
  if (isLockedByUpload(source, authStore.user?._id)) return false
  if (props.pair) {
    if (props.pair.slideIds.includes(sourceId)) return false
    const cameras = pairMembers.value.filter(isCameraSlide)
    return (
      cameras.length === 1 &&
      source.slideMode !== "overlay" &&
      !appStore.pairForSlide(sourceId)
    )
  }
  return (
    canBePairTarget(props.slide) &&
    !pairRejection(props.slide, source, appStore.pairForSlide)
  )
}

// Every card that would take the slide being dragged shows it, so the operator
// can see where to let go before reaching it.
const isBeingDragged = computed(
  () => !!props.slide?.id && draggingSlideId.value === props.slide.id
)
const isPairCandidate = computed(() => acceptsPairDrop(draggingSlideId.value))

// Shown on the card while it is dragged, and on the drag image itself.
const DRAG_HINT = "Drop onto a camera slide to create a pair"
const DRAG_HINT_CLASS =
  "absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-3 text-center text-white text-xs font-semibold gap-1.5 pointer-events-none"

// Copies the thumbnail for the drag image. A copied <video> or <iframe> would
// start loading its source all over again (and a camera's stream doesn't copy
// at all), and a copied <canvas> comes out blank, so each becomes a canvas
// holding the frame on screen now. An iframe can't be drawn and stays black.
const DRAG_MEDIA = new Set(["VIDEO", "CANVAS", "IFRAME"])
const copyForDragImage = (node: Node): Node => {
  if (!(node instanceof HTMLElement) || !DRAG_MEDIA.has(node.tagName)) {
    const copy = node.cloneNode(false)
    node.childNodes.forEach((child) => copy.appendChild(copyForDragImage(child)))
    return copy
  }
  const still = document.createElement("canvas")
  for (const { name, value } of Array.from(node.attributes)) {
    if (name !== "src") still.setAttribute(name, value)
  }
  still.style.backgroundColor = "black"
  const frame =
    node instanceof HTMLVideoElement
      ? { source: node, width: node.videoWidth, height: node.videoHeight }
      : node instanceof HTMLCanvasElement
        ? { source: node, width: node.width, height: node.height }
        : null
  if (frame?.width && frame.height) {
    still.width = frame.width
    still.height = frame.height
    still.getContext("2d")?.drawImage(frame.source, 0, 0)
  }
  return still
}

const onSlideDragStart = (event: DragEvent) => {
  if (!props.gridType || props.selectable || !event.dataTransfer) return
  if (isLocked.value) {
    event.preventDefault()
    return
  }
  event.dataTransfer.setData(SLIDE_DRAG_TYPE, props.slide.id)
  event.dataTransfer.effectAllowed = "link"
  // The browser snapshots the whole card for the drag image, which would drag
  // an open tooltip along with it, and it ignores the card's rounded clipping.
  // Snapshot a rounded copy of just the thumbnail instead.
  const thumb = (event.currentTarget as HTMLElement).querySelector("button")
  if (thumb) {
    const rect = thumb.getBoundingClientRect()
    const ghost = document.createElement("div")
    ghost.className = "rounded-lg overflow-hidden bg-black relative"
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-1000px",
      left: "0",
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
    ghost.appendChild(copyForDragImage(thumb))
    const hint = document.createElement("div")
    hint.className = DRAG_HINT_CLASS
    hint.textContent = DRAG_HINT
    ghost.appendChild(hint)
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(
      ghost,
      event.clientX - rect.left,
      event.clientY - rect.top
    )
    setTimeout(() => ghost.remove(), 0)
  }
  draggingSlideId.value = props.slide.id
}

// Fires on the dragged card however the drag ends: dropped, or let go.
const onSlideDragEnd = () => {
  draggingSlideId.value = null
}

const onSlideDragOver = (event: DragEvent) => {
  if (!isSlideDrag(event) || !acceptsPairDrop(draggingSlideId.value)) return
  // Only a card that would take it says so; every other card leaves the
  // browser's no-drop cursor.
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = "link"
  isPairDropTarget.value = true
}

// Moving over the card's own children fires dragleave on the card first, so
// only a leave to outside it clears the highlight.
const onSlideDragLeave = (event: DragEvent) => {
  const next = event.relatedTarget as Node | null
  if (next && (event.currentTarget as HTMLElement).contains(next)) return
  isPairDropTarget.value = false
}

const onSlideDrop = (event: DragEvent) => {
  isPairDropTarget.value = false
  if (!isSlideDrag(event)) return
  event.preventDefault()
  const sourceId =
    event.dataTransfer?.getData(SLIDE_DRAG_TYPE) || draggingSlideId.value
  draggingSlideId.value = null
  if (!sourceId || !acceptsPairDrop(sourceId)) return
  emit("pair-drop", sourceId)
}

const pairMembers = computed(() =>
  (props.pair?.slideIds ?? [])
    .map((id) => appStore.activeSlidesById.get(id))
    .filter((slide): slide is Slide => !!slide)
)

const editingMemberId = computed(() =>
  props.pair ? editingMemberOf(props.pair) : null
)

const memberLabel = (memberId: string, _position: number) => {
  const member = appStore.activeSlidesById.get(memberId)
  const role = isCameraSlide(member)
    ? "Camera"
    : pairRoles(pairMembers.value).frame?.id === memberId
    ? "Picture"
    : "Words"
  return `${role}: ${member?.name || "Slide"}`
}

const pairHint = computed(() => {
  const layout = SLIDE_PAIR_LAYOUTS.find(
    (option) => option.value === props.pair?.layout
  )
  return `Slide pair, ${(layout?.label || "side by side").toLowerCase()}`
})

// The preview grid and the schedule list both use double-click, but for
// opposite actions — spell out which is which so nobody has to discover it.
const gridCardHint = computed(() =>
  props.slide?.slideMode === "overlay"
    ? "Click to preview · Double-click to show overlay"
    : props.pair
    ? "Click to edit · Double-click to take the pair live"
    : canBePairTarget(props.slide)
    ? "Click to preview · Double-click to take live · Drop a slide here to pair it"
    : "Click to preview · Double-click to take live · Drag onto a camera slide to pair"
)

// ── Cloud upload of this slide's media ──────────────────────────────────────
// A slide can reach this device before its files reach the cloud. Its owner
// keeps using it as normal. Everyone else sees who is sending it and how far
// along they are, and cannot use it until it is finished (see isLockedByUpload).
const { uploadPercentFor, lastUploadUpdateFor } = useSlideUploadProgress()

const upload = computed(() => props.slide?.pendingUpload ?? null)
const isOwnUpload = computed(
  () => !!upload.value && upload.value.ownerId === authStore.user?._id
)
const isLocked = computed(() =>
  isLockedByUpload(props.slide, authStore.user?._id)
)

// Ticks only while a teammate's upload is on screen, to notice it going quiet.
const uploadClock = ref(Date.now())
const { pause: pauseUploadClock, resume: resumeUploadClock } = useIntervalFn(
  () => (uploadClock.value = Date.now()),
  5000,
  { immediate: false }
)
watch(
  isLocked,
  (locked) => {
    if (locked) {
      uploadClock.value = Date.now()
      resumeUploadClock()
    } else {
      pauseUploadClock()
    }
  },
  { immediate: true }
)

const isUploadQuiet = computed(() => {
  const last = lastUploadUpdateFor(props.slide?.id)
  return last !== null && uploadClock.value - last > UPLOAD_STALE_AFTER_MS
})

const isUploading = computed(() => upload.value?.state === "uploading")
const uploadPercent = computed(() => uploadPercentFor(props.slide?.id))
const ownerName = computed(() => upload.value?.ownerName || "a teammate")

// The sender is uploading; everyone else is syncing what the sender uploads.
const uploadLabel = computed(() => {
  if (!isUploading.value) return null
  if (!isOwnUpload.value && isUploadQuiet.value) {
    return `Waiting for ${ownerName.value}`
  }
  const verb = isOwnUpload.value ? "Uploading" : "Syncing"
  return uploadPercent.value ? `${verb} ${uploadPercent.value}%` : verb
})

// Only shown when nothing is moving: an upload in progress comes first. The
// media is only on its owner's device, but "Stayed behind" says it in two words
// from either side of the screen.
const deviceOnlyLabel = computed(() =>
  upload.value?.state === "device-only" ? "Stayed behind" : null
)

// Whether this device is the one holding the files. Being the same account is
// not enough: the same person's other computer, or a reload on a device that
// lost its local copy, has nothing to send. A file saved on this device with no
// cloud copy is the proof.
const canRetryHere = ref(false)
watch(
  () => [props.slide?.id, upload.value?.state] as const,
  async ([slideId, state]) => {
    if (!slideId || state !== "device-only") {
      canRetryHere.value = false
      return
    }
    const rows = await useIndexedDB().localMediaFiles.bulkGet(
      cloudKeysForSlide(props.slide)
    )
    // The slide may have changed while the read was running.
    if (props.slide?.id !== slideId) return
    canRetryHere.value = rows.some((row) => !!row && !row.remoteUrl)
  },
  { immediate: true }
)

// Sends a slide that stayed behind to the cloud again. Only the device that has
// the files can do it, which is why the button shows for the owner alone.
const toast = useToast()
const isRetrying = ref(false)
const retryUpload = async () => {
  if (isRetrying.value) return
  if (!navigator.onLine) {
    toast.add({ title: "You're offline", description: "Retry once you're back.", icon: "i-bx-wifi-off" })
    return
  }
  if (!props.slide._id) {
    toast.add({ title: "Saving this slide first", description: "Try again in a moment.", icon: "i-bx-cloud" })
    return
  }
  isRetrying.value = true
  try {
    const result = await useCloudUploadRetry().retrySlideUploads(props.slide.id, {
      manual: true,
    })
    const outcome = result.quotaExceeded
      ? "quota"
      : result.failed
      ? "failed"
      : result.uploaded
      ? "completed"
      : "no-files"
    usePosthogCapture("SLIDE_UPLOAD_RETRIED", {
      slideType: props.slide.type,
      outcome,
    })
    if (outcome === "quota") {
      toast.add({
        title: "Cloud storage is full",
        description: "Free some up, then retry.",
        icon: "i-bx-cloud",
        color: "amber",
      })
    } else if (outcome === "failed") {
      toast.add({
        title: "Still stuck",
        description: "It's safe on this device. Try again soon.",
        icon: "i-bx-cloud",
        color: "amber",
      })
    } else if (outcome === "no-files") {
      toast.add({
        title: "Can't find the files here",
        description: "Retry from the device that added them.",
        icon: "i-bx-cloud",
        color: "amber",
      })
    }
  } finally {
    isRetrying.value = false
  }
}

// Every cache key this card's preview depends on. A media slide's own file is
// stored under the slide id, a deck stores one key per page, and backgrounds
// store under their own key — which is usually the schedule-wide default, so a
// shared background pulls the whole list into the loading state together.
const { progressFor, transferFor } = useMediaDownloadProgress()

const mediaKeys = computed<string[]>(() => {
  const slide = props.slide
  if (!slide) return []
  const ownsFile =
    slide.type === slideTypes.media || slide.type === slideTypes.presentation
  return [
    ownsFile ? slide.id : null,
    ...(slide.presentationObjects || []).map(
      (page) => `${slide.id}-page-${page.page}`
    ),
    slide.backgroundImageKey,
    slide.backgroundVideoKey,
  ].filter((key): key is string => !!key)
})

// Percent for whichever key is busy, or null when none is. Covers both
// directions: a cloud download on this device, and a local save still writing
// on the device that added the file. A `failed` transfer is deliberately not
// loading — the editor owns that state, with its retry and remove actions.
const mediaProgress = computed<number | null>(() => {
  for (const key of mediaKeys.value) {
    const transfer = transferFor(key)
    if (transfer?.status === "pending") return transfer.progress * 100
    const download = progressFor(key)
    if (download !== null) return download
  }
  return null
})

// A slide whose files are still uploading has no finished media to draw yet,
// so it gets the same loading shimmer as one waiting on a download.
const isMediaLoading = computed(
  () => mediaProgress.value !== null || isUploading.value
)

// Matches CowSkeleton, so a card waiting on its media reads the same as the
// placeholder cards the grid shows while a schedule loads. Position is left to
// each call site: the grid card covers itself, the list row only its thumbnail.
const skeletonUi = {
  base: "absolute overflow-hidden animate-pulse pointer-events-none",
  background: "bg-gray-300 dark:bg-gray-600/80",
  rounded: "rounded-md",
}

const actionsMenuOpen = ref(false)
const moreActionsMenuRef = ref<{ open: () => void; close: () => void } | null>(
  null
)

const isActiveOverlay = computed(
  () => currentState.value.activeOverlaySlide?.id === props.slide.id
)
const handleOverlayAction = () => {
  if (!hasAccessToFeature(appWideActions.showSlideOverlay)) {
    useGlobalEmit(appWideActions.showUpgradeModal, {
      feature: appWideActions.showSlideOverlay,
    })
    return
  }

  emit(isActiveOverlay.value ? "clear-overlay" : "show-overlay", props.slide)
}

// Projects on this device, or asks the device this one is controlling to do it
// — the card does not need to know which. See useLiveOutputControl.
const { goLive } = useLiveOutputControl()

</script>

<style scoped>
/* Shimmer sweep, same as CowSkeleton's. */
.media-loading::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  animation: media-loading-shimmer 1.3s ease-in-out infinite;
}

html.dark .media-loading::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.22),
    transparent
  );
}

@keyframes media-loading-shimmer {
  100% {
    transform: translateX(100%);
  }
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

.slide-card.selectable .actions {
  display: none;
}

.slide-card.pair-drop-target {
  outline: 2px solid rgb(var(--color-primary-400));
  outline-offset: 2px;
}
/* A camera that would take the slide being dragged. */
.slide-card.pair-drop-candidate {
  outline: 2px dashed rgb(var(--color-primary-400) / 0.7);
  outline-offset: 2px;
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
