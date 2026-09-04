<template>
  <UModal
    v-model="visible"
    :ui="{
      width: 'sm:max-w-[560px] lg:max-w-[620px]',
      background: '',
      ring: '',
      shadow: '',
      rounded: 'rounded-2xl',
      padding: 'p-0',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
  >
    <!-- Mirrors the onboarding tour's welcome card (OnboardingTour.vue). -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div class="flex items-center justify-between gap-4 pt-3.5 pb-3 pl-5 pr-4">
        <span
          class="text-[15px] font-medium text-gray-700 dark:text-[#e8ebf2]"
          >{{ eyebrow }}</span
        >
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Close"
          @click="dismiss"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <div
        class="mx-3 mb-3 p-6 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d] max-h-[72vh] overflow-y-auto"
      >
        <!-- Hero media -->
        <video
          v-if="heroVideo"
          class="block w-full aspect-video object-cover rounded-[10px] mb-5 bg-black"
          :src="heroVideo"
          autoplay
          loop
          muted
          playsinline
        />
        <img
          v-else-if="heroImage"
          class="block w-full aspect-video object-cover rounded-[10px] mb-5 bg-black"
          :src="heroImage"
          :alt="title"
        />

        <h2
          class="text-[30px] font-bold leading-[1.2] tracking-[-0.01em] text-slate-900 dark:text-white"
        >
          {{ title }}
        </h2>

        <!-- Content slot for custom body -->
        <div class="mt-3 text-[15px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]">
          <slot>
            <p>{{ description }}</p>
          </slot>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3 mt-7">
          <CowButton @click="dismiss">{{ cta }}</CowButton>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const STORAGE_KEY = "cow_seen_feature_intros"

const props = withDefaults(
  defineProps<{
    featureKey: string
    title: string
    eyebrow?: string
    description?: string
    heroImage?: string
    heroVideo?: string
    cta?: string
  }>(),
  {
    eyebrow: "New feature",
    description: "",
    heroImage: "",
    heroVideo: "",
    cta: "Got it",
  }
)

const visible = ref(false)

/**
 * Read already-seen feature keys from localStorage.
 */
const getSeenFeatures = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Persist a feature key as seen.
 */
const markAsSeen = (key: string) => {
  const seen = getSeenFeatures()
  if (!seen.includes(key)) {
    seen.push(key)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
    } catch {
      // Ignore storage failures (e.g. private mode, quota, SecurityError).
    }
  }
}

/**
 * Check if this feature has already been introduced.
 */
const hasBeenSeen = (): boolean => {
  return getSeenFeatures().includes(props.featureKey)
}

/**
 * Show the modal (if the feature hasn't been seen yet).
 * Returns true if the modal was shown, false if already dismissed previously.
 */
const show = (): boolean => {
  if (hasBeenSeen()) return false
  visible.value = true
  return true
}

/**
 * Dismiss and persist.
 */
const dismiss = () => {
  visible.value = false
  markAsSeen(props.featureKey)
}

defineExpose({ show, hasBeenSeen })
</script>
