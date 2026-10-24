<template>
  <!-- A drawing of a pair layout, from the same geometry the projection uses,
       so the tile and the screen cannot disagree. -->
  <div
    class="slide-pair-layout-thumb relative w-full overflow-hidden rounded-md"
    :style="{
      aspectRatio: '16 / 9',
      containerType: 'inline-size',
      background: layout === 'side-by-side' ? '#D9D9D9' : '#1f2937',
    }"
  >
    <div
      v-for="role in ROLES"
      :key="role"
      class="absolute overflow-hidden"
      :style="shapeStyle(role)"
    >
      <!-- The words: a few lines. The picture: a soft gradient. -->
      <div
        v-if="role === 'text'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-[3cqw]"
      >
        <span class="block h-[3cqw] w-3/5 rounded-full bg-white/85" />
        <span class="block h-[3cqw] w-2/5 rounded-full bg-white/60" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SlidePairLayout } from "~/types"
import {
  PAIR_CARD_COLOUR,
  PAIR_LAYOUT_GEOMETRY,
  type PairRole,
} from "~/utils/slidePairs"

const props = defineProps<{ layout: SlidePairLayout }>()

const ROLES: PairRole[] = ["text", "frame"]
const PURPLE = "#46215F"
const PICTURE = "linear-gradient(160deg, #9cc7e8 0%, #c9895f 55%, #5b6b7a 100%)"

// The tile is a few hundred pixels wide, so borders are drawn a little
// heavier than the true scale or they would vanish.
const shapeStyle = (role: PairRole) => {
  const { box, card, z } = PAIR_LAYOUT_GEOMETRY[props.layout][role]
  const colour = PAIR_CARD_COLOUR
  const isCaption = props.layout === "caption" && role === "text"
  return {
    top: `${box.top}%`,
    left: `${box.left}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    zIndex: z,
    background: role === "frame" ? PICTURE : isCaption ? "transparent" : PURPLE,
    borderRadius: card ? `${card.radius * 1.4}cqw` : undefined,
    border: card?.border ? `${Math.max(card.border * 2.5, 0.8)}cqw solid ${colour}` : undefined,
    boxShadow: card?.lip ? `0 ${card.lip * 1.4}cqw 0 0 ${colour}` : undefined,
  }
}
</script>
