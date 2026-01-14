import { useAuthStore } from '~/store/auth'

export type PaymentPlan = 'yearly' | 'monthly'

export interface PaymentConfig {
  plan: PaymentPlan
  currency?: 'NGN' | 'USD'
  onSuccess?: (reference: string) => void
  onCancel?: () => void
  onError?: (error: string) => void
}

export interface PlanDetails {
  code: string
  amount: number
  name: string
  discount?: string
  currency: string
}

/**
 * Composable for handling payment operations with Paystack
 */
export const usePayment = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const loading = ref(false)
  const showSuccessModal = ref(false)
  const successPlanName = ref('')

  // Use the subscription plans composable for all plans data
  const subscriptionPlans = useSubscriptionPlans()

  // Get Paystack public key from runtime config
  const PAYSTACK_PUBLIC_KEY = config.public.PAYSTACK_PUBLIC_KEY as string

  /**
   * Load Paystack inline script
   */
  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (process.client) {
        // Check if script is already loaded
        if ((window as any).PaystackPop) {
          resolve()
          return
        }

        // Load script
        const script = document.createElement('script')
        script.src = 'https://js.paystack.co/v1/inline.js'
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Paystack script'))
        document.head.appendChild(script)
      } else {
        reject(new Error('Not running on client'))
      }
    })
  }

  /**
   * Get plan details by plan type
   */
  const getPlanDetails = async (plan: PaymentPlan, currency: 'NGN' | 'USD' = 'NGN'): Promise<PlanDetails | null> => {
    // Ensure plans are loaded
    if (subscriptionPlans.plans.value.length === 0) {
      await subscriptionPlans.fetchPlans(currency)
    }

    // Find the matching plan using the subscription plans composable
    const backendPlan = subscriptionPlans.getPlanByIntervalAndCurrency(plan, currency)

    if (!backendPlan) {
      console.error(`No plan found for ${plan} in ${currency}`)
      return null
    }

    // For USD, use amountCents if available, otherwise fall back to amount
    const planAmount = currency === 'USD' && backendPlan.amountCents
      ? (backendPlan.amountCents || 0)
      : (backendPlan.amountKobo || 0)

    return {
      code: backendPlan.paystackCode,
      amount: planAmount,
      name: plan === 'yearly' ? 'Yearly' : 'Monthly',
      discount: backendPlan.discount || undefined,
      currency: backendPlan.currency,
    }
  }

  /**
   * Generate unique payment reference
   */
  const generateReference = (userId: string): string => {
    return `cow_${Date.now()}_${userId}`
  }

  /**
   * Initiate Paystack payment
   */
  const initiatePayment = async (config: PaymentConfig) => {
    const { plan, currency = 'NGN', onSuccess, onCancel, onError } = config

    // Validate user authentication
    if (!authStore.user?.email) {
      const error = 'Please log in to upgrade your plan'
      onError?.(error)
      useToast().add({
        icon: 'i-heroicons-exclamation-triangle',
        title: 'Error',
        description: error,
        color: 'red',
      })
      return
    }

    try {
      // Ensure Paystack script is loaded
      await loadPaystackScript()

      // Get plan details from backend using the specified currency
      const planDetails = await getPlanDetails(plan, currency)

      if (!planDetails) {
        throw new Error('Selected plan is not available')
      }

      const reference = generateReference(authStore.user._id)

      // Track payment initiation
      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan,
        planCode: planDetails.code,
        amount: planDetails.amount,
        currency: planDetails.currency,
        discount: planDetails.discount || 'none',
      })

      loading.value = true

      // Initialize Paystack payment
      if (typeof window !== 'undefined' && (window as any).PaystackPop) {
        const nameParts =
          authStore.user.fullname?.trim().split(/\s+/).filter(Boolean) ?? []
        const firstName =
          nameParts[0] ||
          authStore.user.email?.split('@')?.[0] ||
          'User'
        const lastName = nameParts.slice(1).join(' ') || 'User'

        const handler = (window as any).PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: authStore.user.email,
          firstName,
          lastName,
          amount: planDetails.amount * 100,
          currency: planDetails.currency,
          plan: planDetails.code,
          ref: reference,
          metadata: {},
          onClose: function () {
            loading.value = false

            // Track cancellation
            usePosthogCapture('PAYMENT_CANCELLED', {
              plan,
              amount: planDetails.amount,
              currency: planDetails.currency,
            })

            useToast().add({
              icon: 'i-heroicons-information-circle',
              title: 'Payment Cancelled',
              description: 'You can upgrade anytime',
              color: 'gray',
            })

            onCancel?.()
          },
          callback: function (response: any) {
            loading.value = false

            // Track success
            usePosthogCapture('PAYMENT_SUCCESSFUL', {
              plan,
              amount: planDetails.amount,
              currency: planDetails.currency,
              reference: response.reference,
              status: response.status,
            })

            // Show success modal with confetti
            successPlanName.value = planDetails.name
            showSuccessModal.value = true

            onSuccess?.(response.reference)
          },
        })

        handler.openIframe()
      } else {
        throw new Error('Paystack is not available')
      }
    } catch (error: any) {
      loading.value = false
      const errorMessage =
        error.message || 'Payment system is loading. Please try again in a moment.'

      useToast().add({
        icon: 'i-heroicons-exclamation-triangle',
        title: 'Payment Error',
        description: errorMessage,
        color: 'orange',
      })

      onError?.(errorMessage)
    }
  }

  return {
    loading: readonly(loading),
    showSuccessModal,
    successPlanName: readonly(successPlanName),
    // Expose subscription plans data and methods
    plansLoading: subscriptionPlans.loading,
    plansData: subscriptionPlans.plans,
    fetchPlans: subscriptionPlans.fetchPlans,
    getPlanDetails,
    initiatePayment,
    loadPaystackScript,
  }
}
