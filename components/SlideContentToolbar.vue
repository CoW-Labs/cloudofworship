<template>
  <div
    class="my-2 flex gap-1 w-[100%] absolute z-10 bg-white dark:bg-[#121212] py-1 right-0 left-0 top-[45px]"
  >
    <UTooltip
      v-if="slide?.type === slideTypes.media"
      text="Background fill type"
      :popper="{ placement: 'top' }"
    >
      <USelectMenu
        v-model="backgroundFillType"
        size="lg"
        :select-class="`border-3 shadow-none outline-none text-center w-[140px] bg-primary-100 dark:bg-primary-900 dark:text-white`"
        variant="none"
        color="primary"
        clear-search-on-close
        :ui="{
          base: 'bg-primary-500',
          input: 'bg-primary-500',
          color: {
            primary: {
              outline: 'shadow-sm bg-primary-500 ',
            },
          },
        }"
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
      </USelectMenu>
    </UTooltip>
    <!-- VIDEO MEDIA SLIDE OPTIONS -->
    <template
      v-if="
        slide?.type === slideTypes.media &&
        (slide?.data?.type?.includes('video') ||
          slide?.data?.type?.includes('audio'))
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
            'dark:text-primary-500 dark:hover:text-primary-500 p-2 hover:bg-primary-300 hover:text-primary-500',
          ]"
          :icon="
            slide.slideStyle?.isMediaMuted
              ? 'i-tabler-volume'
              : 'i-tabler-volume-off'
          "
          variant="ghost"
        />
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
            'dark:text-primary-500 dark:hover:text-primary-500 p-2 hover:bg-primary-300 hover:text-primary-500',
            {
              'bg-primary text-white dark:text-primary-500':
                slide?.slideStyle?.repeatMedia,
            },
          ]"
          icon="i-tabler-repeat"
          variant="ghost"
        />
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
            'dark:text-primary-500 dark:hover:text-primary-500 p-2 hover:bg-primary-300 hover:text-primary-500',
          ]"
          :icon="
            slide.slideStyle?.isMediaPlaying
              ? 'i-tabler-pause'
              : 'i-tabler-play'
          "
          variant="ghost"
        />
      </UTooltip>
      <UTooltip text="Restart media" :popper="{ placement: 'top' }">
        <UButton
          @click="
            () => {
              useGlobalEmit('media-seek', '0')
              $emit('update-media-seek-position')
            }
          "
          :class="[
            'dark:text-primary-500 dark:hover:text-primary-500 p-2 hover:bg-primary-300 hover:text-primary-500',
          ]"
          icon="i-tabler-skip-back"
          variant="ghost"
        />
      </UTooltip>
    </template>
    <FontSelect
      v-if="slide?.type !== slideTypes?.media"
      size="lg"
      :selected-font="slide?.slideStyle?.font"
      @change="$emit('update-font', $event)"
    />
    <div
      v-if="slide?.type !== slideTypes?.media"
      class="button-group rounded-md p-1 flex items-center gap-1"
    >
      <UTooltip text="Decrease font size">
        <UButton
          :disabled="slideFontSize <= MIN_FONT_SIZE"
          @click="
            $emit('update-style', {
              ...slide.slideStyle,
              fontSizePercent: (slideFontSize =
                slideFontSize - 5 > MIN_FONT_SIZE
                  ? slideFontSize - 5
                  : MIN_FONT_SIZE),
            })
          "
          class="dark:text-primary-400 dark:hover:text-primary-500 disabled:text-primary-300"
          icon="i-mdi-format-annotation-minus"
          variant="ghost"
        />
      </UTooltip>
      <UInput
        v-model="slideFontSize"
        disabled
        class="w-[45px] font-medium text-sm pr-0"
      ></UInput>
      <UTooltip text="Increase font size">
        <UButton
          :disabled="slideFontSize >= MAX_FONT_SIZE"
          @click="
            $emit('update-style', {
              ...slide.slideStyle,
              fontSizePercent: (slideFontSize =
                slideFontSize + 5 < MAX_FONT_SIZE
                  ? slideFontSize + 5
                  : MAX_FONT_SIZE),
            })
          "
          class="dark:text-primary-400 dark:hover:text-primary-500 disabled:text-primary-300"
          icon="i-mdi-format-annotation-plus"
          variant="ghost"
        />
      </UTooltip>
    </div>
    <div
      v-if="slide?.type !== slideTypes?.media"
      class="button-group rounded-md p-1 flex items-center gap-1"
    >
      <UTooltip text="Align left">
        <UButton
          @click="
            $emit('update-style', { ...slide.slideStyle, alignment: 'left' })
          "
          class="dark:text-primary-400 dark:hover:text-primary-500 disabled:text-primary-300"
          :class="{
            'bg-primary text-white dark:text-primary-500':
              slide?.slideStyle?.alignment === 'left',
          }"
          icon="i-bi-text-left"
          variant="ghost"
        />
      </UTooltip>
      <UTooltip text="Align center">
        <UButton
          @click="
            $emit('update-style', { ...slide.slideStyle, alignment: 'center' })
          "
          class="dark:text-primary-400 dark:hover:text-primary-500 disabled:text-primary-300"
          :class="{
            'bg-primary text-white dark:text-primary-900':
              slide?.slideStyle?.alignment === 'center',
          }"
          icon="i-bi-text-center"
          variant="ghost"
        />
      </UTooltip>
      <UTooltip text="Align right">
        <UButton
          @click="
            $emit('update-style', { ...slide.slideStyle, alignment: 'right' })
          "
          class="dark:text-primary-400 dark:hover:text-primary-500 disabled:text-primary-300"
          :class="{
            'bg-primary text-white dark:text-primary-900':
              slide?.slideStyle?.alignment === 'right',
          }"
          icon="i-bi-text-right"
          variant="ghost"
        />
      </UTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

const MAX_FONT_SIZE = 125
const MIN_FONT_SIZE = 80
const props = defineProps<{
  slide: Slide
}>()
const backgroundFillType = ref<string>("")
const slideFontSize = ref<number>(0)

watch(
  () => props.slide,
  () => {
    backgroundFillType.value =
      props.slide?.slideStyle?.backgroundFillType || "Fit"
    slideFontSize.value = props.slide?.slideStyle?.fontSizePercent || 100
  },
  { immediate: true }
)
</script>

<style scoped></style>
