<template>
  <div class="year-scroll-container">
    <h2 ref="row1" class="year-row">
      <span v-for="(year, index) in years1" :key="`row1-${index}`" :style="{ opacity: getOpacity(index, 7) }">
        2025
      </span>
    </h2>
    <h2 v-show="!showOnlyFirstRow" ref="row2" class="year-row">
      <span v-for="(year, index) in years2" :key="`row2-${index}`" :style="{ opacity: getOpacity(index, 7) }">
        END OF YEAR REPORT
      </span>
    </h2>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue'

const { infiniteScroll, blurIn, killAnimations } = useGsapAnimations()

const props = defineProps({
  showOnlyFirstRow: {
    type: Boolean,
    default: () => false
  }
})

const row1 = ref<HTMLElement | null>(null)
const row2 = ref<HTMLElement | null>(null)

// Create arrays for repeated "2025" text - increased to 20 for seamless infinite scroll
const years1 = ref(Array(20).fill('2025'))
const years2 = ref(Array(20).fill('2025'))

let animation1: gsap.core.Tween | null = null
let animation2: gsap.core.Tween | null = null
let blurAnimation: gsap.core.Tween | null = null

// Generate varying opacities for each "2025"
function getOpacity(index: number, total: number): number {
  // Create a wave pattern of opacities between 0.3 and 1
  const normalizedIndex = index / (total - 1)
  return 0.3 + (Math.sin(normalizedIndex * Math.PI * 2) * 0.35 + 0.35)
}

onMounted(() => {
  if (!row1.value) return

  const rows = props.showOnlyFirstRow ? [row1.value] : row2.value ? [row1.value, row2.value] : [row1.value]
  
  // Blur-in animation for the rows
  blurAnimation = blurIn(rows, {
    duration: 0.8,
    delay: 0.1,
    stagger: 0.1,
    ease: 'power2.out',
    onComplete: () => {
      // Start scrolling animations after blur-in completes
      if (!row1.value) return

      const row1Width = row1.value.scrollWidth / 2

      // Animate first row from right to left
      animation1 = infiniteScroll(row1.value, {
        direction: 'left',
        duration: 40,
        distance: row1Width
      })

      // Animate second row from left to right (opposite direction)
      if (!props.showOnlyFirstRow && row2.value) {
        animation2 = infiniteScroll(row2.value, {
          direction: 'right',
          duration: 40,
          distance: row1Width
        })
      }
    }
  })
})

onBeforeUnmount(() => {
  killAnimations(animation1, animation2, blurAnimation)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap');

.year-scroll-container {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.year-row {
  font-size: 6rem;
  font-weight: 700;
  white-space: nowrap;
  display: flex;
  gap: 2rem;
  margin: 0;
  padding: 0.5rem 0;
  will-change: transform;
  line-height: 80%;
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;

}

.year-row span {
  display: inline-block;
  transition: opacity 0.3s ease;
}

@media (min-width: 768px) {
  .year-row {
    font-size: 11rem;
    gap: 2rem;
    
  }
}
</style>
