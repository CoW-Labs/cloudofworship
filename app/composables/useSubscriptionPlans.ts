import { useAuthStore } from '~/store/auth'
import {
  BILLING_CURRENCIES,
  DEFAULT_BILLING_ROUTE,
  formatPrice,
  isBillingCurrency,
  readTestCountry,
  resolveBillingRoute,
  routeForCurrency,
  type BillingCurrency,
  type BillingProvider,
  type BillingRoute,
  type GeoResponse,
} from '~/utils/billing'

export interface SubscriptionPlanFeature {
  feature: string
}

export interface SubscriptionPlan {
  id: string
  alias: string
  planCode: string | null  // Paystack plan code (NGN plans only); null for every other currency
  amount: number           // Main unit (499 = KES 499)
  amountKobo: number | null
  amountCents: number | null
  features: string[]
  currency: BillingCurrency
  interval: 'yearly' | 'monthly'
  discount: string | null
}

export interface SubscriptionPlansResponse {
  message: string
  data: SubscriptionPlan[]
}

/**
 * Composable for fetching subscription plans from the API, and for knowing
 * which provider and currency this church pays with.
 */
export const useSubscriptionPlans = () => {
  // Shared across every caller (the upgrade modal and usePayment use separate
  // instances) so plans fetched once are reused — no refetch before checkout opens.
  const plans = useState<SubscriptionPlan[]>('subscription-plans', () => [])
  const selectedCurrency = useState<BillingCurrency>('subscription-selected-currency', () => 'USD') // Default to USD
  const selectedProvider = useState<BillingProvider>('subscription-selected-provider', () => 'dodo')
  const detectedCurrency = useState<BillingCurrency | null>('subscription-detected-currency', () => null)
  // What the API offers this church: provider, currency, and a card fallback.
  const detectedRoute = useState<BillingRoute | null>('subscription-detected-route', () => null)
  // The church the route was worked out for. The API keeps a church on the
  // provider it already pays through, so a different sign-in asks again.
  const detectedForChurch = useState<string | null>('subscription-detected-for', () => null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isDetectingCurrency = ref(false)

  const authStore = useAuthStore()

  // Allow local testing by setting currency in localStorage
  const getTestCurrency = (): BillingCurrency | null => {
    // Dev builds only: in production this would let anyone pick the NGN price.
    if (process.client && import.meta.dev) {
      try {
        const testCurrency = localStorage.getItem('test_currency')
        if (isBillingCurrency(testCurrency)) {
          return testCurrency
        }
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }
    return null
  }

  const setTestCurrency = (currency: BillingCurrency | null) => {
    if (process.client) {
      try {
        if (currency) {
          localStorage.setItem('test_currency', currency)
        } else {
          localStorage.removeItem('test_currency')
        }
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }
  }

  /**
   * Dev builds only: there is no Cloudflare locally, so `localStorage.test_country`
   * (e.g. "KE") is sent as the `cf-ipcountry` header the API reads.
   */
  const getTestCountryHeaders = (): Record<string, string> => {
    if (process.client && import.meta.dev) {
      try {
        const country = readTestCountry(localStorage.getItem('test_country'))
        if (country) return { 'cf-ipcountry': country }
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }
    return {}
  }

  const applyRoute = (route: BillingRoute) => {
    detectedRoute.value = route
    detectedCurrency.value = route.currency
    selectedCurrency.value = route.currency
    selectedProvider.value = route.provider
  }

  /** Switch checkout to another option the route offers (e.g. the card fallback). */
  const selectOption = (provider: BillingProvider, currency: BillingCurrency) => {
    selectedProvider.value = provider
    selectedCurrency.value = currency
  }

  /**
   * Ask the API which provider and currency to offer, from the caller's
   * country (Cloudflare) and the church's existing subscription.
   * Returns the currency, as before.
   */
  const detectCurrency = async (): Promise<BillingCurrency> => {
    // Check for test currency override first (for local testing)
    const testCurrency = getTestCurrency()
    if (testCurrency) {
      console.log('Using test currency override:', testCurrency)
      applyRoute(routeForCurrency(testCurrency))
      return testCurrency
    }

    const churchId = authStore.church?._id ?? null

    // Already detected in this session, for this church
    if (detectedRoute.value && detectedForChurch.value === churchId) {
      return detectedRoute.value.currency
    }

    // Drop the old 24h localStorage cache: it pinned users to a wrong USD result
    // whenever a geo lookup failed. Detection now runs once per session instead.
    if (process.client) {
      try {
        localStorage.removeItem('detected_currency')
        localStorage.removeItem('detected_currency_time')
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }

    isDetectingCurrency.value = true

    try {
      // The API reads Cloudflare's CF-IPCountry header, which is far more
      // reliable than client-side lookups and can't be altered by the visitor.
      let geo: GeoResponse | null = null
      try {
        const { data } = await useAPIFetch<GeoResponse>('/app-config/geo', {
          key: `billing-geo-${Date.now()}`,
          headers: getTestCountryHeaders(),
        })
        geo = data.value ?? null
      } catch (err) {
        console.warn('Currency detection via API failed:', err)
      }

      // Only when the lookup failed or Cloudflare has no country: browser
      // timezone (Nigeria is Africa/Lagos), so Nigerians aren't pushed onto USD.
      let timeZone: string | undefined
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        // Intl unavailable — keep default USD
      }

      const route = resolveBillingRoute(geo, timeZone)
      applyRoute(route)
      detectedForChurch.value = churchId

      // Track detection
      usePosthogCapture('CURRENCY_AUTO_DETECTED', {
        detectedCurrency: route.currency,
        provider: route.provider,
        hasFallback: !!route.fallback,
        method: geo?.country ? 'cloudflare_ip_country' : 'timezone',
      })

      return route.currency
    } catch (error) {
      console.error('Currency detection failed:', error)
      // Default to USD on error
      applyRoute({ ...DEFAULT_BILLING_ROUTE })
      return DEFAULT_BILLING_ROUTE.currency
    } finally {
      isDetectingCurrency.value = false
    }
  }

  /**
   * Fetch subscription plans from the API
   * @param currency - Optional currency filter
   */
  const fetchPlans = async (currency?: BillingCurrency) => {
    loading.value = true
    error.value = null

    try {
      const queryParams = currency ? `?currency=${currency}` : ''
      const response = await useAPIFetch<SubscriptionPlansResponse>(
        `/billing/plans${queryParams}`,
        {
          method: 'GET',
        }
      )

      if (response?.data?.value?.data) {
        plans.value = response.data.value.data

        // Update selected currency if filter was used
        if (currency) {
          selectedCurrency.value = currency
        }
      }
    } catch (err: any) {
      error.value = err?.message || 'Failed to fetch subscription plans'
      console.error('Error fetching subscription plans:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get plans for a specific currency
   */
  const getPlansByCurrency = (currency: BillingCurrency): SubscriptionPlan[] => {
    return plans.value.filter((plan) => plan.currency === currency)
  }

  /**
   * Get plan by interval (yearly/monthly) for current currency
   */
  const getPlanByInterval = (interval: 'yearly' | 'monthly'): SubscriptionPlan | undefined => {
    return plans.value.find(
      (plan) => plan.interval === interval && plan.currency === selectedCurrency.value
    )
  }

  /**
   * Get plan by interval for specific currency
   */
  const getPlanByIntervalAndCurrency = (
    interval: 'yearly' | 'monthly',
    currency: BillingCurrency
  ): SubscriptionPlan | undefined => {
    return plans.value.find(
      (plan) => plan.interval === interval && plan.currency === currency
    )
  }

  /**
   * Get a plan by its Paystack plan code (NGN plans only)
   */
  const getPlanByPlanCode = (code: string): SubscriptionPlan | undefined => {
    return plans.value.find((plan) => plan.planCode === code)
  }

  /**
   * @deprecated Use getPlanByPlanCode instead
   */
  const getPlanByPaystackCode = getPlanByPlanCode

  /**
   * Get plan by ID
   */
  const getPlanById = (id: string): SubscriptionPlan | undefined => {
    return plans.value.find((plan) => plan.id === id)
  }

  /**
   * The price of a plan in its main unit (USD plans also carry cents).
   */
  const getPlanPrice = (plan: SubscriptionPlan | undefined): number => {
    if (!plan) return 0
    if (plan.currency === 'USD' && plan.amountCents) return plan.amountCents / 100
    return plan.amount
  }

  /**
   * @deprecated Use formatAmount: most currencies have no one-character symbol.
   */
  const getCurrencySymbol = (currency: BillingCurrency): string => {
    try {
      const parts = new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      }).formatToParts(0)
      return parts.find((part) => part.type === 'currency')?.value ?? currency
    } catch {
      return currency
    }
  }

  /**
   * Format amount with currency: $69.99, ₦49,999.99, KES 499, USh 15,500
   */
  const formatAmount = (amount: number, currency: BillingCurrency, options?: { keepDecimals?: boolean }): string =>
    formatPrice(amount, currency, options)

  return {
    plans,
    loading,
    error,
    currencies: BILLING_CURRENCIES,
    selectedCurrency,
    selectedProvider,
    detectedCurrency,
    detectedRoute,
    isDetectingCurrency,
    detectCurrency,
    selectOption,
    fetchPlans,
    getPlansByCurrency,
    getPlanByInterval,
    getPlanByIntervalAndCurrency,
    getPlanByPlanCode,
    getPlanByPaystackCode,
    getPlanById,
    getPlanPrice,
    getCurrencySymbol,
    formatAmount,
    setTestCurrency, // Expose for testing
    getTestCurrency,
  }
}
