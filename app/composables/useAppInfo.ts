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

  // Promo card shown under the quick-search filter chips. Entirely
  // server-driven — no config from the backend means no card.
  const quickSearchPromo = computed<AppInfoQuickSearchPromo | undefined>(
    () => appInfo.value?.quickSearchPromo
  )

  return { appInfo, setAppInfo, fetchAppInfo, quickSearchPromo }
}
