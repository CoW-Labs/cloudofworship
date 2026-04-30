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
      class="h-full w-full grid place-items-center bg-primary-900 text-white/80 px-2"
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

onMounted(() => {
  if (props.eager) {
    isVisible.value = true
    return
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return
      isVisible.value = entry.isIntersecting
    },
    { rootMargin: "600px 0px" }
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
