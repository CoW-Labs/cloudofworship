export interface SubscriptionPlanFeature {
  feature: string
}

export interface SubscriptionPlan {
  id: string
  alias: string
  planCode: string      // Unified plan code — used for Paystack (NGN), Dodo (USD)
  paystackCode: string  // @deprecated — use planCode instead
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
  const plans = ref<SubscriptionPlan[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedCurrency = ref<'NGN' | 'USD'>('USD') // Default to USD
  const detectedCurrency = ref<'NGN' | 'USD' | null>(null)
  const isDetectingCurrency = ref(false)

  // Allow local testing by setting currency in localStorage
  const getTestCurrency = (): 'NGN' | 'USD' | null => {
    if (process.client) {
      const testCurrency = localStorage.getItem('test_currency')
      if (testCurrency === 'NGN' || testCurrency === 'USD') {
        return testCurrency
      }
    }
    return null
  }

  const setTestCurrency = (currency: 'NGN' | 'USD' | null) => {
    if (process.client) {
      if (currency) {
        localStorage.setItem('test_currency', currency)
      } else {
        localStorage.removeItem('test_currency')
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

    // Check localStorage for cached currency
    if (process.client) {
      const cached = localStorage.getItem('detected_currency')
      const cacheTime = localStorage.getItem('detected_currency_time')

      // Cache for 24 hours
      if (cached && cacheTime) {
        const hoursSinceCache = (Date.now() - parseInt(cacheTime)) / (1000 * 60 * 60)
        if (hoursSinceCache < 24 && (cached === 'NGN' || cached === 'USD')) {
          detectedCurrency.value = cached as 'NGN' | 'USD'
          selectedCurrency.value = detectedCurrency.value
          return detectedCurrency.value
        }
      }
    }

    isDetectingCurrency.value = true

    try {
      // Try multiple detection services for reliability
      let currency: 'NGN' | 'USD' = 'USD' // Default fallback

      // African countries (excluding South Africa) that should use NGN
      const africanCountriesForNGN = [
        'NG', 'GH', 'KE',
        // 'TZ', 'UG', 'RW', 'ET', 'EG', 'DZ', 'MA',
        // 'TN', 'LY', 'SD', 'SS', 'SO', 'DJ', 'ER', 'SN', 'ML', 'BF',
        // 'NE', 'TD', 'MR', 'GM', 'GW', 'SL', 'LR', 'CI', 'BJ', 'TG',
        // 'CM', 'CF', 'GQ', 'GA', 'CG', 'CD', 'AO', 'ZM', 'ZW', 'MW',
        // 'MZ', 'MG', 'MU', 'SC', 'KM', 'BW', 'NA', 'LS', 'SZ', 'BI'
      ]

      try {
        // Try ipapi.co first (free, reliable)
        const response = await fetch('https://ipapi.co/json/')
        const data = await response.json()

        // Check if user is in African countries (except South Africa)
        if (africanCountriesForNGN.includes(data.country_code)) {
          currency = 'NGN'
        } else {
          currency = 'USD'
        }
      } catch (err) {
        console.warn('Primary currency detection failed, trying fallback:', err)

        try {
          // Fallback to ip-api.com
          const response = await fetch('https://ip-api.com/json/')
          const data = await response.json()

          if (africanCountriesForNGN.includes(data.countryCode)) {
            currency = 'NGN'
          } else {
            currency = 'USD'
          }
        } catch (fallbackErr) {
          console.warn('Fallback currency detection failed, using default USD:', fallbackErr)
          // Keep default USD
        }
      }

      // Cache the detected currency
      if (process.client) {
        localStorage.setItem('detected_currency', currency)
        localStorage.setItem('detected_currency_time', Date.now().toString())
      }

      detectedCurrency.value = currency
      selectedCurrency.value = currency

      // Track detection
      usePosthogCapture('CURRENCY_AUTO_DETECTED', {
        detectedCurrency: currency,
        method: 'ip_location'
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
        `/subscriptions/plans${queryParams}`,
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
   * Get plan by plan code (works for both Paystack NGN and Dodo USD)
   */
  const getPlanByPlanCode = (code: string): SubscriptionPlan | undefined => {
    return plans.value.find((plan) => plan.planCode === code || plan.paystackCode === code)
  }

  /**
   * Get plan by Paystack code
   * @deprecated Use getPlanByPlanCode instead
   */
  const getPlanByPaystackCode = (code: string): SubscriptionPlan | undefined => {
    return plans.value.find((plan) => plan.planCode === code || plan.paystackCode === code)
  }

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
