<template>
  <div
    class="live-content tiptap border-none w-[100%] h-[100%] pointer-events-none text-left"
    :class="{
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
    }"
    :id="slide?.name"
  >
    <!-- <div
    class="live-content tiptap border-none w-[100%] h-[100%] pointer-events-none absolute inset-0 bg-no-repeat bg-cover"
    :id="slide?.name"
    :style="`padding: ${padding || 0}vw; ${useSlideBackground(slide)}`"
  > -->
    <SlideContentByLayout
      :content-visible="contentVisible"
      :slide="slide"
      :padding="padding"
    />
  </div>
</template>

<script setup lang="ts">
import type { Slide, SlideStyle } from "~/types"

const props = defineProps<{
  slide: Slide
  padding: { top: number; right: number; bottom: number; left: number }
  contentVisible: boolean
}>()

const emit = defineEmits(["slide-update", "update-live-output-slides"])

const layoutPopoverOpen = ref<boolean>(false)
const slideContents = ref<Array<string>>([])

const animatedSlides = computed(() => {
  return [props.slide]
})

const onSelectLayout = (data: string) => {
  layoutPopoverOpen.value = false
  const tempSlide: Slide = {
    ...props.slide,
    layout: data,
  }
  emit("slide-update", tempSlide)
}

const onUpdateSlideContent = (editorIndex: number, content: string) => {
  slideContents.value[editorIndex] = content
  const tempSlide: Slide = {
    ...props.slide,
    contents: [...slideContents.value],
  }
  emit("slide-update", tempSlide)
}
</script>

<style scoped></style>
