<template>
  <!-- A camera and a verse on one screen, moving through each pair layout.
       Positions come from the geometry the projection uses. -->
  <div
    class="relative w-full overflow-hidden transition-colors duration-700"
    :style="{
      aspectRatio: '16 / 9',
      containerType: 'inline-size',
      background: layout === 'side-by-side' ? sideBySideBackground : '#1f2937',
    }"
    aria-hidden="true"
  >
    <div
      v-for="role in ROLES"
      :key="role"
      class="intro-pair-region absolute"
      :style="regionStyle(role)"
    >
      <div class="relative h-full w-full overflow-hidden" :style="clipStyle(role)">
        <IntroCameraFeed v-if="role === 'frame'" />
        <div
          v-else
          class="absolute inset-0 flex items-center justify-center px-[4cqw] text-center text-white transition-colors duration-700"
          :style="{
            background: layout === 'caption' ? 'transparent' : PAIR_CARD_COLOUR,
            textShadow: layout === 'caption' ? '0 0.3cqw 1.2cqw rgb(0 0 0 / 0.6)' : undefined,
          }"
        >
          <p
            class="font-bold leading-tight transition-[font-size] duration-700"
            :style="{ fontSize: verseSize }"
          >
            For God so loved the world
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  DEFAULT_PAIR_BACKGROUND,
  PAIR_CARD_COLOUR,
  PAIR_LAYOUT_GEOMETRY,
  SLIDE_PAIR_LAYOUTS,
  type PairRole,
} from "~/utils/slidePairs"

const ROLES: PairRole[] = ["text", "frame"]
const sideBySideBackground = DEFAULT_PAIR_BACKGROUND.background ?? "#D9D9D9"

// One beat per layout, in the order the layout picker lists them.
const { step } = useIntroLoop(SLIDE_PAIR_LAYOUTS.map(() => 2400), 0)
const layout = computed(() => SLIDE_PAIR_LAYOUTS[step.value]!.value)

// The words fill the screen in picture in picture, so they read larger there.
const verseSize = computed(() =>
  layout.value === "picture-in-picture"
    ? "6cqw"
    : layout.value === "side-by-side"
      ? "4.6cqw"
      : "3.6cqw"
)

// As LivePairProjection: the card is its own colour showing round the member
// (padding), with a hard lip of the same colour below it.
const regionStyle = (role: PairRole) => {
  const { box, card, z } = PAIR_LAYOUT_GEOMETRY[layout.value][role]
  return {
    top: `${box.top}%`,
    left: `${box.left}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    zIndex: z,
    borderRadius: card ? `${card.radius}cqw` : "0cqw",
    padding: card?.border ? `${card.border}cqw` : "0cqw",
    backgroundColor: card?.border ? PAIR_CARD_COLOUR : "transparent",
    boxShadow: card?.lip
      ? `0 ${card.lip}cqw 0 0 ${PAIR_CARD_COLOUR}`
      : `0 0cqw 0 0 transparent`,
  }
}

const clipStyle = (role: PairRole) => {
  const card = PAIR_LAYOUT_GEOMETRY[layout.value][role].card
  return {
    borderRadius: card ? `max(0px, ${card.radius - card.border}cqw)` : "0px",
  }
}
</script>

<style scoped>
.intro-pair-region {
  transition:
    top 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    left 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    width 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    height 0.7s cubic-bezier(0.65, 0, 0.35, 1),
    border-radius 0.7s ease,
    padding 0.7s ease,
    background-color 0.7s ease,
    box-shadow 0.7s ease;
}
@media (prefers-reduced-motion: reduce) {
  .intro-pair-region {
    transition: none;
  }
}
</style>
