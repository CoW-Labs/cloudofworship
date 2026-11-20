<template>
  <div
    v-show="slide?.type !== slideTypes.presentation"
    class="editor-floating-toolbar absolute z-30 top-[46px] left-2 right-2 flex"
  >
    <!-- The pill is the scroller, so a toolbar wider than the slide keeps its
         rounded ends and shadow and scrolls inside them. -->
    <div
      class="content-toolbar-pill relative mx-auto min-w-0 max-w-full bg-white dark:bg-[#171d2b] rounded-full shadow-lg ring-1 ring-gray-200/70 dark:ring-white/5"
    >
      <div
        ref="scrollStrip"
        class="cow-scroll-strip cow-scroll-strip--bare overflow-x-auto rounded-full"
      >
        <!-- `relative` so the font and lines selects, which place their trigger
           absolutely, scroll with the row instead of staying put. -->
        <div
          class="relative flex w-max items-center gap-1 px-2 py-1 text-gray-600 dark:text-[#a7afbd]"
        >
          <!-- CAMERA EFFECTS: a camera slide has no text, so these are all its
             toolbar shows. -->
          <template v-if="isCamera">
            <UPopover
              v-model:open="effectMenuOpen"
              mode="click"
              :popper="{ placement: 'bottom-start', strategy: 'fixed' }"
              :ui="{
                ring: 'ring-0',
                background: 'bg-transparent',
                shadow: 'shadow-xl',
                rounded: 'rounded-2xl',
              }"
            >
              <CowTooltip text="Camera effect" :prevent="effectMenuOpen">
                <UButton
                  class="h-10 w-[236px] justify-between rounded-full bg-gray-100 px-4 text-xs text-gray-800 hover:bg-gray-200 dark:bg-[#222938] dark:text-white dark:hover:bg-[#2b3242]"
                  variant="ghost"
                  color="gray"
                  :aria-expanded="effectMenuOpen"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <IconWrapper name="i-tabler-sparkles" size="4" />
                    <span class="truncate">{{
                      cameraEffectLabel(cameraEffect)
                    }}</span>
                  </span>
                  <IconWrapper name="i-tabler-chevron-down" size="4" />
                </UButton>
              </CowTooltip>
              <template #panel>
                <CameraEffectPicker
                  :model-value="cameraEffect"
                  @select="onSelectEffect"
                />
              </template>
            </UPopover>

            <UPopover
              v-if="effectPanel"
              v-model:open="effectPanelOpen"
              mode="click"
              :popper="{ placement: 'bottom', strategy: 'fixed' }"
              :ui="{
                ring: 'ring-0',
                background: 'bg-transparent',
                shadow: 'shadow-xl',
                rounded: 'rounded-2xl',
              }"
            >
              <CowTooltip
                :text="effectPanel.tooltip"
                :prevent="effectPanelOpen"
              >
                <UButton
                  :class="[
                    'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
                    { 'toolbar-toggle-active': effectPanelOpen },
                  ]"
                  icon="i-tabler-adjustments-horizontal"
                  variant="ghost"
                  color="gray"
                  >Adjust</UButton
                >
              </CowTooltip>
              <template #panel>
                <CameraEffectPanel
                  :title="effectPanel.title"
                  :note="effectPanel.note"
                  :choices="effectPanel.choices"
                  :settings="effectPanel.settings"
                  :sliders="effectPanel.sliders"
                  :ranges="effectPanel.ranges"
                  :defaults="effectPanel.defaults"
                  @update="effectPanel.update"
                />
              </template>
            </UPopover>
          </template>

          <template v-else>
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
                    textLinesBackground:
                      !slide?.slideStyle?.textLinesBackground,
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
            </CowTooltip>

            <!-- TEXT STYLE TOGGLES: kept together at the front of the strip -->
            <!-- SONG TRANSLATION: only when the song on screen has one -->
            <CowTooltip v-if="hasSongTranslation" text="Show translation">
              <UButton
                @click="
                  $emit('update-style', {
                    ...slide.slideStyle,
                    showTranslation: !isTranslationShown(slide),
                  })
                "
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
                :class="{
                  'toolbar-toggle-active': isTranslationShown(slide),
                }"
                :aria-pressed="isTranslationShown(slide)"
                aria-label="Show translation"
                icon="i-ph-translate"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>

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
                :popper="{ strategy: 'fixed' }"
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
              <UPopover
                v-model:open="volumeOpen"
                mode="click"
                :popper="{ placement: 'bottom', strategy: 'fixed' }"
                :ui="{
                  rounded: 'rounded-2xl',
                  shadow: 'shadow-xl',
                  container: 'z-50',
                }"
              >
                <CowTooltip
                  text="Volume"
                  :shortcut="shortcutIds.muteMedia"
                  :prevent="volumeOpen"
                >
                  <UButton
                    :class="[
                      'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
                    ]"
                    :icon="volumeIcon"
                    :aria-expanded="volumeOpen"
                    variant="ghost"
                    color="gray"
                    >Volume</UButton
                  >
                </CowTooltip>
                <template #panel>
                  <div class="flex w-52 items-center gap-3 overflow-hidden rounded-2xl p-3">
                    <UButton
                      :icon="mediaMuted ? 'i-tabler-volume-off' : 'i-tabler-volume'"
                      :aria-label="mediaMuted ? 'Unmute' : 'Mute'"
                      class="shrink-0 rounded-full"
                      variant="ghost"
                      color="gray"
                      @click="toggleMediaMute"
                    />
                    <CoWSlider
                      class="flex-1"
                      :model-value="mediaMuted ? 0 : mediaVolumePercent"
                      :min="0"
                      :max="100"
                      aria-label="Volume"
                      @update:model-value="onVolumeInput"
                    />
                  </div>
                </template>
              </UPopover>
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
                  @click="toggleMediaPlayback"
                  :class="[
                    'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
                  ]"
                  variant="ghost"
                  color="gray"
                >
                  <template #leading>
                    <PauseIcon v-if="mediaIsPlaying" class="w-4 h-4" />
                    <PlayIcon v-else class="w-4 h-4" />
                  </template>
                  {{ mediaIsPlaying ? "Pause" : "Play" }}</UButton
                >
              </CowTooltip>
              <CowTooltip text="Restart media">
                <UButton
                  @click="restartMedia"
                  :class="[
                    'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
                  ]"
                  icon="i-tabler-skip-back"
                  variant="ghost"
                  color="gray"
                  >Restart</UButton
                >
              </CowTooltip>
              <UPopover
                v-model:open="seekOpen"
                mode="click"
                :popper="{ placement: 'bottom', strategy: 'fixed' }"
                :ui="{
                  rounded: 'rounded-2xl',
                  shadow: 'shadow-xl',
                  container: 'z-50',
                }"
              >
                <CowTooltip text="Seek" :prevent="seekOpen">
                  <UButton
                    :class="[
                      'rounded-full text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] p-2 hover:bg-gray-100 dark:hover:bg-[#2b3242] hover:text-gray-900',
                      { 'toolbar-toggle-active': seekOpen },
                    ]"
                    icon="i-ph-fast-forward"
                    :aria-expanded="seekOpen"
                    variant="ghost"
                    color="gray"
                    >Seek</UButton
                  >
                </CowTooltip>
                <template #panel>
                  <div class="flex w-64 flex-col gap-2 overflow-hidden rounded-2xl p-3">
                    <!-- A file says how long it is, so it gets a track. A
                         YouTube or Vimeo video does not, so it keeps a field
                         for the second to jump to. -->
                    <template v-if="seekDuration">
                      <CoWSlider
                        :model-value="seekTime"
                        :min="0"
                        :max="seekDuration"
                        :step="0.1"
                        aria-label="Seek"
                        @update:model-value="onSeekInput"
                      />
                      <div
                        class="flex justify-between px-1 text-xs tabular-nums text-gray-500 dark:text-[#9BA3B2]"
                      >
                        <span>{{ formatClock(seekTime) }}</span>
                        <span>{{ formatClock(seekDuration) }}</span>
                      </div>
                    </template>
                    <div v-else class="flex items-center gap-2">
                      <UInput
                        v-model="seekTime"
                        type="number"
                        placeholder="Seconds"
                        class="flex-1"
                        size="sm"
                        min="0"
                        aria-label="Seconds to jump to"
                        @keyup.enter="handleSeek"
                      />
                      <UButton
                        variant="ghost"
                        color="gray"
                        class="shrink-0 rounded-full"
                        icon="i-tabler-player-skip-forward"
                        aria-label="Go to time"
                        @click="handleSeek"
                      />
                    </div>
                  </div>
                </template>
              </UPopover>
            </template>
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
              @change="$emit('update-lines-per-slide', $event)"
            />

            <!-- COUNTDOWN SLIDE CONTROLS -->
            <div
              v-if="slide?.type === slideTypes.countdown"
              class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-md mx-1 p-1 h-[36px] mt-[2px] flex items-center gap-1"
            >
              <CowTooltip
                :text="
                  countdownIsPlaying ? 'Pause countdown' : 'Start countdown'
                "
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

            <!-- TEXT COLOUR: the same swatches as the text slide toolbar -->
            <UPopover
              v-if="supportsTextStyling"
              v-model:open="colorPaletteOpen"
              mode="click"
              :popper="{ placement: 'bottom', strategy: 'fixed' }"
              :ui="{
                ring: 'ring-0',
                background: 'bg-transparent',
                shadow: 'shadow-xl',
              }"
            >
              <CowTooltip text="Text colour" :prevent="colorPaletteOpen">
                <button
                  type="button"
                  class="toolbar-color-btn"
                  :aria-label="`Change text color, current color ${currentTextColor}`"
                >
                  <span
                    class="h-[15px] w-[15px] rounded-full ring-1 ring-black/15 dark:ring-white/25"
                    :style="{ backgroundColor: currentTextColor }"
                  ></span>
                </button>
              </CowTooltip>
              <template #panel>
                <BgColorSelection
                  background-panel
                  color-purpose="text"
                  :colors="textColorPalette"
                  :value="currentTextColor"
                  @select="onTextColor($event.color)"
                />
              </template>
            </UPopover>

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
              <CowTooltip
                text="Align left"
                :shortcut="shortcutIds.slideAlignLeft"
              >
                <UButton
                  @click="
                    $emit('update-style', {
                      ...slide.slideStyle,
                      alignment: 'left',
                    })
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
                    $emit('update-style', {
                      ...slide.slideStyle,
                      alignment: 'right',
                    })
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
              </CowTooltip>
            </div>

            <!-- TEXT BOXES: boxes on these slides can be moved and resized; adding
                 new ones is only offered on text slides for now. -->
            <div
              v-if="canvasAvailable && canvasHasLayout"
              class="button-group rounded-md p-1 flex items-center gap-1"
            >
              <CowTooltip text="Reset text layout">
                <UButton
                  @click="resetTextLayout"
                  class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
                  icon="i-ph-arrow-counter-clockwise"
                  aria-label="Reset text layout"
                  variant="ghost"
                  color="gray"
                />
              </CowTooltip>
            </div>

            <!-- SONG CONTROLS -->
            <div
              v-if="
                slide?.type === slideTypes.song ||
                slide?.type === slideTypes.songSetlist
              "
              class="button-group song-controls bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 px-0 h-[36px] mt-[2px] flex items-center gap-1"
            >
              <CowTooltip
                :text="
                  slide?.type === slideTypes.songSetlist
                    ? 'Refresh lyrics of the active song'
                    : 'Refresh song lyrics'
                "
              >
                <UButton
                  :disabled="!refreshableSongId"
                  @click="refreshSongLyrics()"
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
            <!-- MORE: font, line spacing and auto-fit live behind one button -->
            <UPopover
              v-if="hasMoreItems"
              v-model:open="morePopoverOpen"
              mode="click"
              :popper="{ placement: 'bottom-end', strategy: 'fixed' }"
              :ui="{
                rounded: 'rounded-full',
                shadow: 'shadow-xl',
                container: 'z-50',
              }"
            >
              <CowTooltip text="More" :prevent="morePopoverOpen">
                <UButton
                  class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
                  :class="{ 'toolbar-toggle-active': morePopoverOpen }"
                  :aria-expanded="morePopoverOpen"
                  icon="i-ph-dots-three-bold"
                  aria-label="More formatting"
                  variant="ghost"
                  color="gray"
                />
              </CowTooltip>
              <template #panel>
                <div class="flex items-center gap-1 rounded-full px-3 py-2">
            <FontSelect
              v-if="
                !(
                  slide?.type === slideTypes?.media ||
                  slide?.type === slideTypes?.presentation
                )
              "
              size="lg"
              :selected-font="slide?.slideStyle?.font"
              class="min-w-[150px]"
              @change="$emit('update-font', $event)"
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
                :popper="{ strategy: 'fixed' }"
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
              >
                <template #option="{ option: lineSpacing }">
                  <span
                    v-if="lineSpacing?.length"
                    class="truncate capitalize"
                    >{{ lineSpacing }}</span
                  >
                </template>
                <template #label>
                  <ParagraphSpacingIcon class="w-4 h-4" />
                  <span
                    v-if="lineSpacing?.length"
                    class="truncate capitalize"
                    >{{ lineSpacing }}</span
                  >
                </template>
              </CowSelectMenu>
            </CowTooltip>

            <CowTooltip
              text="Fit each line on one row"
              v-if="
                slide?.type === slideTypes?.song ||
                slide?.type === slideTypes?.songSetlist ||
                slide?.type === slideTypes?.hymn
              "
            >
              <UButton
                @click="
                  $emit('update-style', {
                    ...slide.slideStyle,
                    autoFitLines: !slide?.slideStyle?.autoFitLines,
                  })
                "
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
                :class="{
                  'toolbar-toggle-active': slide?.slideStyle?.autoFitLines,
                }"
                :aria-pressed="Boolean(slide?.slideStyle?.autoFitLines)"
                aria-label="Fit each line on one row"
                icon="i-tabler-arrow-autofit-width"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>

                </div>
              </template>
            </UPopover>
          </template>
        </div>
      </div>
      <CowScrollFade
        :start="fadeStart"
        :end="fadeEnd"
        color="var(--cow-toolbar-pill-bg)"
        edge-class="rounded-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CameraEchoSettings,
  CameraEffect,
  CameraSlideData,
  ExtendedFileT,
  ExternalVideo,
  LightLeakSettings,
  Slide,
  SongSetlistData,
} from "~/types"
import {
  cameraEffectLabel,
  cameraEffectOf,
  defaultEchoSettings,
  defaultLightLeakSettings,
  echoRanges,
  echoSettingsOf,
  echoSliders,
  lightLeakRanges,
  lightLeakSettingsOf,
  lightLeakSliders,
  type CameraEffectChoice,
} from "~/utils/camera"
import { useDebounceFn, useIntervalFn } from "@vueuse/core"
import { useCanvasEditor } from "~/composables/useCanvasEditor"
import { textColorPalette } from "~/utils/textColors"
import { personSegmenterState } from "~/utils/personSegmenter"
import { appWideActions } from "~/utils/constants"
import useScrollEdgeFade from "~/composables/useScrollEdgeFade"
import { useAppStore } from "~/store/app"
import {
  listenToExternalPlayer,
  knownExternalDuration,
  rememberExternalDuration,
  type ExternalPlayerTime,
} from "~/utils/externalPlayerClock"
import {
  projectorPosition,
  requestProjectorPlayback,
  useLiveOutputPreviewPlaying,
  useProjectorPlayback,
} from "~/composables/useMediaPlaybackSync"
import {
  canPreviewMedia,
  useEditorMediaPreview,
} from "~/composables/useEditorMediaPreview"
import {
  getSongTranslation,
  isTranslationShown,
  songOnSlide,
} from "~/utils/songTranslation"

