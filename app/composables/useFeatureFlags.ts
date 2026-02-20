import { PostHog } from "posthog-js"
import { ref, onMounted } from "vue"

export type FeatureFlagKey = "livestream-link" | "view-slide-templates"

/**
 * Composable for managing PostHog feature flags
 * @param flagKey - The feature flag key to check
 * @returns Object containing flag state and methods to check/reload the flag
 */
export const useFeatureFlags = (flagKey?: FeatureFlagKey) => {
  const { $posthog } = useNuxtApp()
  const posthog = $posthog as PostHog

  const isEnabled = ref<boolean>(false)
  const isLoading = ref<boolean>(true)
  const flags = ref<Record<string, boolean | string>>({})

  /**
   * Check if a specific feature flag is enabled
   * @param key - The feature flag key to check
   * @returns boolean indicating if the flag is enabled
   */
  const checkFlag = (key: FeatureFlagKey): boolean => {
    if (!posthog) {
      console.warn("PostHog is not initialized")
      return false
    }

    const flagValue = posthog.isFeatureEnabled(key)
    return flagValue === true
  }

  /**
   * Get the value of a feature flag (can be boolean or string)
   * @param key - The feature flag key
   * @returns The flag value or undefined
   */
  const getFlagValue = (key: FeatureFlagKey): boolean | string | undefined => {
    if (!posthog) {
      console.warn("PostHog is not initialized")
      return undefined
    }

    return posthog.getFeatureFlag(key) as boolean | string | undefined
  }

  /**
   * Reload feature flags from PostHog
   */
  const reloadFlags = async (): Promise<void> => {
    if (!posthog) {
      console.warn("PostHog is not initialized")
      isLoading.value = false
      return
    }

    isLoading.value = true

    // Reload feature flags
    posthog.reloadFeatureFlags()

    // Wait a bit for flags to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Update specific flag if provided
    if (flagKey) {
      isEnabled.value = checkFlag(flagKey)
    }

    isLoading.value = false
  }

  /**
   * Check multiple feature flags at once
   * @param keys - Array of feature flag keys to check
   * @returns Record of flag keys and their enabled status
   */
  const checkMultipleFlags = (keys: FeatureFlagKey[]): Record<string, boolean> => {
    const result: Record<string, boolean> = {}

    keys.forEach((key) => {
      result[key] = checkFlag(key)
    })

    return result
  }

  // Initialize on mount
  onMounted(async () => {
    if (posthog) {
      await reloadFlags()
    } else {
      isLoading.value = false
    }
  })

  return {
    // State
    isEnabled,
    isLoading,
    flags,

    // Methods
    checkFlag,
    getFlagValue,
    reloadFlags,
    checkMultipleFlags,
  }
}

export default useFeatureFlags
