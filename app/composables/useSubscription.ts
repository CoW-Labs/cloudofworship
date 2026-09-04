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
  'new-time-slide': 'teams',
  'show-slide-overlay': 'teams',
  'remove-slide-overlay': 'teams',
  'new-youtube-video': 'teams',
  'new-vimeo-video': 'teams',
  'open-invite-modal': 'teams',
  'livestream-url': 'teams',
  'new-transcribe': 'teams',
  // The online song/lyrics library search ("Search song lyrics" → SongsList).
  // Only the *search* is gated: 'new-song' below stays free so a church can
  // still play songs it saved itself (personal library, "Add Song").
  'new-song-search': 'teams',

  // Free tier features
  'new-slide': 'free',
  'open-stage-display': 'free',
  'new-search-bible': 'free',
  'new-hymn': 'free',
  'new-media': 'free',
  'new-bible': 'free',
  'new-song': 'free', // creating a song slide from an already-owned song
  'new-song-setlist': 'free',
  'add-song': 'free',
  'new-library': 'free',
  'open-settings': 'free',
  'new-schedule': 'free',
  'toggle-dark-mode': 'free',
  'open-shortcuts': 'free',
  // Niche in-app settings — free to use, no longer paywalled.
  'space-management': 'free',
  'animations-transitions': 'free',
  'overlays-themes': 'free',
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
   * Get the current subscription plan.
   * church.subscriptionPlan is the ONLY authoritative source of the *current*
   * plan. user.subscription.plan is stale and must NOT be used as a fallback —
   * trusting it would grant Teams features / cloud upload to users who are no
   * longer on Teams. When church is not loaded we cannot know the plan, so we
   * fail safe to 'free'.
   */
  const getCurrentPlan = (): SubscriptionPlan => {
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
   * True when the church used to be on Teams but is not any more — the
   * subscription lapsed, was canceled, or they paid for Teams at some point
   * and have since dropped back to Free.
   *
   * hadTeamsBefore comes from GET /church/:churchId and is true only for real
   * (non-trial) Teams subscriptions, so a church that only ever ran a trial
   * does not count as lapsed.
   */
  const hasLapsedTeamsSubscription = computed(() => {
    // Currently on Teams — nothing to restore.
    if (isTeamsPlan.value) return false

    return authStore.church?.hadTeamsBefore === true
  })

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
    hasLapsedTeamsSubscription,
  }
}