const props = defineProps<{
  slide: Slide
}>()

const backgroundFillType = ref<string>(
  props.slide.slideStyle?.backgroundFillType || ""
)
const lineSpacing = ref<string>(props.slide.slideStyle?.lineSpacing || "")
const isLoading = ref<boolean>(false)
const scrollStrip = ref<HTMLElement | null>(null)
const { start: fadeStart, end: fadeEnd } = useScrollEdgeFade(scrollStrip)
const seekTime = ref<number>(0)
const morePopoverOpen = ref(false)

// The colour of the slide's text, or of the selected text box (the editor
// shows a box's own values here while one is selected).
const colorPaletteOpen = ref(false)
const currentTextColor = computed(() => {
  const color = props.slide?.slideStyle?.textColor || "#FFFFFF"
  return color.toUpperCase()
})
const onTextColor = (color: string) => {
  colorPaletteOpen.value = false
  if (color.toUpperCase() === currentTextColor.value) return
  emit("update-style", { ...props.slide.slideStyle, textColor: color })
  usePosthogCapture("SLIDE_TEXT_COLOR_CHANGED", { slideType: props.slide?.type })
}

// The slide's text boxes. The canvas has no controls of its own; the reset
// button here and the add and reset buttons on the text slide toolbar are its
// only buttons.
const {
  available: canvasAvailable,
  hasLayout: canvasHasLayout,
  reset: resetTextLayout,
} = useCanvasEditor(() => props.slide?.id)

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
  "update-camera",
])

