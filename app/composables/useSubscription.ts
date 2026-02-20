import { useAuthStore } from '~/store/auth'

export type SubscriptionPlan = 'free' | 'teams'

/**
 * Map action names/types to subscription tiers based on CSV features
 */
const ACTION_TIER_MAP: Record<string, 'free' | 'teams'> = {
  // Teams tier features
  'new-slide': 'teams',
  'new-media': 'teams',
  'new-templates': 'teams',
  'new-alert': 'teams',
  'remove-alert': 'teams',
  'new-countdown': 'teams',
  'new-youtube-video': 'teams',
  'new-vimeo-video': 'teams',
  'open-invite-modal': 'teams',
  'space-management': 'teams',
  'animations-transitions': 'teams',
  'overlays-themes': 'teams',
  'new-song': 'teams',
  'livestream-url': 'teams',
  'new-transcribe': 'teams',
  'new-hymn': 'teams',
  'new-search-bible': 'teams',

  // Free tier features
  'new-bible': 'free',
  'add-song': 'free',
  'new-library': 'free',
  'open-settings': 'free',
  'new-schedule': 'free',
  'toggle-dark-mode': 'free',
  'open-shortcuts': 'free',
}

export default function useSubscription() {
  const authStore = useAuthStore()

  /**
   * Get the current subscription plan
   * Checks the user's subscription, not the church's
   */
  const getCurrentPlan = (): SubscriptionPlan => {
    // Check user's personal subscription
    return authStore.church?.subscriptionPlan || 'free'
  }

  /**
   * Check if current plan is Teams
   */
  const isTeamsPlan = computed(() => {
    const plan = getCurrentPlan()
    return plan === 'teams'
  })

  /**
   * Check if current plan is Free
   */
  const isFreePlan = computed(() => {
    return getCurrentPlan() === 'free'
  })

  /**
   * Check if a feature/action requires Teams subscription
   */
  const requiresTeams = (actionName: string): boolean => {
    return ACTION_TIER_MAP[actionName] === 'teams'
  }

  /**
   * Check if user has access to a specific feature/action
   */
  const hasAccessToFeature = (actionName: string): boolean => {
    const tier = ACTION_TIER_MAP[actionName]

    // If no tier is specified, assume it's available
    if (!tier) return true

    // Free features are always accessible
    if (tier === 'free') return true

    if (tier === 'teams') {
      return isTeamsPlan.value
    }

    return true
  }

  /**
   * Get storage limit based on plan
   */
  const getStorageLimit = (): number => {
    const plan = getCurrentPlan()
    switch (plan) {
      case 'free':
        return 100 // 100MB
      case 'teams':
        return 5000 // 5GB
      default:
        return 100
    }
  }

  return {
    getCurrentPlan,
    isTeamsPlan,
    isFreePlan,
    requiresTeams,
    hasAccessToFeature,
    getStorageLimit,
  }
}
