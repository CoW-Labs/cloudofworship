<template>
  <!-- A Bible slide: the verse and its reference. The verse is picked and
       resized into a lower third, then the reference is picked and recoloured.
       Frames follow the Classic Bible layout until they are moved. -->
  <div
    class="relative w-full overflow-hidden"
    :style="{
      aspectRatio: '16 / 9',
      containerType: 'inline-size',
      background: SLIDE_BACKGROUND,
    }"
    aria-hidden="true"
  >
    <div
      class="intro-free-box absolute"
      :class="{ 'is-selected': verseSelected }"
      :style="frameStyle(lowered ? VERSE_FREE : VERSE_AUTO)"
    >
      <p
        class="flex h-full items-center justify-center px-[1.5cqw] text-center font-semibold leading-tight text-white transition-[font-size] duration-700"
        :style="{ fontSize: lowered ? '3.1cqw' : '4.4cqw' }"
      >
        For God so loved the world, that he gave his only begotten Son
      </p>
      <template v-if="verseSelected">
        <span
          v-for="corner in CORNERS"
          :key="corner"
          class="intro-free-handle absolute"
          :style="CORNER_STYLE[corner]"
        />
      </template>
      <IntroPointer :state="versePointer" class="left-1/2 top-1/2" />
    </div>

    <div
      class="intro-free-box absolute"
      :class="{ 'is-selected': refSelected }"
      :style="frameStyle(lowered ? REF_FREE : REF_AUTO)"
    >
      <p
        class="flex h-full items-center justify-center text-center font-bold transition-colors duration-500"
        :style="{ fontSize: '3.2cqw', color: recoloured ? REFERENCE_COLOUR : '#fff' }"
      >
        John 3:16
      </p>
      <template v-if="refSelected">
        <span
          v-for="corner in CORNERS"
          :key="corner"
          class="intro-free-handle absolute"
          :style="CORNER_STYLE[corner]"
        />
      </template>
      <IntroPointer :state="refPointer" class="left-1/2 top-1/2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import IntroPointer from "~/components/intros/IntroPointer.vue"
import { textColorPalette } from "~/utils/textColors"

// The dark gradient a slide opens on.
const SLIDE_BACKGROUND = "linear-gradient(135deg, #2a1a40 0%, #14101f 100%)"
// One of the swatches the text colour picker offers.
const REFERENCE_COLOUR = textColorPalette[8]!

type Frame = { left: number; top: number; width: number; height: number }

// Frames in % of the slide. Auto: the verse centred with the reference under
// it. Free: the verse squeezed into a lower third, the reference just above.
const VERSE_AUTO: Frame = { left: 14, top: 26, width: 72, height: 34 }
const REF_AUTO: Frame = { left: 33, top: 64, width: 34, height: 11 }
const VERSE_FREE: Frame = { left: 6, top: 68, width: 88, height: 22 }
const REF_FREE: Frame = { left: 6, top: 54, width: 28, height: 11 }

// Beats: the slide as it is, the verse picked, the verse resized to a lower
// third, the reference picked, the reference recoloured. The last is the still
// frame for reduced motion.
const { step } = useIntroLoop([1800, 1000, 2000, 1000, 2400], 4)
const lowered = computed(() => step.value >= 2)
const verseSelected = computed(() => step.value === 1 || step.value === 2)
const refSelected = computed(() => step.value >= 3)
const recoloured = computed(() => step.value >= 4)
const versePointer = computed<"hidden" | "over" | "press">(() =>
  step.value === 1 ? "over" : step.value === 2 ? "press" : "hidden"
)
const refPointer = computed<"hidden" | "over" | "press">(() =>
  step.value === 3 ? "over" : "hidden"
)

const frameStyle = (frame: Frame) => ({
  left: `${frame.left}%`,
  top: `${frame.top}%`,
  width: `${frame.width}%`,
  height: `${frame.height}%`,
})

const CORNERS = ["tl", "tr", "bl", "br"] as const
const CORNER_STYLE: Record<(typeof CORNERS)[number], Record<string, string>> = {
  tl: { left: "-5px", top: "-5px" },
  tr: { right: "-5px", top: "-5px" },
  bl: { left: "-5px", bottom: "-5px" },
  br: { right: "-5px", bottom: "-5px" },
}
</script>

<style scoped>
/* The canvas's own look: a dashed edge at rest, purple once picked. */
.intro-free-box {
  border: 1px dashed rgb(255 255 255 / 0.4);
  border-radius: 4px;
  transition:
    left 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    top 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    width 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    height 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    border-color 0.3s ease,
    background-color 0.3s ease;
}
.intro-free-box.is-selected {
  border: 2px solid rgb(168 85 247);
  background-color: rgb(168 85 247 / 0.08);
}
.intro-free-handle {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #fff;
  border: 2px solid rgb(168 85 247);
}
@media (prefers-reduced-motion: reduce) {
  .intro-free-box {
    transition: none;
  }
}
</style>