// ─── CAMERA EFFECTS ──────────────────────────────────────────────────────────
// Saved on the slide's camera data (see utils/camera), which the projector
// reads, so a change shows on screen as soon as it is saved.
const isCamera = computed(() => props.slide?.type === slideTypes.camera)
const cameraData = computed(() =>
  isCamera.value ? (props.slide?.data as CameraSlideData | undefined) : null
)
const cameraEffect = computed(() => cameraEffectOf(cameraData.value))
const echoSettings = computed(() => echoSettingsOf(cameraData.value))
const effectMenuOpen = ref(false)
const effectPanelOpen = ref(false)

// The echo's either/or settings, shown as dropdowns in its Adjust panel.
// "Main person" copies only the person nearest the camera (`focus` "main").
const echoChoices = computed((): CameraEffectChoice[] => {
  const { subject, direction } = echoSettings.value
  return [
    {
      label: "Who gets copied",
      options: [
        {
          label: "Main person",
          icon: "i-tabler-user",
          active: subject === "people",
          patch: { subject: "people", focus: "main" },
        },
        {
          label: "Whole picture",
          icon: "i-tabler-photo",
          active: subject === "whole",
          patch: { subject: "whole" },
        },
      ],
    },
    {
      label: "Which side the copies go",
      options: [
        { label: "Left", icon: "i-tabler-arrow-narrow-left", value: "left" },
        { label: "Right", icon: "i-tabler-arrow-narrow-right", value: "right" },
        { label: "Both", icon: "i-tabler-arrows-horizontal", value: "both" },
      ].map(({ value, ...option }) => ({
        ...option,
        active: direction === value,
        patch: { direction: value },
      })),
    },
  ]
})

