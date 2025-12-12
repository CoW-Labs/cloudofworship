<template>
  <div class="page-root">
    <div ref="bg" class="animated-bg" aria-hidden="true"></div>
      <div class="overlay" aria-hidden="true"></div>

    <main class="content">
      <div class="flex justify-center md:justify-between align-items-center gap-2 mb-6 w-[90%] lg:w-[85%] mx-auto px-4 lg:px-0">
       <a href="">
         <CoWLogo class="w-[200px] md:w-auto" />
       </a>
        <p class="hidden sm:text-sm lg:text-base font-light md:flex items-center">
          END OF YEAR REPORT
        </p>
      </div>

      <div v-for="insight in reformedData"  v-show="step === insight.id" :key="insight.id">
        <!-- MAIN CONTENT - STARTS -->
        <div class="main flex-1 flex items-center">
          <div class="w-full">
            <YearScroll v-show="step === '0'" />
            <section v-show="step !== '0'" ref="contentSection" class="mb-6 w-[90%] lg:w-[85%] mx-auto px-4 lg:px-0">
              <div class="flex">
                <h4 ref="mainText" class="brand-text text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold w-full lg:w-[85%] leading-tight" v-html="insight.maintext"></h4>
              </div>
              <p ref="subText" class="text-lg sm:text-xl md:text-2xl lg:text-4xl font-light mt-4 lg:mt-8 opacity-80 leading-relaxed" v-html="insight.subtext"></p>
            </section>
          </div>
        </div>

        <div ref="actionButtons" class="flex flex-row align-items-center gap-2 mb-6 w-[90%] lg:w-[85%] mx-auto mt-[8%] lg:mt-[12.5%] px-4 lg:px-0">
          <button 
            v-if="step !== '0'" 
            class="btn rounded" 
            @click="prevStep(insight.id)"
            :disabled="step === '0'"
          >
            <UIcon name="i-mdi-chevron-left" class="text-2xl lg:text-3xl" />
          </button>
          <button 
            v-for="(action, index) in insight.actions" 
            :key="index"
            class="btn w-full sm:w-auto" 
            @click="handleAction(action, insight.id)"
          >
            {{ action.text }}
          </button>
        </div>
        <!-- MAIN CONTENT - ENDS -->
      </div>

      <footer>
        <YearScroll :showOnlyFirstRow="true" />
      </footer>
    </main>

  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useAuthStore } from '~/store/auth'

const authStore = useAuthStore()
const { animateGradientStops, makeGradient, blurIn, blurOut, killAnimations, gsap } = useGsapAnimations()

const gradientConfigs = [
  {
    '#FF6F65': 10,
    '#8300FF': 87,
    '#442263': 100,
  },
  {
    '#FF6F65': 35,
    '#8300FF': 87,
    '#442263': 97,
  },
  {
    '#FF6F65': 0,
    '#8300FF': 10,
    '#442263': 100,
  }
]

