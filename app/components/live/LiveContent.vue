<template>
  <div
    :class="{
      'outlined-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.textOutlined,
      'bold-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.textBold,
      'text-lines-background-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.textLinesBackground,
      'center-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.alignment === 'center',
      'left-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.alignment === 'left',
      'right-live-content':
        inheritsGlobalTextStyles && slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content':
        inheritsGlobalTextStyles &&
        slide?.slideStyle?.lettercase === 'uppercase',
      'double-line-spacing':
        inheritsGlobalTextStyles &&
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        inheritsGlobalTextStyles &&
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        inheritsGlobalTextStyles &&
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
    class="live-content tiptap border-none w-[100%] h-[100%] pointer-events-none"
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

// Text slides own their typography inside TipTap HTML. Global slide text
// settings continue to style generated content such as songs and scripture.
const inheritsGlobalTextStyles = computed(
  () => props.slide.type !== slideTypes.text
)

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
