<template>
  <!-- A template drawn with plain elements: one background and a few boxes.
       It reads the same box styles the projector does, but mounts no slide
       component, no editor and no video, so a gallery of them stays cheap. -->
  <div class="template-preview w-full overflow-hidden" :style="frameStyle" aria-hidden="true">
    <!-- cqw resolves against the nearest container above an element, so the
         base size sits on this inner layer. Size and line height match the
         projector's text slide (3cqw, 1.5). -->
    <div class="relative h-full w-full" :style="{ fontSize: '3cqw', lineHeight: 1.5 }">
      <div
        v-for="box in design.boxes"
        :key="box.id"
        class="slide-box absolute flex flex-col justify-center"
        :class="boxStyleClasses(box)"
        :style="boxFrameStyle(box)"
        v-html="box.html"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TemplateDesign } from "~/types"
import { boxFrameStyle, boxStyleClasses } from "~/utils/textBoxes"

const props = defineProps<{ design: TemplateDesign }>()

const frameStyle = computed(() => {
  const { backgroundType, background } = props.design
  return {
    // Tailwind's aspect utilities emit no CSS in this project.
    aspectRatio: "16 / 9",
    containerType: "inline-size",
    ...(backgroundType === "solid" ? { backgroundColor: background } : {}),
    ...(backgroundType === "gradient" ? { backgroundImage: background } : {}),
    ...(backgroundType === "image"
      ? {
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  }
})
</script>

<style scoped>
.slide-box :deep(p) {
  margin: 0;
}
</style>
