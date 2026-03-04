import { useAuthStore } from '~/store/auth'
import { DodoPayments } from 'dodopayments-checkout'

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
 * Composable for handling payment operations.
 * - NGN payments → Paystack inline checkout
 * - USD payments → Dodo Payments overlay checkout (initialize + confirm via backend)
 */
export const usePayment = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const loading = ref(false)
  const showSuccessModal = ref(false)
  const successPlanName = ref('')

  const subscriptionPlans = useSubscriptionPlans()

  const PAYSTACK_PUBLIC_KEY = config.public.PAYSTACK_PUBLIC_KEY as string
  const isProduction = config.public.NODE_ENV === 'production'

  // ─── Dodo Payments ───────────────────────────────────────────────────────────

  /**
   * Open the Dodo overlay checkout for a USD plan.
   * Calls the backend to initialize the checkout session and returns a checkoutUrl.
   */
  const initiateDodoPayment = async (config: PaymentConfig) => {
    const { plan, currency = 'USD', onSuccess, onCancel, onError } = config

    if (!authStore.user?.email) {
      const error = 'Please log in to upgrade your plan'
      onError?.(error)
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Error', description: error, color: 'red' })
      return
    }

    try {
      loading.value = true

      if (subscriptionPlans.plans.value.length === 0) {
        await subscriptionPlans.fetchPlans(currency)
      }

      const backendPlan = subscriptionPlans.getPlanByIntervalAndCurrency(plan, currency)
      if (!backendPlan) throw new Error('Selected plan is not available')

      const planDetails: PlanDetails = {
        code: backendPlan.alias,
        amount: backendPlan.amountCents || 0,
        name: plan === 'yearly' ? 'Yearly' : 'Monthly',
        discount: backendPlan.discount || undefined,
        currency: backendPlan.currency,
      }

      // Track payment initiation
      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan,
        planCode: planDetails.code,
        amount: planDetails.amount,
        currency: planDetails.currency,
        discount: planDetails.discount || 'none',
        provider: 'dodo',
      })
      const { trackPaymentInitiated } = useSendEvent()
      trackPaymentInitiated(planDetails.code, planDetails.amount, planDetails.currency)

      // Initialize checkout session on the backend
      const { data: sessionData, error: sessionError } = await useAPIFetch<{ message: string; data: { checkoutUrl: string; sessionId: string } }>('/billing/initialize', {
        method: 'POST',
        body: { planAlias: backendPlan.alias, provider: 'dodo' },
        key: 'dodo-checkout-init',
      })

      if (sessionError.value) {
        throw new Error(sessionError.value?.data?.message || sessionError.value?.message || 'Failed to initialize payment session.')
      }

      const checkoutUrl = sessionData.value?.data?.checkoutUrl
      const sessionId = sessionData.value?.data?.sessionId
      if (!checkoutUrl || !sessionId) throw new Error('Failed to initialize payment session. Please try again.')

      // Initialise SDK and open overlay
      DodoPayments.Initialize({
        mode: isProduction ? 'live' : 'test',
        displayType: 'overlay',
        onEvent: async (event: any) => {
          switch (event.event_type) {
            case 'checkout.opened':
              loading.value = false
              break

            case 'checkout.closed':
              loading.value = false
              usePosthogCapture('PAYMENT_CANCELLED', { plan, amount: planDetails.amount, currency: planDetails.currency })
              const { trackPaymentCancelled } = useSendEvent()
              trackPaymentCancelled(planDetails.code, 'User closed Dodo payment overlay')
              useToast().add({ icon: 'i-heroicons-information-circle', title: 'Payment Cancelled', description: 'You can upgrade anytime', color: 'gray' })
              onCancel?.()
              break

            case 'checkout.redirect_requested': {
              const redirectUrl = event.data?.message?.redirect_to as string | undefined
              if (redirectUrl) window.location.href = redirectUrl
              break
            }

            case 'checkout.status': {
              const status = event.data?.message?.status as 'succeeded' | 'failed' | 'processing' | undefined
              if (status === 'succeeded') {
                DodoPayments.Checkout.close()
                usePosthogCapture('PAYMENT_SUCCESSFUL', { plan, amount: planDetails.amount, currency: planDetails.currency, provider: 'dodo' })

                // Confirm subscription with backend and refresh church state immediately
                try {
                  const { data: confirmData } = await useAPIFetch<{ message: string; data: { status: string } }>('/billing/confirm', {
                    method: 'POST',
                    body: { sessionId },
                    key: `dodo-confirm-${sessionId}`,
                  })
                  if (confirmData.value?.data?.status === 'active') {
                    if (authStore.church) {
                      authStore.setChurch({ ...authStore.church, subscriptionPlan: 'teams' })
                    }
                    authStore.clearSubscriptionDetails()
                  }
                } catch (confirmErr) {
                  console.error('Failed to confirm Dodo subscription:', confirmErr)
                  // Webhook will still activate — don't block success modal
                }

                successPlanName.value = planDetails.name
                showSuccessModal.value = true
                onSuccess?.('dodo_payment_succeeded')
              } else if (status === 'failed') {
                loading.value = false
                const errMsg = 'Payment failed. Please try a different card or contact support.'
                useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Failed', description: errMsg, color: 'red' })
                onError?.(errMsg)
              }
              break
            }

            case 'checkout.error': {
              loading.value = false
              const errMsg = (event.data?.message as string) || 'An error occurred during checkout.'
              useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errMsg, color: 'orange' })
              onError?.(errMsg)
              break
            }

            case 'checkout.link_expired': {
              loading.value = false
              const expiredMsg = 'Checkout session expired. Please try again.'
              useToast().add({ icon: 'i-heroicons-clock', title: 'Session Expired', description: expiredMsg, color: 'amber' })
              onError?.(expiredMsg)
              break
            }
          }
        },
      })

      await DodoPayments.Checkout.open({
        checkoutUrl,
        options: { manualRedirect: true },
      })
    } catch (error: any) {
      loading.value = false
      const errorMessage = error.message || 'Payment system is unavailable. Please try again.'
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errorMessage, color: 'orange' })
      onError?.(errorMessage)
    }
  }

  // ─── Paystack ────────────────────────────────────────────────────────────────

  /**
   * Load Paystack inline script
   */
  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (process.client) {
        if ((window as any).PaystackPop) {
          resolve()
          return
        }
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
   * Get plan details by plan type (used by Paystack / NGN flow)
   */
  const getPlanDetails = async (plan: PaymentPlan, currency: 'NGN' | 'USD' = 'NGN'): Promise<PlanDetails | null> => {
    if (subscriptionPlans.plans.value.length === 0) {
      await subscriptionPlans.fetchPlans(currency)
    }
    const backendPlan = subscriptionPlans.getPlanByIntervalAndCurrency(plan, currency)
    if (!backendPlan) {
      console.error(`No plan found for ${plan} in ${currency}`)
      return null
    }
    return {
      code: backendPlan.planCode || '',
      amount: backendPlan.amountKobo || 0,
      name: plan === 'yearly' ? 'Yearly' : 'Monthly',
      discount: backendPlan.discount || undefined,
      currency: backendPlan.currency,
    }
  }

  const generateReference = (userId: string): string => `cow_${Date.now()}_${userId}`

  /**
   * Initiate Paystack payment (NGN)
   */
  const initiatePaystackPayment = async (config: PaymentConfig) => {
    const { plan, currency = 'NGN', onSuccess, onCancel, onError } = config

    if (!authStore.user?.email) {
      const error = 'Please log in to upgrade your plan'
      onError?.(error)
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Error', description: error, color: 'red' })
      return
    }

    try {
      await loadPaystackScript()

      const planDetails = await getPlanDetails(plan, currency)
      if (!planDetails) throw new Error('Selected plan is not available')

      const reference = generateReference(authStore.user._id)

      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan, planCode: planDetails.code, amount: planDetails.amount,
        currency: planDetails.currency, discount: planDetails.discount || 'none', provider: 'paystack',
      })
      const { trackPaymentInitiated } = useSendEvent()
      trackPaymentInitiated(planDetails.code, planDetails.amount, planDetails.currency)

      loading.value = true

      if (typeof window !== 'undefined' && (window as any).PaystackPop) {
        const nameParts = authStore.user.fullname?.trim().split(/\s+/).filter(Boolean) ?? []
        const firstName = nameParts[0] || authStore.user.email?.split('@')?.[0] || 'User'
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
            usePosthogCapture('PAYMENT_CANCELLED', { plan, amount: planDetails.amount, currency: planDetails.currency })
            const { trackPaymentCancelled } = useSendEvent()
            trackPaymentCancelled(planDetails.code, 'User closed payment modal')
            useToast().add({ icon: 'i-heroicons-information-circle', title: 'Payment Cancelled', description: 'You can upgrade anytime', color: 'gray' })
            onCancel?.()
          },
          callback: function (response: any) {
            loading.value = false
            usePosthogCapture('PAYMENT_SUCCESSFUL', {
              plan, amount: planDetails.amount, currency: planDetails.currency,
              reference: response.reference, status: response.status, provider: 'paystack',
            })
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
      const errorMessage = error.message || 'Payment system is loading. Please try again in a moment.'
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errorMessage, color: 'orange' })
      onError?.(errorMessage)
    }
  }

  // ─── Unified entry point ─────────────────────────────────────────────────────

  /**
   * Initiate payment — routes to Dodo (USD) or Paystack (NGN) automatically.
   */
  const initiatePayment = (config: PaymentConfig) => {
    if (config.currency === 'USD') return initiateDodoPayment(config)
    return initiatePaystackPayment(config)
  }

  return {
    loading: readonly(loading),
    showSuccessModal,
    successPlanName: readonly(successPlanName),
    plansLoading: subscriptionPlans.loading,
    plansData: subscriptionPlans.plans,
    fetchPlans: subscriptionPlans.fetchPlans,
    getPlanDetails,
    initiatePayment,
    loadPaystackScript,
  }
}
