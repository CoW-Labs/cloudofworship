<template>
  <div
    v-if="slide?.layout === slideLayoutTypes.heading_sub"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content come-up-1"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
      v-html="slide?.contents?.[0]"
    ></div>
    <div
      v-if="contentVisible"
      class="content come-up-2"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.full_text"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content come-up-1"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.two_column"
    class="slide-layout-ctn flex gap-4 h-[100%] justify-around items-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content come-up-1"
      v-html="slide?.contents?.[0]"
    ></div>
    <div
      v-if="contentVisible"
      class="content come-up-2"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.bible"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || 100) / 100)
    }vw`"
  >
    <div
      v-if="contentVisible"
      class="content come-up-1"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
      v-html="slide?.contents?.[0]"
    ></div>
    <div
      v-if="contentVisible"
      class="content come-up-2"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.countdown"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || 100) / 100)
    }vw`"
  >
    <div class="content jost" v-html="slide?.contents?.[1]"></div>
    <div
      class="content"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
      v-html="slide?.contents?.[2]"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

const props = defineProps<{
  slide: Slide
  padding: { top: number; right: number; bottom: number; left: number }
  contentVisible: boolean
}>()
</script>
