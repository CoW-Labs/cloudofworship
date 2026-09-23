export interface AppInfoQuickSearchPromo {
  enabled?: boolean
  badge?: string
  title?: string
  description?: string
  action?: string
}

export interface AppInfo {
  appVersion?: string
  bibleVersions?: any[]
  notifications?: any[]
  quickSearchPromo?: AppInfoQuickSearchPromo
  /**
   * App-wide Teams gating kill switch, owned by the API (`PaywallConfig`).
   * Only an explicit `false` turns gating off — see `isPaywallEnabled`.
   */
  paywallEnabled?: boolean
}

const CACHE_KEY = "cow-app-info"

/**
 * Server-driven app configuration from `/app-config/info`.
 *
 * Shared via useState so any component can read it without refetching, and
 * mirrored to localStorage so a cold start (or an offline launch, where the
 * Phase 2 fetch never runs) still renders the last known configuration
 * instead of flashing empty UI.
 */
export const useAppInfo = () => {
  const appInfo = useState<AppInfo | undefined>("app-info", () => {
    if (!import.meta.client) return undefined
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? (JSON.parse(cached) as AppInfo) : undefined
    } catch {
      // localStorage unavailable or cache corrupted — fall back to the fetch
      return undefined
    }
  })

  const setAppInfo = (info: AppInfo) => {
    appInfo.value = info
    if (!import.meta.client) return
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(info))
    } catch {
      // Quota or private mode — the in-memory value is still good for this session
    }
  }

  const fetchAppInfo = async () => {
    const { data } = await useAPIFetch("/app-config/info")
    if (data.value) {
      setAppInfo(data.value as AppInfo)
    }
    return appInfo.value
  }

  /**
   * Whether Teams gating applies at all. The emergency lever for "billing is
   * wrong, stop blocking paying churches", flipped from the admin dashboard.
   *
   * Defaults to ON for every uncertain state: never fetched, fetched before
   * this field existed, offline cold start with an older cached payload, or a
   * response that came back without it. Only a literal `false` disables the
   * paywall.
   *
   * This used to be the PostHog `teams` flag. It is not a flag any more, on
   * purpose: flag SDKs return their default when they cannot reach their
   * backend, so an operator who was offline, or behind a filter that blocked
   * the SDK, silently got the whole paid tier. Config that decides entitlement
   * has to fail closed, so it is served from our own API and cached with the
   * rest of the app config.
   */
  const isPaywallEnabled = computed(() => appInfo.value?.paywallEnabled !== false)

  // Promo card shown under the quick-search filter chips. Entirely
  // server-driven — no config from the backend means no card.
  const quickSearchPromo = computed<AppInfoQuickSearchPromo | undefined>(
    () => appInfo.value?.quickSearchPromo
  )

  return { appInfo, setAppInfo, fetchAppInfo, quickSearchPromo, isPaywallEnabled }
}
