import { useAuthStore } from '~/store/auth'
import { useFeatureFlags } from '~/composables/useFeatureFlags'
import { useAppInfo } from '~/composables/useAppInfo'
import { quickActionsArr } from '~/utils/constants'

export type SubscriptionPlan = 'free' | 'teams'

/**
 * How long a cached plan stays trusted without the API confirming it.
 *
 * The plan is read from persisted state on every gate check, and this app is
 * offline-first by design: it is run on church wifi, on a Sunday morning, and
 * "100% offline functionality" is something we sell. So the gate must not need
 * a live request, and a paying church must never be locked out of what it paid
 * for because the router dropped mid-service.
 *
 * Two weeks is deliberately generous. Wrongly walling a paying church out of
 * its own service is a far worse failure than a lapsed church keeping Teams
 * for one more Sunday, and a real downgrade still lands the moment the app is
 * next opened online. Anything that actually costs us money (storage, Deepgram
 * minutes, PPT conversion) is enforced by the API on every request regardless
 * of what this cache says.
 */
export const PLAN_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Tiers authored on the quick actions themselves, in `quickActionsArr`.
 *
 * Every QuickAction carries a `tier`, and until now nothing read it: gating ran
 * entirely off ACTION_TIER_MAP below, so an action authored `tier: "teams"` and
 * forgotten in the map shipped free, silently. (CLAUDE.md even documented the
 * field as driving the logic, which it did not.) Folding it in makes the field
 * real and makes the safe thing the default — a new paid action is gated by its
 * own definition, with no second place to remember.
 *
 * ACTION_TIER_MAP still wins on conflict, and still carries the entries that
 * have no quick action of their own (slide overlays, alert removal, the
 * settings sub-features). At the time of writing the two agree everywhere, so
 * this changes no behaviour today.
 */
const AUTHORED_TIER_MAP: Record<string, 'free' | 'teams'> = Object.fromEntries(
  quickActionsArr
    .filter((action) => action?.action && (action.tier === 'free' || action.tier === 'teams'))
    .map((action) => [action.action, action.tier as 'free' | 'teams'])
)

/**
 * Map action names/types to subscription tiers based on CSV features
 */
const ACTION_TIER_MAP: Record<string, 'free' | 'teams'> = {
  // Teams tier features
  'new-templates': 'teams',
  'new-alert': 'teams',
  'remove-alert': 'teams',
  'new-countdown': 'teams',
  // A countdown sent to the stage display only — same feature, other screen.
  'new-stage-countdown': 'teams',
  'clear-stage-countdown': 'teams',
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
  // Stage timer controls ride with the stage display itself.
  'start-stage-timer': 'free',
  'stop-stage-timer': 'free',
  'restart-stage-timer': 'free',
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
  const { isPaywallEnabled } = useAppInfo()

  // If the 'transcripts-free' flag is on, treat new-transcribe as a free feature
  const effectiveTierMap = computed((): Record<string, 'free' | 'teams'> => {
    const base = { ...AUTHORED_TIER_MAP, ...ACTION_TIER_MAP }

    if (checkFlag('transcripts-free')) {
      return { ...base, 'new-transcribe': 'free' }
    }
    return base
  })

  /**
   * True once the cached church actually belongs to the signed-in user, i.e.
   * the plan is knowable at all.
   *
   * Callers that do something irreversible on a Free reading — a hard redirect
   * to the upgrade wall, auto-opening the upgrade modal — must wait for this,
   * because `getCurrentPlan` fails safe to 'free' on a cold start and would
   * otherwise bounce a paying church out of its own app.
   */
  const isPlanKnown = computed(
    () => !!authStore.church && authStore.church._id === authStore.user?.churchId
  )

  /**
   * True when the cached plan has gone too long without the API confirming it.
   * Also true for a church cached by a build that predates `planVerifiedAt`,
   * since an unknown age is not a verified one.
   */
  const isPlanCacheStale = computed(() => {
    if (!isPlanKnown.value) return false

    const verifiedAt = authStore.planVerifiedAt
    if (!verifiedAt) return true

    return Date.now() - verifiedAt > PLAN_GRACE_PERIOD_MS
  })

  /**
   * Get the current subscription plan.
   *
   * church.subscriptionPlan is the ONLY authoritative source of the *current*
   * plan. user.subscription.plan is stale and must NOT be used as a fallback —
   * trusting it would grant Teams features / cloud upload to users who are no
   * longer on Teams. When church is not loaded we cannot know the plan, so we
   * fail safe to 'free'.
   *
   * Beyond the grace period the cache can only ever *downgrade*: an unconfirmed
   * 'teams' decays to 'free', while a stale 'free' stays 'free'. Staleness is
   * doubt about the plan, and doubt must never be resolved in favour of handing
   * out the paid tier.
   */
  const getCurrentPlan = (): SubscriptionPlan => {
    if (!isPlanKnown.value) return 'free'

    // Anything that is not exactly 'teams' is free. The cached church can come
    // from a payload that omits subscriptionPlan altogether — the join screen
    // stores the public shape of the church it was invited to — and an unknown
    // value must never read as paid. It must not read as *neither* either:
    // returning it verbatim would leave isTeamsPlan and isFreePlan both false,
    // which quietly switches off every free-tier cap (`isFreePlan && count >= 5`).
    if (authStore.church!.subscriptionPlan !== 'teams') return 'free'

    // A Teams plan we have not been able to confirm lately decays to free.
    if (isPlanCacheStale.value) return 'free'

    return 'teams'
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
   * Check if user has access to a specific feature/action.
   *
   * The app-wide kill switch is applied HERE rather than at each call site.
   * It used to be every caller's job to write
   * `!hasAccessToFeature(x) && isPremiumFeatureEnabled.value`, which meant one
   * forgotten clause silently shipped a paid feature for free, and every one of
   * those clauses read a PostHog flag that returns false when it cannot reach
   * PostHog — so the whole paywall came off offline or behind a filter. One
   * gate, failing closed, is the point.
   */
  const hasAccessToFeature = (actionName: string): boolean => {
    // Gating turned off app-wide from the admin dashboard.
    if (!isPaywallEnabled.value) return true

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

    // A cached Teams plan that merely went stale is not a lapse. getCurrentPlan
    // decays it to 'free' so gates fail closed, but that is us being unable to
    // confirm the plan, not the subscription ending — and telling a paying
    // church it lapsed because the building was offline for a fortnight is a
    // worse error than showing no banner at all.
    if (isPlanCacheStale.value && authStore.church?.subscriptionPlan === 'teams') {
      return false
    }

    return authStore.church?.hadTeamsBefore === true
  })

  /**
   * Get storage limit based on plan
   */
  const getStorageLimit = (): number => {
    if (!isPaywallEnabled.value) return 5000

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
    isPlanKnown,
    isPlanCacheStale,
    isPaywallEnabled,
    requiresTeams,
    hasAccessToFeature,
    getStorageLimit,
    hasLapsedTeamsSubscription,
  }
}
