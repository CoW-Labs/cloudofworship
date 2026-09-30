<template>
  <div ref="previewEl" :class="previewClass">
    <LiveContentWithBackground
      v-if="shouldRenderPreview"
      :slide="slide"
      :slide-label="slideLabel"
      :slide-styles="slideStyles"
    />
    <div
      v-else
      class="h-full w-full grid place-items-center bg-black text-white/80 px-2"
    >
      <span class="text-[10px] leading-tight text-center line-clamp-2">
        {{ useShortSlideName(slide) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

const props = defineProps<{
  slide: Slide
  slideLabel?: string
  slideStyles?: any
  previewClass?: string
  eager?: boolean
}>()

const previewEl = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null

const shouldRenderPreview = computed(() => props.eager || isVisible.value)

const PRELOAD_MARGIN = 600

// Once a preview has rendered it stays rendered: the virtual scroller already
// unmounts far-off cards, and tearing the preview down here only made its
// background reload (and flash the placeholder) on the way back.
const markVisible = () => {
  isVisible.value = true
  observer?.disconnect()
  observer = null
}

onMounted(() => {
  if (props.eager) {
    isVisible.value = true
    return
  }

  // Cards remounted by the virtual scroller are usually already on screen;
  // checking synchronously avoids a placeholder frame before the observer's
  // first (async) callback.
  const rect = previewEl.value?.getBoundingClientRect()
  if (
    rect &&
    rect.bottom >= -PRELOAD_MARGIN &&
    rect.top <= window.innerHeight + PRELOAD_MARGIN
  ) {
    markVisible()
    return
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) markVisible()
    },
    { rootMargin: `${PRELOAD_MARGIN}px 0px` }
  )

  if (previewEl.value) {
    observer.observe(previewEl.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
