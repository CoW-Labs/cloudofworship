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
    <UTooltip
      text="Repeat media"
      :popper="{ placement: 'top' }"
      v-if="
        slide?.type === slideTypes.media && slide?.data?.type?.includes('video')
      "
    >
      <UButton
        @click="
          $emit('update-style', {
            ...slide.slideStyle,
            repeatVideo: !slide.slideStyle?.repeatVideo,
          })
        "
        class="dark:text-primary-500 dark:hover:text-primary-500 p-2 hover:bg-primary-300 hover:text-primary-500"
        :class="{
          'bg-primary text-white dark:text-primary-500':
            slide?.slideStyle?.repeatVideo,
        }"
        icon="i-tabler-repeat"
        variant="ghost"
      />
    </UTooltip>
    <div class="button-group rounded-md p-1 flex items-center gap-1">
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
        :disabled="slide?.type === slideTypes.media"
      />
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
        :disabled="slide?.type === slideTypes.media"
      />
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
        :disabled="slide?.type === slideTypes.media"
      />
    </div>
    <FontSelect
      v-if="slide?.type !== slideTypes?.text"
      size="lg"
      :selected-font="slide?.slideStyle?.font"
      :disabled="slide?.type === slideTypes.media"
      @change="$emit('update-font', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
const props = defineProps<{
  slide: Slide
}>()
const backgroundFillType = ref<string>(
  props.slide?.slideStyle?.backgroundFillType || "Fit"
)
</script>

<style scoped></style>
