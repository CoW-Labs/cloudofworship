<template>
  <div
    class="live-output w-[100%] rounded-md absolute inset-0 overflow-hidden border dark:border-primary-900 bg-cover bg-no-repeat transition-all backdrop-blur-0 bg-black"
    :style="useSlideBackground(slide)"
  >
    <!-- VIDEO BACKGROUND -->
    <BackgroundVideo
      v-show="slide?.backgroundType === backgroundTypes.video"
      :source="slide?.background"
      :repeat="slide?.slideStyle?.repeatMedia"
      :visible="slide?.backgroundType === backgroundTypes.video"
    />

    <!-- MAIN FOREGROUND CONTENT -->
    <LiveContent
      content-visible
      :slide="slide"
      :padding="{ top: 0, right: 0, bottom: 0, left: 0 }"
      :style="
        slide?.type === slideTypes.media
          ? ''
          : `backdrop-filter: blur(${slideStyles.blur}px) brightness(${slideStyles.brightness}%);`
      "
    />
  </div>
</template>

<script setup lang="ts">
import type { Slide, SlideStyle } from "~/types"
const appMounted = ref<boolean>(false)
const foregroundContentVisible = ref<boolean>(true)

const props = defineProps<{
  slide: Slide
  slideStyles: SlideStyle
}>()

watch(
  () => props.slide,
  (newVal, oldVal) => {
    if (appMounted) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        foregroundContentVisible.value = false
        setTimeout(() => {
          foregroundContentVisible.value = true
        }, 100)
      }
    }
  }
)
</script>

<style scoped></style>
