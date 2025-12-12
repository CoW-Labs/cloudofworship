<template>
  <div class="page-root">
    <div ref="bg" class="animated-bg" aria-hidden="true"></div>
    <div class="overlay" aria-hidden="true"></div>

    <main class="content">
      <h1 class="title">This is end of year.</h1>
      <p class="lead">Animation behind the page content using GSAP</p>
      <button class="btn" @click="shuffleOrder">Shuffle colors</button>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue'
import { gsap } from 'gsap'
import CustomEase from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)
// create a named cubic-bezier ease (0.22,1,0.36,1)
try {
  // CustomEase.create accepts either a bezier string or path; this shorthand works in modern GSAP
  CustomEase.create('cb', '0.22,1,0.36,1')
} catch (e) {
  // fallback: if CustomEase.create fails silently, ignore — GSAP will fallback to default eases
}

// Three gradient configurations to cycle through
const gradientConfigs = [
  {
    '#FF6F65': 10,
    '#8300FF': 80,
    '#442263': 100,
  },
  {
    '#FF6F65': 23,
    '#8300FF': 66,
    '#442263': 96,
  },
  {
    '#FF6F65': 0,
    '#8300FF': 54,
    '#442263': 100,
  }
]

// Convert config object to array format
function configToStops(config: Record<string, number>) {
  return Object.entries(config).map(([color, pos]) => ({ color, pos }))
}

const currentConfigIndex = ref(0)
const colorStops = ref(configToStops(gradientConfigs[0]))

const bg = ref<HTMLElement | null>(null)
let tl: gsap.core.Timeline | null = null
let configTransitionTl: gsap.core.Timeline | null = null

// Create gradient string from current color stops (vertical, top to bottom)
function makeGradient(stops: { pos: number; color: string }[]) {
  const s = stops.map((p) => `${p.color} ${p.pos}%`).join(', ')
  return `linear-gradient(180deg, ${s})`
}

// Update background with current stops
function updateBackground() {
  if (!bg.value) return
  bg.value.style.backgroundImage = makeGradient(colorStops.value)
}

// Transition to a specific config with custom duration
function transitionToConfig(targetIndex: number, duration: number, onComplete?: () => void) {
  const targetConfig = gradientConfigs[targetIndex]
  const targetStops = configToStops(targetConfig)
  
  // Create proxy objects to animate positions smoothly
  const proxies = colorStops.value.map((s) => ({ pos: s.pos }))
  
  // Animate each position to its new target
  proxies.forEach((proxy, i) => {
    gsap.to(proxy, {
      pos: targetStops[i].pos,
      duration: duration,
      ease: 'power2.inOut',
      onUpdate() {
        colorStops.value[i].pos = proxy.pos
        updateBackground()
      },
      onComplete() {
        if (i === proxies.length - 1 && onComplete) {
          onComplete()
        }
      }
    })
  })
}

// Slow automatic config cycling in background
function startBackgroundCycling() {
  if (configTransitionTl) configTransitionTl.kill()
  
  const cycleThroughConfigs = () => {
    const nextIndex = (currentConfigIndex.value + 1) % gradientConfigs.length
    currentConfigIndex.value = nextIndex
    
    transitionToConfig(nextIndex, 15, () => { // 15 seconds per transition - very slow
      // Wait a bit before next transition
      setTimeout(cycleThroughConfigs, 2000) // 2 second pause between transitions
    })
  }
  
  // Start the first cycle after initial load
  setTimeout(cycleThroughConfigs, 5000) // Wait 5 seconds before first cycle
}

function shuffleOrder() {
  // Kill any ongoing background cycle
  if (configTransitionTl) configTransitionTl.kill()
  
  // Move to next gradient configuration
  const nextIndex = (currentConfigIndex.value + 1) % gradientConfigs.length
  currentConfigIndex.value = nextIndex
  
  // Quick transition (2.5 seconds)
  transitionToConfig(nextIndex, 2.5, () => {
    // Resume slow background cycling after button click
    startBackgroundCycling()
  })
}

onMounted(() => {
  if (!bg.value) return
  
  // Set initial gradient
  updateBackground()
  
  // Start slow background config cycling
  startBackgroundCycling()
})

onBeforeUnmount(() => {
  if (tl) tl.kill()
  if (configTransitionTl) configTransitionTl.kill()
})
</script>

<style scoped>
@font-face {
  font-family: 'Brocolage Grotesque';
  /* Replace the URL with a local file in assets/fonts or a CDN link */
  src: url('/assets/fonts/BrocolageGrotesque.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

.overlay {
  position: fixed;
  background: url('/images/slide-bg.jpeg') center/cover no-repeat;
  /* background-size: 130%; */
  inset: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: lighten;
  opacity: 0.5;
}

.page-root {
  position: relative;
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: 'Brocolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
}

.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  /* GSAP will update background-image directly */
  background-size: 100% 100%;
  background-position: top center;
  background-repeat: no-repeat;
}

.content {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  text-align: center;
  padding: 4rem 1rem;
}

.title { font-size: 3rem; margin: 0 0 0.5rem }
.lead { margin: 0 0 1.5rem }
.btn {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  color: white;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}

</style>