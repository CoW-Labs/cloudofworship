<template>
  <div
    class="live-output w-[100%] rounded-md absolute inset-0 overflow-hidden border dark:border-primary-900 bg-cover bg-no-repeat transition-all backdrop-blur-0 bg-black"
    :style="backgroundStyle"
  >
    <!-- PRESENTATION SLIDE: render the current page as a fullscreen image -->
    <div
      v-if="slide?.type === slideTypes.presentation"
      class="absolute inset-0"
    >
      <!-- `object-cover`, not `contain`. This component only ever draws
           thumbnails (DeferredSlidePreview and TemplateCard) — the projector
           goes through LiveProjectionOnly, which keeps `contain` so a deck page
           is never cropped on screen. Here the box is 3:2 while pages are 16:9
           or 4:3, so `contain` left black bars that are invisible against the
           dark schedule row: a deck slide read as a shorter thumbnail than the
           text and Bible slides around it. Cover matches the `bg-cover` every
           other slide type already gets in this same component. -->
      <img
        v-if="currentPresentationPageUrl"
        :src="currentPresentationPageUrl"
        class="w-full h-full object-cover"
        alt="Presentation page"
      />
    </div>

    <!-- EXTERNAL VIDEO PLACEHOLDER -->
    <div
      v-if="
        slide?.type === slideTypes.media &&
        ((slide?.data as any)?.type === 'youtube' ||
          (slide?.data as any)?.type === 'vimeo')
      "
      class="absolute inset-0 bg-primary-950"
    >
      <!-- Thumbnail Background -->
      <div v-if="(slide?.data as any)?.thumbnail" class="absolute inset-0">
        <img
          :src="(slide?.data as any)?.thumbnail"
          :alt="(slide?.data as any)?.name"
          class="w-full h-full object-cover opacity-100"
        />
      </div>
    </div>

    <!-- VIDEO BACKGROUND -->
    <BackgroundVideo
      v-show="
        slide?.backgroundType === backgroundTypes.video &&
        (slide?.data as ExternalVideo)?.type !== 'youtube' &&
        (slide?.data as ExternalVideo)?.type !== 'vimeo'
      "
      :source="slide?.background"
      :repeat="slide?.slideStyle?.repeatMedia ?? false"
      :visible="slide?.backgroundType === backgroundTypes.video"
    />

    <!-- MAIN FOREGROUND CONTENT -->
    <LiveContent
      content-visible
      :slide="slide"
      :padding="{ top: 0, right: 0, bottom: 0, left: 0 }"
      :style="
        slide?.type === slideTypes.media || slide?.type === slideTypes.presentation
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

const currentPresentationPageUrl = computed(() => {
  const idx = props.slide?.presentationPageIndex ?? 0
  return props.slide?.presentationObjects?.[idx]?.imageUrl ?? null
})

const backgroundStyle = computed(() => useSlideBackground(props.slide))

watch(
  () => props.slide,
  (newVal, oldVal) => {
    if (appMounted) {
      if (oldVal?.id !== newVal?.id || oldVal?.updatedAt !== newVal?.updatedAt) {
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
