<template>
  <div ref="container" class="overflow-hidden bg-black">
    <video
      v-if="visible"
      ref="video"
      class="h-full w-full object-cover"
      :src="src"
      muted
      playsinline
      preload="metadata"
      @loadedmetadata="showFirstFrame"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue"

const props = defineProps<{ src?: string; playing?: boolean }>()
const container = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const visible = ref(false)
let observer: IntersectionObserver | null = null
let disposed = false

const syncPlayback = async () => {
  await nextTick()
  const element = video.value
  if (!element) return
  if (props.playing && visible.value && !disposed) {
    try {
      await element.play()
      if (!props.playing || !visible.value || disposed) element.pause()
    } catch { /* Preview playback may be refused by the browser. */ }
  } else element.pause()
}

const showFirstFrame = () => {
  const element = video.value
  if (!element) return
  // Seek once for a still thumbnail. Only the hovered/focused item decodes
  // continuously; offscreen items have no video element or media request.
  if (!props.playing && Number.isFinite(element.duration) && element.duration > 0) {
    element.currentTime = Math.min(0.1, element.duration / 2)
  }
  void syncPlayback()
}

watch(() => [props.playing, props.src, visible.value], syncPlayback)
onMounted(() => {
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true
    return
  }
  observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) video.value?.pause()
    visible.value = !!entry?.isIntersecting
  })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => {
  disposed = true
  video.value?.pause()
  observer?.disconnect()
})
</script>
