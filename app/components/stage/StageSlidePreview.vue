<template>
  <!-- A slide with no words of its own (an image, a presentation page) drawn
       as just its picture, fitted whole into the panel: no frame, label or
       margin, so a speaker can read the page from across the stage. -->
  <div
    class="h-full w-full bg-contain bg-center bg-no-repeat"
    :style="src ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined"
    role="img"
    :aria-label="slide?.name || 'Slide picture'"
  ></div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

const props = defineProps<{
  /** The slide itself, on the local stage window. */
  slide?: Slide | null
  /** Or just its picture, on `/stagestream`. */
  image?: string
}>()

// Uploaded media reaches this window as URLs only the operator's page can
// read, so resolve it from this window's own copy, as the live window does.
// Never downloads: anything not stored here yet shows as it arrived.
const { rehydrateSlideMedia } = useSlideMediaCache()
const displayedSlide = ref<Slide | null>(props.slide || null)
let resolveToken = 0

watch(
  () => props.slide,
  async (slide) => {
    const token = ++resolveToken
    displayedSlide.value = slide || null
    if (!slide) return
    try {
      // Rehydration writes into the slide it is handed; keep the caller's
      // copy, which may be the shared live slide, out of it.
      const copy: Slide = {
        ...slide,
        data:
          slide.data && typeof slide.data === "object"
            ? ({ ...(slide.data as object) } as Slide["data"])
            : slide.data,
        presentationObjects: slide.presentationObjects?.map((page) => ({
          ...page,
        })),
      }
      const localized = await rehydrateSlideMedia(copy, { allowDownload: false })
      if (token === resolveToken) displayedSlide.value = localized
    } catch (error) {
      console.warn("Stage preview could not resolve local media:", error)
    }
  },
  { immediate: true }
)

// A presentation's background is its current page, and an image slide's is
// the image, once localized above.
const src = computed(() => props.image || displayedSlide.value?.background || "")
</script>
