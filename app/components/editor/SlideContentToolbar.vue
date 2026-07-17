<template>
  <div
    v-show="slide?.type !== slideTypes.presentation"
    class="absolute z-30 top-[46px] left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] flex justify-center"
    :class="containerOverflow"
  >
    <div
      class="content-toolbar-pill flex items-center gap-1 bg-white dark:bg-[#171d2b] rounded-full shadow-lg ring-1 ring-gray-200/70 dark:ring-white/5 px-2 py-1 text-gray-600 dark:text-[#a7afbd]"
    >
      <!-- UNDO / REDO -->
      <UTooltip text="Undo" :popper="{ placement: 'top' }">
        <UButton
          variant="ghost"
          color="gray"
          class="toolbar-icon-btn text-gray-500 dark:text-[#7d8695] hover:text-gray-900 dark:hover:text-white disabled:opacity-40"
          :disabled="!pastStates.length"
          @click="appStore.undo()"
        >
          <UndoIcon class="w-4 h-4" />
        </UButton>
      </UTooltip>
      <UTooltip text="Redo" :popper="{ placement: 'top' }">
        <UButton
          variant="ghost"
          color="gray"
          class="toolbar-icon-btn text-gray-500 dark:text-[#7d8695] hover:text-gray-900 dark:hover:text-white disabled:opacity-40"
          :disabled="!futureStates.length"
          @click="appStore.redo()"
        >
          <RedoIcon class="w-4 h-4" />
        </UButton>
      </UTooltip>
      <div class="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1"></div>

      <UTooltip
        v-if="isMediaFileButNotExternalMedia"
        text="Background fill type"
        :popper="{ placement: 'top' }"
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
      </UTooltip>

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
        <UTooltip text="Mute/Unmute media" :popper="{ placement: 'top' }">
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
        </UTooltip>
        <UTooltip text="Repeat media" :popper="{ placement: 'top' }">
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
        </UTooltip>
        <UTooltip text="Play/pause media" :popper="{ placement: 'top' }">
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
              <PauseIcon v-if="slide.slideStyle?.isMediaPlaying" class="w-4 h-4" />
              <PlayIcon v-else class="w-4 h-4" />
            </template>
            {{ slide.slideStyle?.isMediaPlaying ? "Pause" : "Play" }}</UButton
          >
        </UTooltip>
        <UTooltip text="Restart media" :popper="{ placement: 'top' }">
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
        </UTooltip>
        <div
          class="flex items-center gap-1 bg-gray-100 dark:bg-[#171d2b] rounded-md px-2"
        >
          <UTooltip text="Seek to specific time" :popper="{ placement: 'top' }">
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
          </UTooltip>
          <UTooltip text="Go to time" :popper="{ placement: 'top' }">
            <UButton
              @click="handleSeek"
              class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
              icon="i-tabler-player-skip-forward"
              variant="ghost"
              color="gray"
              size="xs"
            />
          </UTooltip>
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
        class="min-w-[170px] top-[-4px]"
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
      <UTooltip
        v-if="
          !(
            slide?.type === slideTypes.text ||
            slide?.type === slideTypes.media ||
            slide?.type === slideTypes.presentation
          )
        "
        text="Set line spacing"
        :popper="{ placement: 'top' }"
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
      </UTooltip>

      <!-- SLIDE CONTENT CASE CONTROLS -->
      <UTooltip
        text="Uppercase"
        :popper="{ placement: 'top' }"
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
      </UTooltip>

      <!-- SLIDE CONTENT BOLD CONTROLS -->
      <UTooltip
        text="Bold text"
        :popper="{ placement: 'top' }"
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
      </UTooltip>

      <!-- SLIDE CONTENT LINE BACKGROUND CONTROLS -->
      <UTooltip
        text="Line background"
        :popper="{ placement: 'top' }"
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
            'toolbar-toggle-active':
              slide?.slideStyle?.textLinesBackground,
          }"
          :aria-pressed="Boolean(slide?.slideStyle?.textLinesBackground)"
          variant="ghost"
          color="gray"
        >
          <HighlightIcon class="w-5 h-5" />
        </UButton>
      </UTooltip>

      <!-- COUNTDOWN SLIDE CONTROLS -->
      <div
        v-if="slide?.type === slideTypes.countdown"
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-md mx-1 p-1 h-[36px] mt-[2px] flex items-center gap-1"
      >
        <UTooltip
          :text="countdownIsPlaying ? 'Pause countdown' : 'Start countdown'"
          :popper="{ placement: 'top' }"
        >
          <UButton
            @click="useGlobalEmit(appWideActions.startCountdown, slide)"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
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
        </UTooltip>
        <UTooltip text="Restart countdown" :popper="{ placement: 'top' }">
          <UButton
            @click="useGlobalEmit(appWideActions.restartCountdown, slide)"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900"
            icon="i-tabler-refresh"
            variant="ghost"
            color="gray"
          />
        </UTooltip>
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
        <UTooltip text="Align left">
          <UButton
            @click="
              $emit('update-style', { ...slide.slideStyle, alignment: 'left' })
            "
            variant="ghost"
            color="gray"
            class="toolbar-icon-btn"
            :class="{
              'toolbar-toggle-active':
                slide?.slideStyle?.alignment === 'left',
            }"
            :aria-pressed="slide?.slideStyle?.alignment === 'left'"
          >
            <AlignLeftIcon class="w-5 h-5" />
          </UButton>
        </UTooltip>
        <UTooltip text="Align center">
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
        </UTooltip>
        <UTooltip text="Align right">
          <UButton
            @click="
              $emit('update-style', { ...slide.slideStyle, alignment: 'right' })
            "
            variant="ghost"
            color="gray"
            class="toolbar-icon-btn"
            :class="{
              'toolbar-toggle-active':
                slide?.slideStyle?.alignment === 'right',
            }"
            :aria-pressed="slide?.slideStyle?.alignment === 'right'"
          >
            <AlignRightIcon class="w-5 h-5" />
          </UButton>
        </UTooltip>
      </div>

      <!-- SONG CONTROLS -->
      <div
        v-if="slide?.type === slideTypes.song"
        class="button-group song-controls bg-gray-100 dark:bg-[#171d2b] rounded-md mx-1 p-1 px-0 h-[36px] mt-[2px] flex items-center gap-1"
      >
        <UTooltip text="Refresh song lyrics" :popper="{ placement: 'top' }">
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
        </UTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { ExtendedFileT, ExternalVideo, Slide } from "~/types"
import { appWideActions } from "~/utils/constants"

const props = defineProps<{
  slide: Slide
}>()

const appStore = useAppStore()
const { currentState, pastStates, futureStates } = storeToRefs(appStore)

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
  const song = await useSong(songId)
  emit("update-song-lyrics", song)
  isLoading.value = false
  // console.log(song)
}

const handleSeek = () => {
  if (seekTime.value >= 0) {
    useGlobalEmit(appWideActions.mediaSeek, seekTime.value.toString())
    emit("update-media-seek", seekTime.value)
  }
}
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
