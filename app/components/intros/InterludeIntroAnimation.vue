<template>
  <!-- The real interlude engine playing a few of its styles in turn. -->
  <div
    class="relative w-full overflow-hidden bg-black"
    style="aspect-ratio: 16 / 9"
    aria-hidden="true"
  >
    <!-- Keyed by style, so each one plays its intro as it comes on. -->
    <InterludeView :key="current.id" :slide="SLIDES[current.id]!" mode="preview" />
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
import { defaultInterludeData } from "~/utils/interlude/slide"

// Each style with words that suit it, as an operator would set them.
const BEATS = [
  { id: "cow-original", heading: "Welcome Home", subtitle: "We'll begin shortly" },
  { id: "rolling-stone", heading: "Offering", subtitle: "Thank you for giving" },
  { id: "still-waters", heading: "Be Still", subtitle: "Pause and reflect" },
]

// Long enough for each style's 2.4s intro and a moment of its loop.
const { step } = useIntroLoop(BEATS.map(() => 4200), 0)
const current = computed(() => BEATS[step.value]!)

// As InterludeForm's previews: a bare slide carrying the interlude data.
// Built once, so a beat change never hands the view a fresh slide.
const SLIDES: Record<string, Slide> = Object.fromEntries(
  BEATS.map((beat) => [
    beat.id,
    {
      id: `interlude-intro-${beat.id}`,
      data: {
        id: beat.id,
        ...defaultInterludeData(),
        variant: beat.id,
        heading: beat.heading,
        subtitle: beat.subtitle,
      },
    } as unknown as Slide,
  ])
)
</script>