const onSelectEffect = (effect: CameraEffect) => {
  effectMenuOpen.value = false
  if (effect === cameraEffect.value) return
  emit("update-camera", { effect })
  usePosthogCapture("CAMERA_EFFECT_CHANGED", { effect })
}

const lightLeakSettings = computed(() => lightLeakSettingsOf(cameraData.value))
const patchLightLeak = (patch: Partial<LightLeakSettings>) =>
  emit("update-camera", {
    lightLeak: { ...lightLeakSettings.value, ...patch },
  })

const echoNote = computed(() => {
  if (echoSettings.value.subject === "whole") {
    return "Works best with a well-lit person on a dark stage."
  }
  if (personSegmenterState.value === "failed") {
    return "This computer can't pick out people, so the whole picture is copied."
  }
  if (personSegmenterState.value === "loading") {
    return "Getting ready to find people…"
  }
  return "Looks cleanest with a plain wall or screen behind the person."
})

// The Adjust panel's contents for the chosen effect, or null for none.
const effectPanel = computed(() => {
  if (cameraEffect.value === "main-character-echo") {
    return {
      title: "Main character echo",
      tooltip: "Who gets copied, which side, how many and how far",
      note: echoNote.value,
      choices: echoChoices.value,
      settings: echoSettings.value as unknown as Record<string, unknown>,
      sliders: echoSliders,
      ranges: echoRanges,
      defaults: defaultEchoSettings() as unknown as Record<string, unknown>,
      update: (patch: Record<string, unknown>) =>
        patchEcho(patch as Partial<CameraEchoSettings>),
    }
  }
  if (cameraEffect.value === "light-leak") {
    return {
      title: "Light leak",
      tooltip: "Strength, speed and rest between bursts",
      note: "",
      choices: [],
      settings: lightLeakSettings.value as unknown as Record<string, unknown>,
      sliders: lightLeakSliders,
      ranges: lightLeakRanges,
      defaults: defaultLightLeakSettings() as unknown as Record<
        string,
        unknown
      >,
      update: (patch: Record<string, unknown>) =>
        patchLightLeak(patch as Partial<LightLeakSettings>),
    }
  }
  return null
})

