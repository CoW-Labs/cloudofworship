<template>
  <div
    v-show="slide?.type !== slideTypes.presentation"
    class="absolute z-30 top-[46px] left-2 right-2 flex"
    :class="containerOverflow"
  >
    <div
      class="content-toolbar-pill mx-auto shrink-0 flex items-center gap-1 bg-white dark:bg-[#171d2b] rounded-full shadow-lg ring-1 ring-gray-200/70 dark:ring-white/5 px-2 py-1 text-gray-600 dark:text-[#a7afbd]"
    >
      <CowTooltip
        v-if="isMediaFileButNotExternalMedia"
        text="Background fill type"
      >
        <CowSelectMenu
          v-model="backgroundFillType"
          size="lg"
          :select-class="`border-0 shadow-none outline-none text-center w-[140px] bg-gray-100 dark:bg-[#222938] dark:text-white rounded-full`"
          variant="none"
          color="gray"
          clear-search-on-close
          :ui-menu="{
            width: 'w-[140px]',
            input: 'text-xs',
            empty: 'text-xs',
            option: {
              size: 'text-xs',
            },
          }"
          :options="Object.values(backgroundFillTypes)"
          @change="$emit('update-bg-fill-type', $event)"
          @open="containerOverflow = ''"
          @close="containerOverflow = 'overflow-x-auto'"
        >
          <template #label>
            <IconWrapper name="i-mdi-arrow-expand-vertical" size="4">
            </IconWrapper>
            <span
              v-if="backgroundFillType?.length"
              class="truncate"
              :class="useURLFriendlyString(backgroundFillType)"
              >{{ backgroundFillType }}</span
            >
            <span v-else>Select fill type</span>
          </template>
        </CowSelectMenu>
      </CowTooltip>

      <!-- VIDEO MEDIA SLIDE OPTIONS -->
      <template
        v-if="
        slide?.type === slideTypes.media &&
        ((slide?.data as ExtendedFileT)?.type?.includes('video') ||
          (slide?.data as ExtendedFileT)?.type?.includes('audio') ||
          (slide?.data as any)?.type === 'youtube' ||
          (slide?.data as any)?.type === 'vimeo')
      "
      >
        <CowTooltip text="Mute / unmute media" :shortcut="shortcutIds.muteMedia">
          <UButton
            @click="
              $emit('update-style', {
                ...slide.slideStyle,
                isMediaMuted: !slide.slideStyle?.isMediaMuted,
              })
            "
            :class="[
              'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
            ]"
            :icon="
              slide.slideStyle?.isMediaMuted
                ? 'i-tabler-volume'
                : 'i-tabler-volume-off'
            "
            variant="ghost"
            color="gray"
            >{{ slide.slideStyle?.isMediaMuted ? "Unmute" : "Mute" }}</UButton
          >
        </CowTooltip>
        <CowTooltip text="Repeat media">
          <UButton
            @click="
              $emit('update-style', {
                ...slide.slideStyle,
                repeatMedia: !slide.slideStyle?.repeatMedia,
              })
            "
            :class="[
              'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
              {
                'toolbar-toggle-active': slide?.slideStyle?.repeatMedia,
              },
            ]"
            :aria-pressed="Boolean(slide?.slideStyle?.repeatMedia)"
            icon="i-tabler-repeat"
            variant="ghost"
            color="gray"
            >Loop</UButton
          >
        </CowTooltip>
        <CowTooltip
          text="Play / pause media"
          :shortcut="shortcutIds.playPauseMedia"
        >
          <UButton
            @click="
              $emit('update-style', {
                ...slide.slideStyle,
                isMediaPlaying: !slide.slideStyle?.isMediaPlaying,
              })
            "
            :class="[
              'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
            ]"
            variant="ghost"
            color="gray"
          >
            <template #leading>
              <PauseIcon
                v-if="slide.slideStyle?.isMediaPlaying"
                class="w-4 h-4"
              />
              <PlayIcon v-else class="w-4 h-4" />
            </template>
            {{ slide.slideStyle?.isMediaPlaying ? "Pause" : "Play" }}</UButton
          >
        </CowTooltip>
        <CowTooltip text="Restart media">
          <UButton
            @click="
              () => {
                seekTime = 0
                useGlobalEmit(appWideActions.mediaSeek, '0')
                $emit('update-media-seek-position')
              }
            "
            :class="[
              'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
            ]"
            icon="i-tabler-skip-back"
            variant="ghost"
            color="gray"
            >Restart</UButton
          >
        </CowTooltip>
        <div
          class="flex items-center gap-1 bg-gray-100 dark:bg-[#171d2b] rounded-md px-2"
        >
          <CowTooltip text="Seek to specific time">
            <UInput
              v-model="seekTime"
              type="number"
              placeholder="Seconds"
              class="w-[80px]"
              :ui="{
                base: 'bg-transparent',
                rounded: 'rounded-md',
                size: { sm: 'text-xs' },
              }"
              size="sm"
              min="0"
              @keyup.enter="handleSeek"
            />
          </CowTooltip>
          <CowTooltip text="Go to time">
            <UButton
              @click="handleSeek"
              class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
              icon="i-tabler-player-skip-forward"
              variant="ghost"
              color="gray"
              size="xs"
            />
          </CowTooltip>
        </div>
      </template>
      <FontSelect
        v-if="
          !(
            slide?.type === slideTypes?.media ||
            slide?.type === slideTypes?.presentation
          )
        "
        size="lg"
        :selected-font="slide?.slideStyle?.font"
        class="min-w-[150px] top-[-4px]"
        @open="containerOverflow = ''"
        @close="containerOverflow = 'overflow-x-auto'"
        @change="$emit('update-font', $event)"
      />
      <FontSizeSelect
        v-if="
          !(
            slide?.type === slideTypes?.media ||
            slide?.type === slideTypes?.presentation
          )
        "
        :slide="slide"
        data-tour="format-font-size"
        @update-style="$emit('update-style', $event)"
      />

      <!-- SLIDE CONTENT LINE CONTROLS -->
      <SlideMaxLinesSelect
        v-if="
          slide?.type === slideTypes?.song ||
          slide?.type === slideTypes?.songSetlist ||
          slide?.type === slideTypes?.hymn
        "
        :selected-line="slide?.slideStyle?.linesPerSlide"
        class="min-w-[120px] top-[-4px]"
        @open="containerOverflow = ''"
        @close="containerOverflow = 'overflow-x-auto'"
        @change="$emit('update-lines-per-slide', $event)"
      />

      <!-- SLIDE CONTENT LINE HEIGHT CONTROLS -->
      <CowTooltip
        v-if="
          !(
            slide?.type === slideTypes.text ||
            slide?.type === slideTypes.media ||
            slide?.type === slideTypes.presentation
          )
        "
        text="Set line spacing"
      >
        <CowSelectMenu
          v-model="lineSpacing"
          size="md"
          :select-class="`h-10 border-0 shadow-none outline-none text-center w-[120px] bg-gray-100 dark:bg-[#222938] dark:text-white rounded-full`"
          variant="none"
          color="gray"
          clear-search-on-close
          :ui-menu="{
            width: 'w-[140px]',
            input: 'text-xs',
            empty: 'text-xs',
            option: {
              size: 'text-xs',
            },
          }"
          :options="Object.values(lineSpacingTypes)"
          @change="
            $emit('update-style', {
              ...slide.slideStyle,
              lineSpacing: $event,
            })
          "
          @open="containerOverflow = ''"
          @close="containerOverflow = 'overflow-x-auto'"
        >
          <template #option="{ option: lineSpacing }">
            <span v-if="lineSpacing?.length" class="truncate capitalize">{{
              lineSpacing
            }}</span>
          </template>
          <template #label>
            <ParagraphSpacingIcon class="w-4 h-4" />
            <span v-if="lineSpacing?.length" class="truncate capitalize">{{
              lineSpacing
            }}</span>
          </template>
        </CowSelectMenu>
      </CowTooltip>

      <!-- SLIDE CONTENT CASE CONTROLS -->
      <CowTooltip
        text="Uppercase"
        :shortcut="shortcutIds.slideUppercase"
        v-if="
          !(
            slide?.type === slideTypes.text ||
            slide?.type === slideTypes.media ||
            slide?.type === slideTypes.presentation
          )
        "
      >
        <UButton
          @click="
            $emit('update-style', {
              ...slide.slideStyle,
              lettercase:
                slide?.slideStyle?.lettercase === 'uppercase'
                  ? ''
                  : 'uppercase',
            })
          "
          variant="ghost"
          color="gray"
          class="toolbar-icon-btn"
          :class="{
            'toolbar-toggle-active':
              slide?.slideStyle?.lettercase === 'uppercase',
          }"
          :aria-pressed="slide?.slideStyle?.lettercase === 'uppercase'"
        >
          <LetterCaseIcon class="w-[18px] h-[18px]" />
        </UButton>
      </CowTooltip>

      <!-- SLIDE CONTENT BOLD CONTROLS -->
      <CowTooltip
        text="Bold text"
        :shortcut="shortcutIds.slideBold"
        v-if="
          !(
            slide?.type === slideTypes.text ||
            slide?.type === slideTypes.media ||
            slide?.type === slideTypes.presentation
          )
        "
      >
        <UButton
          @click="
            $emit('update-style', {
              ...slide.slideStyle,
              textBold: !slide?.slideStyle?.textBold,
            })
          "
          variant="ghost"
          color="gray"
          class="toolbar-icon-btn"
          :class="{
            'toolbar-toggle-active': slide?.slideStyle?.textBold,
          }"
          :aria-pressed="Boolean(slide?.slideStyle?.textBold)"
        >
          <BoldIcon class="w-[18px] h-[18px]" />
        </UButton>
      </CowTooltip>

      <!-- SLIDE CONTENT LINE BACKGROUND CONTROLS -->
      <CowTooltip
        text="Line background"
        :shortcut="shortcutIds.slideLineBackground"
        v-if="
          !(
            slide?.type === slideTypes.media ||
            slide?.type === slideTypes.presentation
          )
        "
      >
        <UButton
          @click="
            $emit('update-style', {
              ...slide.slideStyle,
              textLinesBackground: !slide?.slideStyle?.textLinesBackground,
            })
          "
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'toolbar-toggle-active': slide?.slideStyle?.textLinesBackground,
          }"
          :aria-pressed="Boolean(slide?.slideStyle?.textLinesBackground)"
          variant="ghost"
          color="gray"
        >
          <HighlightIcon class="w-5 h-5" />
        </UButton>
      </CowTooltip>

      <!-- COUNTDOWN SLIDE CONTROLS -->
      <div
        v-if="slide?.type === slideTypes.countdown"
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-md mx-1 p-1 h-[36px] mt-[2px] flex items-center gap-1"
      >
        <CowTooltip
          :text="countdownIsPlaying ? 'Pause countdown' : 'Start countdown'"
        >
          <UButton
            @click="useGlobalEmit(appWideActions.startCountdown, slide)"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
            :class="{ 'toolbar-toggle-active': countdownIsPlaying }"
            :aria-label="
              countdownIsPlaying ? 'Pause countdown' : 'Start countdown'
            "
            :aria-pressed="countdownIsPlaying"
            variant="ghost"
            color="gray"
          >
            <PauseIcon v-if="countdownIsPlaying" class="w-5 h-5" />
            <PlayIcon v-else class="w-5 h-5" />
          </UButton>
        </CowTooltip>
        <CowTooltip text="Restart countdown">
          <UButton
            @click="useGlobalEmit(appWideActions.restartCountdown, slide)"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
            icon="i-tabler-refresh"
            variant="ghost"
            color="gray"
          />
        </CowTooltip>
      </div>

      <!-- SLIDE CONTENT ALIGNMENT -->
      <div
        v-if="
          !(
            slide?.type === slideTypes?.media ||
            slide?.type === slideTypes?.presentation
          )
        "
        class="button-group rounded-md p-1 flex items-center gap-1"
      >
        <CowTooltip text="Align left" :shortcut="shortcutIds.slideAlignLeft">
          <UButton
            @click="
              $emit('update-style', { ...slide.slideStyle, alignment: 'left' })
            "
            variant="ghost"
            color="gray"
            class="toolbar-icon-btn"
            :class="{
              'toolbar-toggle-active': slide?.slideStyle?.alignment === 'left',
            }"
            :aria-pressed="slide?.slideStyle?.alignment === 'left'"
          >
            <AlignLeftIcon class="w-5 h-5" />
          </UButton>
        </CowTooltip>
        <CowTooltip
          text="Align centre"
          :shortcut="shortcutIds.slideAlignCenter"
        >
          <UButton
            @click="
              $emit('update-style', {
                ...slide.slideStyle,
                alignment: 'center',
              })
            "
            variant="ghost"
            color="gray"
            class="toolbar-icon-btn"
            :class="{
              'toolbar-toggle-active':
                slide?.slideStyle?.alignment === 'center',
            }"
            :aria-pressed="slide?.slideStyle?.alignment === 'center'"
          >
            <AlignCenterIcon class="w-5 h-5" />
          </UButton>
        </CowTooltip>
        <CowTooltip
          text="Align right"
          :shortcut="shortcutIds.slideAlignRight"
        >
          <UButton
            @click="
              $emit('update-style', { ...slide.slideStyle, alignment: 'right' })
            "
            variant="ghost"
            color="gray"
            class="toolbar-icon-btn"
            :class="{
              'toolbar-toggle-active': slide?.slideStyle?.alignment === 'right',
            }"
            :aria-pressed="slide?.slideStyle?.alignment === 'right'"
          >
            <AlignRightIcon class="w-5 h-5" />
          </UButton>
        </CowTooltip>
      </div>

      <!-- SONG CONTROLS -->
      <div
        v-if="slide?.type === slideTypes.song"
        class="button-group song-controls bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 px-0 h-[36px] mt-[2px] flex items-center gap-1"
      >
        <CowTooltip text="Refresh song lyrics">
          <UButton
            @click="refreshSongLyrics(slide?.songId || '')"
            :class="[
              'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
            ]"
            variant="ghost"
            color="gray"
          >
            <IconWrapper
              size="5"
              name="i-tabler-refresh"
              :class="{ 'animate-spin': isLoading }"
            />
            Song</UButton
          >
        </CowTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExtendedFileT, ExternalVideo, Slide } from "~/types"
