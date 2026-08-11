<template>
  <div
    class="button-group flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-[#222938]"
  >
    <UTooltip text="Decrease font size">
      <UButton
        :disabled="fontSize <= MIN_FONT_SIZE"
        @click="decrease"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full p-0 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-[#a7afbd] dark:hover:bg-[#2b3242] dark:hover:text-[#d5dae3]"
        variant="ghost"
        color="gray"
      >
        <MinusIcon class="h-4 w-4" />
      </UButton>
    </UTooltip>
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <UInput
      v-model="fontSize"
      disabled
      size="xs"
      variant="none"
      class="w-[5ch]"
      inputClass="bg-transparent border-0 shadow-none outline-none px-0 text-center text-gray-800 dark:text-white font-medium tabular-nums"
    />
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <UTooltip text="Increase font size">
      <UButton
        :disabled="fontSize >= MAX_FONT_SIZE"
        @click="increase"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full p-0 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-[#a7afbd] dark:hover:bg-[#2b3242] dark:hover:text-[#d5dae3]"
        variant="ghost"
        color="gray"
      >
        <PlusIcon class="h-4 w-4" />
      </UButton>
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"

const MIN_FONT_SIZE = 50
const MAX_FONT_SIZE = 150

const props = defineProps<{
  slide: Slide
}>()

const emit = defineEmits<{
  (e: "update-style", value: Slide["slideStyle"]): void
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const fontSize = ref<number>(
  props.slide.slideStyle?.fontSizePercent ||
    currentState.value.settings.slideStyles.fontSizePercent ||
    100
)

watch(
  () => props.slide,
  () => {
    fontSize.value = props.slide?.slideStyle?.fontSizePercent || 100
  },
  { immediate: true }
)

const decrease = () => {
  fontSize.value =
    fontSize.value - 5 > MIN_FONT_SIZE ? fontSize.value - 5 : MIN_FONT_SIZE
  emit("update-style", {
    ...props.slide.slideStyle,
    fontSizePercent: fontSize.value,
  })
}

const increase = () => {
  fontSize.value =
    fontSize.value + 5 < MAX_FONT_SIZE ? fontSize.value + 5 : MAX_FONT_SIZE
  emit("update-style", {
    ...props.slide.slideStyle,
    fontSizePercent: fontSize.value,
  })
}
</script>
