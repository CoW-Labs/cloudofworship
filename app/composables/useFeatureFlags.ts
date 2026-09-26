import { PostHog } from "posthog-js"
import { ref, onMounted } from "vue"

/**
 * NOTE: the paywall kill switch is deliberately NOT in here any more.
 *
 * It used to be the `teams` flag, and every paid gate read it. Flag SDKs
 * return their default when they cannot reach their backend, so an operator
 * who was offline — which this app supports on purpose — or behind a filter
 * that blocked PostHog silently got the entire Teams tier. Anything that
 * decides entitlement has to fail closed, so that switch now comes from our
 * own API as `paywallEnabled` on /app-config/info (see useAppInfo), and the
 * only thing that reads it is useSubscription. Do not gate a paid feature on
 * a flag key.
 *
 * Flags below are rollout switches, where failing open is the correct and
 * intended behaviour.
 */
export type FeatureFlagKey = "livestream-link" | "view-slide-templates" | "transcripts-feature" | "transcripts-free" | "ppt-conversion" | "allow-online-scripture-search-for-only-teams" | "force-sw-unregister" | "hide-free-trial-promotion" | "upgrade-modal-billing-default"

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
      // PostHog is not initialized on localhost — allow all flagged features
      if (window.location.hostname === "localhost") {
        return true
      }
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
      // PostHog is not initialized on localhost — treat all flags as enabled
      if (window.location.hostname === "localhost") {
        return true
      }
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