import { appWideActions } from "~/utils/constants"

const props = defineProps<{
  slide: Slide
}>()

const backgroundFillType = ref<string>(
  props.slide.slideStyle?.backgroundFillType || ""
)
const lineSpacing = ref<string>(props.slide.slideStyle?.lineSpacing || "")
const isLoading = ref<boolean>(false)
const containerOverflow = ref<string>("overflow-x-auto")
const seekTime = ref<number>(0)

const countdownIsPlaying = computed(
  () =>
    props.slide?.type === slideTypes.countdown &&
    Boolean(props.slide?.slideStyle?.isMediaPlaying)
)

const emit = defineEmits([
  "update-song-lyrics",
  "update-media-seek-position",
  "update-style",
  "update-media-playing",
  "update-line-spacing",
  "update-font",
  "update-lines-per-slide",
  "update-alignment",
  "update-lettercase",
  "update-bg-fill-type",
  "update-media-muted",
  "update-media-seek",
])

const isMediaFileButNotExternalMedia = computed(() => {
  const mediaType = (props.slide?.data as ExternalVideo)?.type
  return (
    props.slide?.type === "media" &&
    mediaType !== "youtube" &&
    mediaType !== "vimeo"
  )
})

watch(
  () => props.slide,
  () => {
    backgroundFillType.value =
      props.slide?.slideStyle?.backgroundFillType || "Fit"
  },
  { immediate: true }
)

