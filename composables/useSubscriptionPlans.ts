export interface SubscriptionPlanFeature {
  feature: string
}

export interface SubscriptionPlan {
  id: string
  alias: string
  paystackCode: string
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

  /**
   * Detect user's currency based on IP/location
   */
  const detectCurrency = async (): Promise<'NGN' | 'USD'> => {
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

      try {
        // Try ipapi.co first (free, reliable)
        const response = await fetch('https://ipapi.co/json/')
        const data = await response.json()

        // Check if user is in Nigeria
        if (data.country_code === 'NG' || data.country === 'Nigeria') {
          currency = 'NGN'
        } else {
          currency = 'USD'
        }
      } catch (err) {
        console.warn('Primary currency detection failed, trying fallback:', err)

        try {
          // Fallback to ip-api.com
          const response = await fetch('http://ip-api.com/json/')
          const data = await response.json()

          if (data.countryCode === 'NG' || data.country === 'Nigeria') {
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
   * Get plan by Paystack code
   */
  const getPlanByPaystackCode = (code: string): SubscriptionPlan | undefined => {
    return plans.value.find((plan) => plan.paystackCode === code)
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
    getPlanByPaystackCode,
    getPlanById,
    getCurrencySymbol,
    formatAmount,
  }
}