const patchEcho = (patch: Partial<CameraEchoSettings>) =>
  emit("update-camera", { echo: { ...echoSettings.value, ...patch } })

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

// Lines translated for the song on screen (see utils/songTranslation).
const hasSongTranslation = computed(() =>
  Boolean(getSongTranslation(songOnSlide(props.slide)))
)

// A setlist slide holds several songs — refreshing acts on the one currently
// showing, which is also the song the rest of this toolbar is editing.
const refreshableSongId = computed(() => {
  if (props.slide?.type === slideTypes.songSetlist) {
    const data = props.slide?.data as SongSetlistData | undefined
    const activeItem = data?.songs?.[data?.activeSongIndex || 0]
    return (
      activeItem?.songId || activeItem?.song?._id || activeItem?.song?.id || ""
    )
  }
  return props.slide?.songId || ""
})

const refreshSongLyrics = async () => {
  const songId = refreshableSongId.value
  if (!songId) return

  isLoading.value = true
  // useSong resolves to null when the lookup fails (song deleted, or offline
  // with nothing cached). Emitting that null crashed the listener downstream.
  // The id (not the slide's own copy) is the source of truth here — passing the
  // cached object would just re-chunk the stale lyrics.
  const song = await useSong(songId, props.slide?.slideStyle?.linesPerSlide)
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

// Jumps the video: the editor's own copy when the slide is not live, the
// projector when it is.
const seekTo = (seconds: number) => {
  const target = Math.max(0, seconds)
  if (previewsHere.value) {
    mediaPreview.seekTo(target)
    return
  }
  useGlobalEmit(appWideActions.mediaSeek, target.toString())
  emit("update-media-seek", target)
}

const handleSeek = () => {
  if (seekTime.value >= 0) seekTo(Number(seekTime.value))
}

// ─── SEEK TRACK ──────────────────────────────────────────────────────────────
// Nothing here runs until the popover opens. While it is open the track reads
// the video this window already has (the editor's copy, or the Live Output's
// once the slide is live) four times a second. Audio has no copy here, so it
// follows the projector's last report. A file's length comes from the video,
// or from a metadata-only probe of the file. YouTube and Vimeo are read from
// their players over postMessage (see below); before either has played once
// their length is unknown, so they show a field for the second instead.
const seekOpen = ref(false)
const seekDuration = ref(0)
let seekElement: HTMLMediaElement | null = null
let probedDuration = 0
let probe: HTMLMediaElement | null = null
// The track holds still while it is being dragged, and for a moment after.
let seekHeldUntil = 0

const findSeekElement = () => {
  const id = props.slide?.id
  if (!id) return null
  const attribute = appStore.isSlideLive(id) ? "data-media-live" : "data-media-editor"
  return document.querySelector<HTMLMediaElement>(`[${attribute}="${CSS.escape(id)}"]`)
}

const dropProbe = () => {
  if (!probe) return
  probe.onloadedmetadata = null
  probe.removeAttribute("src")
  probe.load()
  probe = null
}

const probeDuration = () => {
  probedDuration = 0
  const data = props.slide?.data as { url?: string; type?: string } | undefined
  const url = data?.url || props.slide?.background
  if (!url || data?.type === "youtube" || data?.type === "vimeo") return
  dropProbe()
  const el = document.createElement(data?.type?.includes("audio") ? "audio" : "video")
  el.preload = "metadata"
  el.muted = true
  el.onloadedmetadata = () => {
    probedDuration = Number.isFinite(el.duration) ? el.duration : 0
    tickSeek()
    dropProbe()
  }
  el.src = url
  probe = el
}

// ─── YouTube and Vimeo ───
// No <video> to read, so the editor's preview player is asked over postMessage
// while the popover is open, and a live one is read from the projector's
// reports, which carry the length. A length heard once is remembered, so the
// bar shows the next time even before a player has loaded.
const externalType = computed(() => {
  const type = (props.slide?.data as { type?: string } | undefined)?.type
  return type === "youtube" || type === "vimeo" ? type : null
})
let previewPlayer: ReturnType<typeof listenToExternalPlayer> | null = null
let previewFrame: HTMLIFrameElement | null = null
let previewClock: ExternalPlayerTime | null = null

const dropPreviewPlayer = () => {
  previewPlayer?.stop()
  previewPlayer = previewFrame = previewClock = null
}

// The preview player appears only once it is played, which may be after the
// popover opened, so this is looked for again on each tick until found.
const followPreviewPlayer = () => {
  const type = externalType.value
  const id = props.slide?.id
  if (!type || !id || appStore.isSlideLive(id)) return dropPreviewPlayer()
  const frame = document.querySelector<HTMLIFrameElement>(
    `iframe[data-media-editor="${CSS.escape(id)}"]`
  )
  if (frame === previewFrame) return
  dropPreviewPlayer()
  if (!frame) return
  previewFrame = frame
  previewPlayer = listenToExternalPlayer(frame, type, (state) => {
    previewClock = state
    if (state.duration) rememberExternalDuration(id, state.duration)
  })
}

const externalPosition = () => {
  const clock = previewClock
  if (clock && clock.time !== null) {
    return clock.time + (clock.playing ? (Date.now() - clock.at) / 1000 : 0)
  }
  return projectorPosition(props.slide?.id)
}

const tickSeek = () => {
  if (Date.now() < seekHeldUntil) return
  if (externalType.value) {
    followPreviewPlayer()
    const duration =
      previewClock?.duration || knownExternalDuration(props.slide?.id)
    if (!duration) return
    seekDuration.value = duration
    const time = externalPosition()
    if (time !== null) seekTime.value = Math.min(time, duration)
    return
  }
  const el = seekElement
  const duration =
    el && Number.isFinite(el.duration) && el.duration > 0
      ? el.duration
      : probedDuration
  if (!duration) return
  seekDuration.value = duration
  const time =
    el && Number.isFinite(el.currentTime)
      ? el.currentTime
      : projectorPosition(props.slide?.id)
  if (time !== null) seekTime.value = Math.min(time, duration)
}

const { pause: stopSeekTicker, resume: startSeekTicker } = useIntervalFn(
  tickSeek,
  250,
  { immediate: false }
)

watch(seekOpen, (open) => {
  if (!open) {
    stopSeekTicker()
    dropProbe()
    dropPreviewPlayer()
    return
  }
  seekHeldUntil = 0
  seekDuration.value = 0
  const id = props.slide?.id
  if (externalType.value) {
    seekElement = null
    // Until a player reports, start the handle at the beginning rather than
    // where it was left last time.
    seekTime.value = 0
    // A live player reports on its heartbeat; ask now so the bar is current.
    if (id && appStore.isSlideLive(id)) requestProjectorPlayback(id)
  } else {
    seekElement = findSeekElement()
    if (!(seekElement && seekElement.duration > 0)) probeDuration()
  }
  tickSeek()
  startSeekTicker()
})
watch(
  () => props.slide?.id,
  () => (seekOpen.value = false)
)
onBeforeUnmount(() => {
  dropProbe()
  dropPreviewPlayer()
})

// A preview seeks as the handle moves, which is cheap. A live seek reaches the
// projector, the store and teammates, so it waits for the handle to settle.
const seekLive = useDebounceFn((seconds: number) => seekTo(seconds), 150)
const reportSeek = useDebounceFn(
  () =>
    usePosthogCapture("MEDIA_SEEKED", {
      method: "track",
      live: appStore.isSlideLive(props.slide?.id),
    }),
  800
)
// A drag reports far more often than a video can seek, and each seek asks the
// decoder to find a frame. The preview takes the newest position once a frame.
let previewSeekFrame = 0
let previewSeekTarget = 0
const seekPreviewSoon = (seconds: number) => {
  previewSeekTarget = seconds
  if (previewSeekFrame) return
  previewSeekFrame = requestAnimationFrame(() => {
    previewSeekFrame = 0
    seekTo(previewSeekTarget)
  })
}
onBeforeUnmount(() => cancelAnimationFrame(previewSeekFrame))

const onSeekInput = (seconds: number) => {
  seekTime.value = seconds
  seekHeldUntil = Date.now() + 700
  if (previewsHere.value) seekPreviewSoon(seconds)
  else seekLive(seconds)
  reportSeek()
}

const formatClock = (value: number) => {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, "0")
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`
}

const restartMedia = () => {
  seekTime.value = 0
  if (previewsHere.value) {
    mediaPreview.seekTo(0)
    return
  }
  useGlobalEmit(appWideActions.mediaSeek, "0")
  emit("update-media-seek-position")
}

// ─── SHORTCUTS ───────────────────────────────────────────────────────────────
// This toolbar is only ever mounted for the slide open in the preview pane
// (EditLiveContent renders it or TipTapToolbar, never both), so a shortcut
// registered here is already scoped to the right slide. Each handler still
// returns false when its control isn't on screen, which leaves the keypress
// untouched for the browser.

// What the projector is doing, once it has said: a video starts playing on its
// own when it goes live, while the stored `isMediaPlaying` is still the last
// press (false on a new slide). Before any report, the stored value is all
// there is (no output window, or a YouTube/Vimeo player, which does not report).
const appStore = useAppStore()
// Only a media slide has play controls, so only it asks the projector where it
// is; a song or text slide would otherwise post a cross-window message every
// time it is opened.
const projectorPlaying = useProjectorPlayback(() =>
  props.slide?.type === slideTypes.media ? props.slide.id : undefined
)
// A video that is not live plays in the editor's own preview instead, silently
// and without touching the slide, so nothing reaches the projector or a
// teammate. Once it is live the same buttons drive the projector, and the
// preview is stopped (see useEditorMediaPreviewGuard).
const mediaPreview = useEditorMediaPreview(() => props.slide?.id)
const previewsHere = computed(
  () => !appStore.isSlideLive(props.slide?.id) && canPreviewMedia(props.slide)
)
// With no projector reporting, the Live Output panel's own video is what is
// moving, and it starts by itself when the slide goes live.
const livePreviewPlaying = useLiveOutputPreviewPlaying(() => props.slide?.id)
const mediaIsPlaying = computed(() => {
  if (previewsHere.value) return mediaPreview.playing.value
  const live = appStore.isSlideLive(props.slide?.id)
  const reported = projectorPlaying.value
  if (reported !== null && live) return reported
  if (live && livePreviewPlaying.value !== null) return livePreviewPlaying.value
  return Boolean(props.slide?.slideStyle?.isMediaPlaying)
})

// Toggles from what is on screen, and stamps the press so the projector acts
// on it even when the stored value already matches.
const toggleMediaPlayback = () => {
  const play = !mediaIsPlaying.value
  if (previewsHere.value) {
    mediaPreview.toggle()
  } else {
    emit("update-style", {
      ...props.slide.slideStyle,
      isMediaPlaying: play,
      mediaCommandAt: Date.now(),
    })
  }
  usePosthogCapture("MEDIA_PLAYBACK_TOGGLED", {
    play,
    slideType: props.slide?.type,
    live: appStore.isSlideLive(props.slide?.id),
  })
}

// The mute setting belongs to the live output. The editor's preview is always
// silent, so unmuting while it plays says where the sound will be heard.
const volumeOpen = ref(false)
const mediaMuted = computed(() => Boolean(props.slide?.slideStyle?.isMediaMuted))
const mediaVolumePercent = computed(() =>
  Math.round((props.slide?.slideStyle?.mediaVolume ?? 1) * 100)
)
const volumeIcon = computed(() =>
  mediaMuted.value || mediaVolumePercent.value === 0
    ? "i-tabler-volume-off"
    : mediaVolumePercent.value < 50
      ? "i-tabler-volume-2"
      : "i-tabler-volume"
)
// Dragging sets the level; dragging off zero unmutes, dragging to zero mutes.
let volumeCaptureTimer: ReturnType<typeof setTimeout> | undefined
const onVolumeInput = (percent: number) => {
  const volume = Math.round(percent) / 100
  const muted = volume === 0
  if (volume === (props.slide?.slideStyle?.mediaVolume ?? 1) && muted === mediaMuted.value) return
  if (volumeCaptureTimer) clearTimeout(volumeCaptureTimer)
  volumeCaptureTimer = setTimeout(() => {
    usePosthogCapture("MEDIA_VOLUME_CHANGED", {
      volume,
      muted,
      slideType: props.slide?.type,
    })
  }, 800)
  emit("update-style", {
    ...props.slide.slideStyle,
    mediaVolume: muted ? props.slide?.slideStyle?.mediaVolume ?? 1 : volume,
    isMediaMuted: muted,
  })
}
const toggleMediaMute = () => {
  usePosthogCapture("MEDIA_MUTE_TOGGLED", {
    muted: !props.slide?.slideStyle?.isMediaMuted,
    slideType: props.slide?.type,
  })
  const unmuting = Boolean(props.slide?.slideStyle?.isMediaMuted)
  emit("update-style", {
    ...props.slide.slideStyle,
    isMediaMuted: !unmuting,
  })
  if (unmuting && previewsHere.value && mediaPreview.playing.value) {
    useToast().add({
      title: "Oops! Audio only plays on the LIVE view",
      icon: "i-tabler-volume-off",
      timeout: 4000,
    })
  }
}

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
    !isCamera.value &&
    !(
      props.slide?.type === slideTypes.text ||
      props.slide?.type === slideTypes.media ||
      props.slide?.type === slideTypes.presentation
    )
)

const supportsLineBackground = computed(
  () =>
    !isCamera.value &&
    !(
      props.slide?.type === slideTypes.media ||
      props.slide?.type === slideTypes.presentation
    )
)

// The More button only shows when at least one of its controls applies.
const hasMoreItems = computed(() => {
  const type = props.slide?.type
  const hasFit =
    type === slideTypes.song ||
    type === slideTypes.songSetlist ||
    type === slideTypes.hymn
  const hasFont = !(type === slideTypes.media || type === slideTypes.presentation)
  const hasSpacing = !(
    type === slideTypes.text ||
    type === slideTypes.media ||
    type === slideTypes.presentation
  )
  return !isCamera.value && (hasFit || hasFont || hasSpacing)
})

const supportsAlignment = computed(
  () =>
    !isCamera.value &&
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
          props.slide?.slideStyle?.lettercase === "uppercase"
            ? ""
            : "uppercase",
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
      toggleMediaMute()
      return true
    })
  )

  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.playPauseMedia, () => {
      if (!hasPlayableMedia.value) return false
      if (isFocusOnActivatableControl()) return false
      toggleMediaPlayback()
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
.toolbar-color-btn {
  height: 26px;
  width: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9999px;
  background: rgb(243 244 246);
  transition: background-color 150ms ease;
}
.toolbar-color-btn:hover {
  background: rgb(229 231 235);
}
:global(html.dark) .toolbar-color-btn {
  background: #171d2b;
}
:global(html.dark) .toolbar-color-btn:hover {
  background: #2b3242;
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
