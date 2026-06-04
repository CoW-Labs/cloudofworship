import { useAuthStore } from '~/store/auth'
import { useFeatureFlags } from '~/composables/useFeatureFlags'

export type SubscriptionPlan = 'free' | 'teams'

/**
 * Map action names/types to subscription tiers based on CSV features
 */
const ACTION_TIER_MAP: Record<string, 'free' | 'teams'> = {
  // Teams tier features
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

  // Free tier features
  'new-slide': 'free',
  'new-search-bible': 'free',
  'new-hymn': 'free',
  'new-media': 'free',
  'new-bible': 'free',
  'new-song-setlist': 'free',
  'add-song': 'free',
  'new-library': 'free',
  'open-settings': 'free',
  'new-schedule': 'free',
  'toggle-dark-mode': 'free',
  'open-shortcuts': 'free',
}

export default function useSubscription() {
  const authStore = useAuthStore()
  const { checkFlag } = useFeatureFlags()

  // If the 'transcripts-free' flag is on, treat new-transcribe as a free feature
  const effectiveTierMap = computed((): Record<string, 'free' | 'teams'> => {
    if (checkFlag('transcripts-free')) {
      return { ...ACTION_TIER_MAP, 'new-transcribe': 'free' }
    }
    return ACTION_TIER_MAP
  })

  /**
   * Get the current subscription plan
   * Checks the user's subscription first, then falls back to church subscription.
   */
  const getCurrentPlan = (): SubscriptionPlan => {
    const userPlan = authStore.user?.subscription?.plan
    if (userPlan) {
      return userPlan
    }

    const church = authStore.church

    if (church && church._id === authStore.user?.churchId) {
      return church.subscriptionPlan
    }

    return 'free'
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
    return effectiveTierMap.value[actionName] === 'teams'
  }

  /**
   * Check if user has access to a specific feature/action
   */
  const hasAccessToFeature = (actionName: string): boolean => {
    const tier = effectiveTierMap.value[actionName]

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
