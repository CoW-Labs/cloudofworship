import { useAuthStore } from '~/store/auth'

export type PaymentPlan = 'yearly' | 'monthly'

export interface PaymentConfig {
  plan: PaymentPlan
  onSuccess?: (reference: string) => void
  onCancel?: () => void
  onError?: (error: string) => void
}

export interface PlanDetails {
  code: string
  amount: number
  name: string
  discount?: string
}

/**
 * Composable for handling payment operations with Paystack
 */
export const usePayment = () => {
  const authStore = useAuthStore()
  const loading = ref(false)
  const showSuccessModal = ref(false)
  const successPlanName = ref('')

  // Pricing in NGN
  const PRICING = {
    yearly: 49999.99, // ₦50,000/year
    monthly: 4999.99, // ₦5,000/month
    yearly_usd: 99999.99, // $69.99/year
    monthly_usd: 9999.99 // $6.99/month
  }

  // Paystack plan codes
  const PLAN_CODES = {
    yearly: 'PLN_6e4bp22j2mue1u3',
    monthly: 'PLN_yah7hgphd0vtmpx',
    yearly_usd: 'PLN_lu1h98z4ure9qsq',
    monthly_usd: 'PLN_oqvb3f5m7bu3wtv'
  }

  // Paystack public key - TODO: Replace with actual key
  const PAYSTACK_PUBLIC_KEY = 'pk_test_7f0eaec4dd1d7f8b495b56de974c9e98fdf43244'

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
  const getPlanDetails = (plan: PaymentPlan): PlanDetails => {
    return {
      code: PLAN_CODES[plan],
      amount: PRICING[plan],
      name: plan === 'yearly' ? 'Yearly' : 'Monthly',
      discount: plan === 'yearly' ? '16%' : undefined,
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
    const { plan, onSuccess, onCancel, onError } = config

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

      const planDetails = getPlanDetails(plan)
      const reference = generateReference(authStore.user._id)

      // Track payment initiation
      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan,
        planCode: planDetails.code,
        amount: planDetails.amount,
        currency: 'NGN',
        discount: planDetails.discount || 'none',
      })

      loading.value = true

      // Initialize Paystack payment
      if (typeof window !== 'undefined' && (window as any).PaystackPop) {
        const handler = (window as any).PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: authStore.user.email,
          firstName: authStore.user.fullname?.split(' ')?.at(0),
          lastName: authStore.user.fullname?.split(' ')?.at(1),
          amount: planDetails.amount * 100,
          currency: 'NGN',
          plan: planDetails.code,
          ref: reference,
          metadata: {
            user_id: authStore.user._id
          },
          onClose: function () {
            loading.value = false

            // Track cancellation
            usePosthogCapture('PAYMENT_CANCELLED', {
              plan,
              amount: planDetails.amount,
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
    PRICING,
    PLAN_CODES,
    getPlanDetails,
    initiatePayment,
    loadPaystackScript,
  }
}
