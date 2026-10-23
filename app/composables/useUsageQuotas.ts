import { useAuthStore } from '~/store/auth'

export interface UsageQuotas {
  plan: 'free' | 'teams'
  /** Library songs added this month. `limit: null` = not metered. */
  songs: { used: number; limit: number | null; resetsAt: string | null }
  transcription: {
    period: 'lifetime' | 'week'
    usedSeconds: number
    limitSeconds: number
    remainingSeconds: number
  }
  /** Livestream sessions (schedule × day with a viewer), ever. */
  livestream: { used: number; limit: number | null }
}

let inFlight: Promise<void> | null = null

/**
 * The free-tier allowances from `GET /church/:churchId/usage`, for showing a
 * free church what it has left. Shared app-wide through useState, so a claim
 * in one panel updates the count in every other.
 *
 * Display only. Each allowance is enforced by the API where it is spent (song
 * claim, transcription stream, livestream socket), and the 14-day plan cache in
 * useSubscription means the client cannot be trusted with it anyway.
 *
 * Teams churches never fetch: none of this is metered for them, and the
 * transcription panel reads its own weekly usage.
 */
export default function useUsageQuotas() {
  const authStore = useAuthStore()
  const { isFreePlan, isPaywallEnabled } = useSubscription()

  const usage = useState<UsageQuotas | null>('usage-quotas', () => null)
  const loading = useState<boolean>('usage-quotas-loading', () => false)

  const isMetered = computed(() => isFreePlan.value && isPaywallEnabled.value)

  const refresh = () => {
    const churchId = authStore.user?.churchId
    if (!churchId || !isMetered.value) return Promise.resolve()
    // Every AppSection asks on mount, so callers share one request.
    if (inFlight) return inFlight
    loading.value = true
    inFlight = (async () => {
      try {
        const { data, error } = await useAPIFetch(`/church/${churchId}/usage`, {
          key: `usage-quotas-${Date.now()}`,
        })
        if (!error.value && data.value) usage.value = data.value as UsageQuotas
      } catch (err) {
        console.error('Failed to fetch usage quotas:', err)
      } finally {
        loading.value = false
        inFlight = null
      }
    })()
    return inFlight
  }

  const left = (used?: number, limit?: number | null) =>
    limit == null || used == null ? null : Math.max(0, limit - used)

  /** null while unknown or unmetered. */
  const songsLeft = computed(() =>
    isMetered.value ? left(usage.value?.songs.used, usage.value?.songs.limit) : null
  )
  const songsLimit = computed(() => usage.value?.songs.limit ?? null)

  const livestreamSessionsLeft = computed(() =>
    isMetered.value
      ? left(usage.value?.livestream.used, usage.value?.livestream.limit)
      : null
  )
  const livestreamSessionsLimit = computed(
    () => usage.value?.livestream.limit ?? null
  )

  /** Bumps the song count after a successful claim, without a round trip. */
  const setSongsUsed = (used: number) => {
    if (usage.value) usage.value = { ...usage.value, songs: { ...usage.value.songs, used } }
  }

  return {
    usage,
    loading,
    isMetered,
    refresh,
    songsLeft,
    songsLimit,
    livestreamSessionsLeft,
    livestreamSessionsLimit,
    setSongsUsed,
  }
}