const step = ref("0")
const apiData = ref<null | {
  liveSessions: number
  songs: {
    shared: number
    contributionPercentile: number
  }
  scriptureUsage: number
  files: {
    fileCount: number
    bytesUsed: number
  }
  countdownSlides: number
}> (null)
const data = ref([
  {
    "id": "0",
    "maintext": "Hello, {{church_name}}, you made the bold choice to try out CoW in May 2025.",
    "subtext": "Thank you for stepping into something new with us. We’re grateful you trusted CoW to serve your church, and we’re excited to show you just how impactful your year has been. Let’s take a look at how your year went!",
    "actions": [
      {
        "text": "See your year in review",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "1",
    "maintext": "Hello, {{church_name}}, you made the bold choice to try out CoW in May 2025.",
    "subtext": "Thank you for stepping into something new with us. <br> Let’s take a look at how your year went!",
    "actions": [
      {
        "text": "See your year in review",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "2",
    "maintext": "You went live on CoW 6,540 times this year.",
    "subtext": "Your most active days? Sunday (of course!) and Wednesday.",
    "actions": [
      {
        "text": "Next",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "3",
    "maintext": "Your church contributed 173+ songs, placing you in the top 0.05% of all CoW churches.",
    "subtext": "That’s incredible! Check out the global leaderboard at lyrics.cloudofworship.com.",
    "actions": [
      {
        "text": "Next",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "4",
    "maintext": "Your church loves Scriptures — no surprises there.",
    "subtext": "With 1,257+ Bible passages opened, you’ve engaged more Scripture than 80% of churches on CoW.",
    "actions": [
      {
        "text": "See your Scripture engagement",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "5",
    "maintext": "You’ve uploaded 30+ media files totaling 430 MB on CoW.",
    "subtext": "Guess what? We love a church that covets all of the free cloud storage we share. That's why we are Cloud of Worship.",
    "actions": [
      {
        "text": "See your media uploads",
        "link": "",
        "type": "next"
      }
    ]
  },
  {
    "id": "6",
    "maintext": "We also noticed you haven’t tried the countdown feature yet.",
    "subtext": "Over 100 churches are already enjoying it — you should give it a go!",
    "actions": [
      {
        "text": "Add countdown animation",
        "link": "#add-countdown",
        "type": "next"
      }
    ]
  },
  {
    "id": "7",
    "maintext": "That’s a wrap for this year!",
    "subtext": "We’ve got loads of exciting features coming in 2026, and we hope you’re just as excited as we are.",
    "actions": [
      {
        "text": "Share CoW with someone",
        "link": "#share-cow",
        "type": "next"
      }
    ]
  },
  {
    "id": "8",
    "maintext": "See our documentary on the State of Church media today",
    "subtext": "",
    "actions": [
      {
        "text": "Watch documentary",
        "link": "#documentary",
        "type": "link"
      }
    ]
  }
])

// Computed property to reform data with API values
const reformedData = computed(() => {
  if (!apiData.value || !authStore.church) return data.value

  const church = authStore.church
  const api = apiData.value

  // Helper function to format bytes to MB
  const bytesToMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(0)

  return data.value.map(item => {
    let maintext = item.maintext
    let subtext = item.subtext

    // Replace church name with colored version
    const churchName = `<span class="text-primary-300">${church?.type || church?.name || 'Church'}</span>`
    const churchCreationDate = church?.createdAt ? new Date(church.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2025'
    maintext = maintext.replace(/May 2025/g, churchCreationDate)
    subtext = subtext.replace(/May 2025/g, churchCreationDate)
    maintext = maintext.replace(/{{church_name}}/g, churchName)
    subtext = subtext.replace(/{{church_name}}/g, churchName)

    // Update counts based on item id
    switch (item.id) {
      case '2':
        // Live sessions count
        maintext = maintext.replace(/6,540/g, `<span class="text-primary-300">${api.liveSessions || 0}</span>`)
        break
      case '3':
        // Songs contribution
        maintext = maintext.replace(/173\+/g, `<span class="text-primary-300">${api.songs?.shared || 0}+</span>`)
        maintext = maintext.replace(/0\.05%/g, `<span class="text-primary-300">${api.songs?.contributionPercentile?.toFixed(2) || 0}%</span>`)
        break
      case '4':
        // Scripture usage
        subtext = subtext.replace(/1,257\+/g, `<span class="text-primary-300">${api.scriptureUsage || 0}+</span>`)
        subtext = subtext.replace(/80%/g, `<span class="text-primary-300">80%</span>`)
        break
      case '5':
        // Media files
        maintext = maintext.replace(/30\+/g, `<span class="text-primary-300">${api.files?.fileCount || 0}+</span>`)
        maintext = maintext.replace(/430 MB/g, `<span class="text-primary-300">${bytesToMB(api.files?.bytesUsed || 0)} MB</span>`)
        break
      case '6':
        // Countdown feature - conditionally show if they have used it
        if (api.countdownSlides > 0) {
          maintext = `You've created <span class="text-primary-300">${api.countdownSlides}</span> countdown slides this year.`
          subtext = "That's awesome! Keep engaging your congregation with these dynamic elements."
          return { ...item, maintext, subtext, actions: [{ text: "Next", link: "", type: "next" }] }
        }
        break
    }

    return { ...item, maintext, subtext }
  })
})

// Convert config object to array format
function configToStops(config: Record<string, number>) {
  return Object.entries(config).map(([color, pos]) => ({ color, pos }))
}

const currentConfigIndex = ref(0)
const colorStops = ref(configToStops(gradientConfigs[0]))

const bg = ref<HTMLElement | null>(null)
const mainText = ref<HTMLElement | null>(null)
const subText = ref<HTMLElement | null>(null)
const actionButtons = ref<HTMLElement | null>(null)
const contentSection = ref<HTMLElement | null>(null)

let tl: gsap.core.Timeline | null = null
let configTransitionTl: gsap.core.Timeline | null = null
let contentAnimations: gsap.core.Tween[] = []
let hasAnimatedButtons = ref(false)

const getYearlyData = async () => {
  try {
    const { data: fetchedData } = await useAPIFetch('/year-report/2025')
    if (fetchedData.value) {
      apiData.value = fetchedData.value
    }
  } catch (error) {
    console.error('Error fetching yearly data:', error)
  }
}

// Update background with current stops
function updateBackground() {
  if (!bg.value) return
  bg.value.style.backgroundImage = makeGradient(colorStops.value)
}

// Transition to a specific config with custom duration
function transitionToConfig(targetIndex: number, duration: number, onComplete?: () => void) {
  const targetConfig = gradientConfigs[targetIndex]
  
  animateGradientStops(
    colorStops.value,
    targetConfig,
    duration,
    updateBackground,
    onComplete
  )
}

// Animate content elements with blur-in effect
function animateContentIn() {
  nextTick(() => {
    // Kill any existing content animations
    contentAnimations.forEach(anim => anim.kill())
    contentAnimations = []

    const elements = []
    if (mainText.value) elements.push(mainText.value)
    if (subText.value) elements.push(subText.value)
      elements.push(actionButtons.value)
      hasAnimatedButtons.value = true
    // Only animate buttons on first appearance
    if (actionButtons.value && !hasAnimatedButtons.value) {
    }

    if (elements.length > 0) {
      const anim = blurIn(elements, {
        duration: 0.6,
        delay: 0.05,
        stagger: 0.02,
        ease: 'power2.out'
      })
      contentAnimations.push(anim)
    }
  })
}

// Animate content elements with blur-out effect
function animateContentOut(callback?: () => void) {
  const elements = []
  if (mainText.value) elements.push(mainText.value)
  if (subText.value) elements.push(subText.value)
  // Don't animate out buttons, they stay visible

  if (elements.length > 0) {
    const anim = blurOut(elements, {
      duration: 0,
      stagger: 0,
      ease: 'power2.in',
      onComplete: callback
    })
    contentAnimations.push(anim)
  } else if (callback) {
    callback()
  }
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

const nextStep = (currentStep: string) => {
  // Animate out current content
  animateContentOut(() => {
    // Change step after animation completes
    shuffleOrder()
    step.value = String(+currentStep + 1)
    console.log('step', step.value, currentStep)
    
    // Animate in new content
    animateContentIn()
  })
}

const prevStep = (currentStep: string) => {
  const currentStepNum = +currentStep
  if (currentStepNum > 0) {
    animateContentOut(() => {
      shuffleOrder()
      step.value = String(currentStepNum - 1)
      animateContentIn()
    })
  }
}

const handleAction = (action: { text: string, link: string, type: string }, currentStep: string) => {
  if (action.type === 'next') {
    nextStep(currentStep)
  } else if (action.type === 'link' && action.link) {
    // Open link in new tab
    window.open(action.link, '_blank')
  }
}

// Watch for step changes to trigger animations
watch(step, (newStep) => {
  if (newStep !== '0') {
    animateContentIn()
  }
})

onMounted(() => {
  useNuxtApp().$pwa?.updateServiceWorker()
  getYearlyData()

  if (!bg.value) return
  
  // Set initial gradient
  updateBackground()
  
  // Start slow background config cycling
  startBackgroundCycling()
})

onBeforeUnmount(() => {
  killAnimations(tl, configTransitionTl, ...contentAnimations)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap');

.brand-text {
  font-family: 'Bricolage Grotesque', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
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
  animation: rotateScale 30s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
  transform-origin: center center;
  transform: scale(1.15);
}

@keyframes rotateScale {
  0% {
    transform: rotate(0deg) scale(1.15);
  }
  50% {
    transform: rotate(5deg) scale(1.6);
  }
  70% {
    transform: rotate(-5deg) scale(1.35);
  }
  100% {
    transform: rotate(-5deg) scale(1.15);
  }
}

.page-root {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh; /* Use dynamic viewport height for mobile */
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
  width: 100vw;
  height: 100vh;
  /* GSAP will update background-image directly */
  background-size: 100% 100%;
  background-position: top center;
  background-repeat: no-repeat;
}

.content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  color: white;
  padding: 2rem 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 768px) {
  .content {
    padding: 4rem 0;
  }
}

.title { font-size: 3rem; margin: 0 0 0.5rem }
.lead { margin: 0 0 1.5rem }

.btn {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  color: white;
  padding: 0.5rem 1.2rem;
  border-radius: 40px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  font-size: 0.875rem;
  white-space: nowrap;
  height: 60px;
}

@media (min-width: 768px) {
  .btn {
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
  }
}

.btn:hover {
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.35);
  box-shadow: 0 0 20px rgba(255,255,255,0.15);
  transform: translateY(-2px);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.rounded {
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
}

@media (min-width: 768px) {
  .btn.rounded {
    padding: 1rem;
  }
}

/* Ensure animated elements start in correct state */
.main h4,
.main p {
  will-change: transform, opacity, filter;
}

.year-scroll-container {
  will-change: transform, opacity, filter;
}
</style>
