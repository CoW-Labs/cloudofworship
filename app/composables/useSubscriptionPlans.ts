export interface SubscriptionPlanFeature {
  feature: string
}

export interface SubscriptionPlan {
  id: string
  alias: string
  planCode: string | null  // Paystack plan code (NGN plans only); null for USD/Dodo plans
  amount: number
  amountKobo: number | null
  amountCents: number | null
  features: string[]
  currency: 'NGN' | 'USD'
  interval: 'yearly' | 'monthly'
  discount: string | null
}

export interface SubscriptionPlansResponse {
  message: string
  data: SubscriptionPlan[]
}

/**
 * Composable for fetching subscription plans from the API
 */
export const useSubscriptionPlans = () => {
  // Shared across every caller (the upgrade modal and usePayment use separate
  // instances) so plans fetched once are reused — no refetch before checkout opens.
  const plans = useState<SubscriptionPlan[]>('subscription-plans', () => [])
  const selectedCurrency = useState<'NGN' | 'USD'>('subscription-selected-currency', () => 'USD') // Default to USD
  const detectedCurrency = useState<'NGN' | 'USD' | null>('subscription-detected-currency', () => null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isDetectingCurrency = ref(false)

  // Allow local testing by setting currency in localStorage
  const getTestCurrency = (): 'NGN' | 'USD' | null => {
    if (process.client) {
      try {
        const testCurrency = localStorage.getItem('test_currency')
        if (testCurrency === 'NGN' || testCurrency === 'USD') {
          return testCurrency
        }
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }
    return null
  }

  const setTestCurrency = (currency: 'NGN' | 'USD' | null) => {
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
   * Detect user's currency based on IP/location
   */
  const detectCurrency = async (): Promise<'NGN' | 'USD'> => {
    // Check for test currency override first (for local testing)
    const testCurrency = getTestCurrency()
    if (testCurrency) {
      console.log('Using test currency override:', testCurrency)
      detectedCurrency.value = testCurrency
      selectedCurrency.value = testCurrency
      return testCurrency
    }

    // Check if already detected in this session
    if (detectedCurrency.value) {
      return detectedCurrency.value
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
      // Try multiple detection services for reliability
      // Only Nigeria is billed in NGN (Paystack). Everywhere else pays in USD via Dodo,
      // whose checkout accepts international cards.
      const countriesForNGN = ['NG']

      // Resolve a country code, trying each source until one yields a real answer.
      // A rate-limited/blocked/errored lookup must never count as "not Nigeria".
      const lookups: Array<() => Promise<string | undefined>> = [
        async () => {
          const res = await fetch('https://ipapi.co/json/')
          if (!res.ok) return undefined
          return (await res.json())?.country_code
        },
        async () => {
          const res = await fetch('https://ip-api.com/json/')
          if (!res.ok) return undefined
          return (await res.json())?.countryCode
        },
        async () => {
          const res = await fetch('https://api.country.is/')
          if (!res.ok) return undefined
          return (await res.json())?.country
        },
      ]

      let countryCode: string | undefined
      for (const lookup of lookups) {
        try {
          countryCode = await lookup()
          if (countryCode) break
        } catch (err) {
          console.warn('Currency detection source failed, trying next:', err)
        }
      }

      // Last resort: browser timezone (Nigeria is Africa/Lagos)
      let detectionMethod = 'ip_location'
      if (!countryCode) {
        detectionMethod = 'timezone'
        try {
          if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Africa/Lagos') {
            countryCode = 'NG'
          }
        } catch {
          // Intl unavailable — keep default USD
        }
      }

      const currency: 'NGN' | 'USD' = countryCode && countriesForNGN.includes(countryCode) ? 'NGN' : 'USD'
      detectedCurrency.value = currency
      selectedCurrency.value = currency

      // Track detection
      usePosthogCapture('CURRENCY_AUTO_DETECTED', {
        detectedCurrency: currency,
        method: detectionMethod
      })

      return currency
    } catch (error) {
      console.error('Currency detection failed:', error)
      // Default to USD on error
      const fallbackCurrency = 'USD'
      detectedCurrency.value = fallbackCurrency
      selectedCurrency.value = fallbackCurrency
      return fallbackCurrency
    } finally {
      isDetectingCurrency.value = false
    }
  }

  /**
   * Fetch subscription plans from the API
   * @param currency - Optional currency filter ('NGN' or 'USD')
   */
  const fetchPlans = async (currency?: 'NGN' | 'USD') => {
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
  const getPlansByCurrency = (currency: 'NGN' | 'USD'): SubscriptionPlan[] => {
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
    currency: 'NGN' | 'USD'
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
   * Get currency symbol
   */
  const getCurrencySymbol = (currency: 'NGN' | 'USD'): string => {
    return currency === 'NGN' ? '₦' : '$'
  }

  /**
   * Format amount with currency
   */
  const formatAmount = (amount: number, currency: 'NGN' | 'USD'): string => {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${amount.toLocaleString()}`
  }

  return {
    plans,
    loading,
    error,
    selectedCurrency,
    detectedCurrency,
    isDetectingCurrency,
    detectCurrency,
    fetchPlans,
    getPlansByCurrency,
    getPlanByInterval,
    getPlanByIntervalAndCurrency,
    getPlanByPlanCode,
    getPlanByPaystackCode,
    getPlanById,
    getCurrencySymbol,
    formatAmount,
    setTestCurrency, // Expose for testing
    getTestCurrency,
  }
}
