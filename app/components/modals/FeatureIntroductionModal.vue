<template>
  <UModal v-model="visible">
    <UCard
      :ui="{
        ring: '',
        divide: '',
      }"
    >
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-md">{{ title }}</h2>
          <UButton icon="i-mdi-close" variant="ghost" @click="dismiss" />
        </div>
      </template>

      <!-- Hero image -->
      <div v-if="heroImage" class="mb-4 rounded-md overflow-hidden">
        <img
          :src="heroImage"
          :alt="title"
          class="w-full h-auto object-cover max-h-[200px]"
        />
      </div>

      <!-- Content slot for custom body -->
      <slot>
        <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {{ description }}
        </p>
      </slot>

      <template #footer>
        <UButton block @click="dismiss"> Got it </UButton>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const STORAGE_KEY = "cow_seen_feature_intros"

const props = withDefaults(
  defineProps<{
    featureKey: string
    title: string
    description?: string
    heroImage?: string
  }>(),
  {
    description: "",
    heroImage: "",
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