const refreshSongLyrics = async (songId: string) => {
  isLoading.value = true
  // useSong resolves to null when the lookup fails (song deleted, or offline
  // with nothing cached). Emitting that null crashed the listener downstream.
  const song = await useSong(songId)
  isLoading.value = false

  if (!song) {
    useToast().add({
      icon: "i-bx-error",
      title: "Could not refresh lyrics",
      description: "This song could not be found. Check your connection.",
      color: "red",
    })
    return
  }

  emit("update-song-lyrics", song)
}

const handleSeek = () => {
  if (seekTime.value >= 0) {
    useGlobalEmit(appWideActions.mediaSeek, seekTime.value.toString())
    emit("update-media-seek", seekTime.value)
  }
}

// ─── SHORTCUTS ───────────────────────────────────────────────────────────────
// This toolbar is only ever mounted for the slide open in the preview pane
// (EditLiveContent renders it or TipTapToolbar, never both), so a shortcut
// registered here is already scoped to the right slide. Each handler still
// returns false when its control isn't on screen, which leaves the keypress
// untouched for the browser.

const hasPlayableMedia = computed(() => {
  const data = props.slide?.data as any
  return (
    props.slide?.type === slideTypes.media &&
    (data?.type?.includes("video") ||
      data?.type?.includes("audio") ||
      data?.type === "youtube" ||
      data?.type === "vimeo")
  )
})

