<template>
  <!-- A drawing of a Bible layout, in the style of the slide pair tiles
       (SlidePairLayoutThumb): a small slide with the verse as soft lines and
       the reference in the pair purple. Drawn from the theme's own layout
       settings, so the tile follows the theme rather than a hard-coded id. -->
  <div
    class="bible-layout-thumb relative w-full overflow-hidden rounded-md"
    :style="{
      aspectRatio: '16 / 9',
      containerType: 'inline-size',
      background: SLIDE_BACKGROUND,
    }"
  >
    <!-- The verse: a few centred lines of falling width. -->
    <div
      class="absolute inset-x-0 flex flex-col items-center gap-[3.2cqw]"
      :style="verseStyle"
    >
      <span
        v-for="(width, index) in verseLines"
        :key="index"
        class="block h-[3.4cqw] rounded-full"
        :style="{
          width: `${width}%`,
          background: index === 0 ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.62)',
        }"
      />
    </div>

    <!-- The reference. A boxed one sits on a purple card with the pair lip;
         an overlay one is a band across the foot of the slide, over the
         verse. -->
    <div
      class="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
      :style="referenceStyle"
    >
      <span
        class="block rounded-full"
        :style="{
          width: referenceBarWidth,
          height: layout.labelSize === 'xlarge' ? '5.6cqw' : '3.2cqw',
          background: REFERENCE_COLOUR,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BibleTheme } from "~/composables/useTheme"
import { PAIR_CARD_COLOUR } from "~/utils/slidePairs"

const props = defineProps<{ layout: BibleTheme["layout"] }>()

const SLIDE_BACKGROUND =
  "radial-gradient(120% 90% at 50% 0%, #2c3650 0%, #1f2937 55%, #151b27 100%)"
// The lavender of a song's translation line, so the reference reads as the
// verse's second voice rather than more verse.
const REFERENCE_COLOUR = "#d9a4ff"

const top = computed(() => props.layout.labelPosition === "top")
const boxed = computed(
  () => props.layout.labelBackground && props.layout.labelPosition !== "overlay"
)
const overlay = computed(() => props.layout.labelPosition === "overlay")

// An overlay band covers the verse's foot, so the verse keeps its full three
// lines and runs under it; every other layout leaves room for the reference.
const verseLines = computed(() =>
  boxed.value ? [78, 64] : [80, 70, 52]
)

const verseStyle = computed(() => {
  if (top.value) return { top: "40%" }
  if (overlay.value) return { top: "26%" }
  return { top: boxed.value ? "20%" : "16%" }
})

const referenceBarWidth = computed(() => {
  if (overlay.value) return "34%"
  if (boxed.value) return "72%"
  return props.layout.labelSize === "xlarge" ? "46%" : "34%"
})

const referenceStyle = computed(() => {
  if (overlay.value) {
    return {
      bottom: "0",
      width: "100%",
      height: "24%",
      background: `linear-gradient(to top, ${PAIR_CARD_COLOUR}, ${PAIR_CARD_COLOUR}e6)`,
      boxShadow: "0 -0.6cqw 2.4cqw rgba(0,0,0,0.35)",
    }
  }
  if (boxed.value) {
    return {
      bottom: "14%",
      width: "46%",
      height: "15%",
      borderRadius: "2.2cqw",
      background: PAIR_CARD_COLOUR,
      border: "0.6cqw solid rgba(255,255,255,0.08)",
      boxShadow: `0 1.4cqw 0 0 #2e1540`,
    }
  }
  if (top.value) return { top: "14%", width: "100%" }
  return { bottom: "14%", width: "100%" }
})
</script>