const supportsTextStyling = computed(
  () =>
    !(
      props.slide?.type === slideTypes.text ||
      props.slide?.type === slideTypes.media ||
      props.slide?.type === slideTypes.presentation
    )
)

const supportsLineBackground = computed(
  () =>
    !(
      props.slide?.type === slideTypes.media ||
      props.slide?.type === slideTypes.presentation
    )
)

const supportsAlignment = computed(
  () =>
    !(
      props.slide?.type === slideTypes?.media ||
      props.slide?.type === slideTypes?.presentation
    )
)

// Space activates whatever button or link currently has focus. Yield to that
// rather than hijacking the key, or the toolbar's own buttons stop working.
const isFocusOnActivatableControl = () => {
  const active = document.activeElement
  if (!active) return false
  return Boolean(
    active.closest('button, a, [role="button"], [role="checkbox"], summary')
  )
}

const shortcutCleanups: Array<() => void> = []

onMounted(() => {
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.slideBold, () => {
      if (!supportsTextStyling.value) return false
      emit("update-style", {
        ...props.slide.slideStyle,
        textBold: !props.slide?.slideStyle?.textBold,
      })
      return true
    })
  )

  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.slideUppercase, () => {
      if (!supportsTextStyling.value) return false
      emit("update-style", {
        ...props.slide.slideStyle,
        lettercase:
          props.slide?.slideStyle?.lettercase === "uppercase" ? "" : "uppercase",
      })
      return true
    })
  )

  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.slideLineBackground, () => {
      if (!supportsLineBackground.value) return false
      emit("update-style", {
        ...props.slide.slideStyle,
        textLinesBackground: !props.slide?.slideStyle?.textLinesBackground,
      })
      return true
    })
  )

  const alignments = [
    [shortcutIds.slideAlignLeft, "left"],
    [shortcutIds.slideAlignCenter, "center"],
    [shortcutIds.slideAlignRight, "right"],
  ] as const
  alignments.forEach(([id, alignment]) => {
    shortcutCleanups.push(
      useRegisteredShortcut(id, () => {
        if (!supportsAlignment.value) return false
        emit("update-style", { ...props.slide.slideStyle, alignment })
        return true
      })
    )
  })

  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.muteMedia, () => {
      if (!hasPlayableMedia.value) return false
      emit("update-style", {
        ...props.slide.slideStyle,
        isMediaMuted: !props.slide.slideStyle?.isMediaMuted,
      })
      return true
    })
  )

  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.playPauseMedia, () => {
      if (!hasPlayableMedia.value) return false
      if (isFocusOnActivatableControl()) return false
      emit("update-style", {
        ...props.slide.slideStyle,
        isMediaPlaying: !props.slide.slideStyle?.isMediaPlaying,
      })
      return true
    })
  )
})

onBeforeUnmount(() => {
  shortcutCleanups.splice(0).forEach((cleanup) => cleanup())
})
</script>

<style scoped>
.toolbar-icon-btn {
  height: 34px;
  width: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9999px;
  color: rgb(75 85 99); /* gray-600 */
}
.toolbar-toggle-active {
  background-color: rgb(229 231 235) !important;
  color: rgb(17 24 39) !important;
}
:global(html.dark) .toolbar-icon-btn {
  color: rgb(203 202 212);
}
:global(html.dark) .toolbar-toggle-active {
  background-color: #2b3242 !important;
  color: white !important;
}
</style>
