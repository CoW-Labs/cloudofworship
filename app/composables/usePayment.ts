import { useAuthStore } from '~/store/auth'
import { DodoPayments } from 'dodopayments-checkout'
import type { Bachs, BachsCheckoutEvent } from '@bachs/js'
import { bachsCheckoutOrigin, isBillingCurrency, providerForCurrency, type BillingCurrency, type BillingProvider } from '~/utils/billing'

export type PaymentPlan = 'yearly' | 'monthly'

// Lazily load the Paystack SDK once and share the promise across all callers,
// so the checkout opens instantly on click and isn't bundled into the initial app load.
let paystackSdk: Promise<any> | null = null
const loadPaystack = (): Promise<any> => {
  if (!paystackSdk) {
    paystackSdk = import('@paystack/inline-js').then((m) => m.default)
  }
  return paystackSdk
}

// Same for bachs.js, the Bachs overlay. A failed load is forgotten so the next
// click tries again.
let bachsSdk: Promise<Bachs> | null = null
const loadBachsSdk = (): Promise<Bachs> => {
  if (!bachsSdk) {
    bachsSdk = import('@bachs/js')
      .then((m) => m.loadBachs())
      .catch((error) => {
        bachsSdk = null
        throw error
      })
  }
  return bachsSdk
}

// Mobile money settles a few seconds after the customer approves on their
// phone, so a "pending" confirm is asked again on this cadence.
const BACHS_CONFIRM_INTERVAL_MS = 3000
const BACHS_CONFIRM_ATTEMPTS = 20

export interface PaymentConfig {
  plan: PaymentPlan
  // Who collects the payment. Defaults from the currency when left out.
  provider?: BillingProvider
  currency?: BillingCurrency
  onSuccess?: (reference: string) => void
  // Paid, but the money hasn't settled yet. The webhook turns Teams on.
  onPending?: (reference: string) => void
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
 * - Mobile money (KES, GHS, …) → Bachs overlay checkout (initialize + confirm via backend)
 */
export const usePayment = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const loading = ref(false)
  const showSuccessModal = ref(false)
  const successPlanName = ref('')
  // Bachs: paid in the overlay, waiting for the mobile money to settle.
  const awaitingConfirmation = ref(false)

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
      const { data: sessionData, error: sessionError } = await useAPIFetch<{ message: string; data: { checkoutUrl: string; checkoutReference: string } }>('/billing/initialize', {
        method: 'POST',
        body: { planAlias: backendPlan.alias, provider: 'dodo' },
        key: `dodo-checkout-init-${new Date().getTime()}`, // prevent caching
      })

      if (sessionError.value) {
        throw new Error(sessionError.value?.data?.message || sessionError.value?.message || 'Failed to initialize payment session.')
      }

      const checkoutUrl = sessionData.value?.data?.checkoutUrl
      const checkoutReference = sessionData.value?.data?.checkoutReference
      if (!checkoutUrl || !checkoutReference) throw new Error('Failed to initialize payment session. Please try again.')

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
                    body: { provider: 'dodo', checkoutReference },
                    key: `dodo-confirm-${checkoutReference}`,
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

      DodoPayments.Checkout.open({
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

  // ─── Bachs (mobile money) ────────────────────────────────────────────────────

  /**
   * Ask the API whether a Bachs checkout has been paid, until it says
   * "active" or we run out of attempts. 202 means not settled yet.
   */
  const confirmBachsCheckout = async (
    checkoutReference: string,
    attempts = BACHS_CONFIRM_ATTEMPTS
  ): Promise<'active' | 'pending'> => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const { data, error } = await useAPIFetch<{ message: string; data: { status: string } }>('/billing/confirm', {
          method: 'POST',
          body: { provider: 'bachs', checkoutReference },
          key: `bachs-confirm-${checkoutReference}-${attempt}`,
        })
        if (data.value?.data?.status === 'active') return 'active'
        // A 4xx won't change on retry; the webhook still activates a real payment.
        const status = (error.value as any)?.statusCode ?? (error.value as any)?.status
        if (status >= 400 && status < 500) return 'pending'
      } catch (err) {
        console.error('Failed to confirm Bachs checkout:', err)
      }
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, BACHS_CONFIRM_INTERVAL_MS))
      }
    }
    return 'pending'
  }

  /**
   * Open the Bachs overlay for a mobile-money plan (KES, GHS, UGX, …).
   * The API creates the checkout; the overlay takes the payment; /billing/confirm
   * (or the webhook, if the customer closes the app) turns Teams on.
   */
  const initiateBachsPayment = async (config: PaymentConfig) => {
    const { plan, currency, onSuccess, onPending, onCancel, onError } = config

    if (!authStore.user?.email) {
      const error = 'Please log in to upgrade your plan'
      onError?.(error)
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Error', description: error, color: 'red' })
      return
    }

    // useAPIFetch queues offline POSTs and replays them later: a checkout must
    // never be created long after the customer gave up.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const error = 'Reconnect to the internet to pay.'
      onError?.(error)
      useToast().add({ icon: 'i-bx-wifi-off', title: "You're offline", description: error, color: 'red' })
      return
    }

    if (!currency || currency === 'NGN' || currency === 'USD') {
      const error = 'Mobile money is not available for this currency.'
      onError?.(error)
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: error, color: 'orange' })
      return
    }

    loading.value = true

    try {
      if (!subscriptionPlans.getPlanByIntervalAndCurrency(plan, currency)) {
        await subscriptionPlans.fetchPlans()
      }
      const backendPlan = subscriptionPlans.getPlanByIntervalAndCurrency(plan, currency)
      if (!backendPlan) throw new Error('Selected plan is not available')

      const planDetails: PlanDetails = {
        code: backendPlan.alias,
        amount: backendPlan.amount,
        name: plan === 'yearly' ? 'Yearly' : 'Monthly',
        discount: backendPlan.discount || undefined,
        currency: backendPlan.currency,
      }

      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan,
        planCode: planDetails.code,
        amount: planDetails.amount,
        currency: planDetails.currency,
        discount: planDetails.discount || 'none',
        provider: 'bachs',
      })
      const { trackPaymentInitiated, trackPaymentCancelled } = useSendEvent()
      trackPaymentInitiated(planDetails.code, planDetails.amount, planDetails.currency)

      // SDK load and checkout creation are independent — run them together.
      const [Bachs, session] = await Promise.all([
        loadBachsSdk(),
        useAPIFetch<{ message: string; data: { checkoutUrl: string; checkoutReference: string } }>('/billing/initialize', {
          method: 'POST',
          body: { planAlias: backendPlan.alias, provider: 'bachs' },
          key: `bachs-checkout-init-${Date.now()}`, // prevent caching
        }),
      ])

      if (session.error.value) {
        const err = session.error.value as any
        throw new Error(err?.data?.message || err?.message || 'Failed to initialize payment session.')
      }

      const checkoutUrl = session.data.value?.data?.checkoutUrl
      const checkoutReference = session.data.value?.data?.checkoutReference
      if (!checkoutUrl || !checkoutReference) throw new Error('Failed to initialize payment session. Please try again.')

      // The SDK only opens checkouts on its configured origin, live by
      // default. A sandbox session lives on the sandbox checkout, so point it
      // there — but only ever at a Bachs checkout host.
      const checkoutOrigin = bachsCheckoutOrigin(checkoutUrl)
      if (!checkoutOrigin) throw new Error('Unexpected checkout address. Please try again.')
      Bachs.Initialize({ baseUrl: checkoutOrigin })

      // Once paid or expired, the closing overlay is not a cancellation.
      let finished = false

      const activate = () => {
        if (authStore.church) {
          authStore.setChurch({ ...authStore.church, subscriptionPlan: 'teams' })
        }
        authStore.clearSubscriptionDetails()
        successPlanName.value = planDetails.name
        showSuccessModal.value = true
        onSuccess?.(checkoutReference)
      }

      const handlePaid = async () => {
        usePosthogCapture('PAYMENT_SUCCESSFUL', {
          plan, amount: planDetails.amount, currency: planDetails.currency, provider: 'bachs',
        })

        awaitingConfirmation.value = true
        const status = await confirmBachsCheckout(checkoutReference)
        awaitingConfirmation.value = false
        loading.value = false

        if (status === 'active') {
          activate()
          return
        }

        // Not settled within a minute. The webhook activates it when it lands,
        // so don't invite a second payment.
        usePosthogCapture('PAYMENT_PENDING', { plan, currency: planDetails.currency, provider: 'bachs' })
        useToast().add({
          icon: 'i-heroicons-clock',
          title: 'Payment received, waiting for confirmation',
          description: "We'll turn on Teams as soon as your mobile money payment arrives. You can close this.",
          color: 'amber',
          timeout: 0,
        })
        onPending?.(checkoutReference)
      }

      // Closed before the overlay reported success. They may have approved on
      // their phone and closed it straight away, so ask once before calling it
      // a cancellation.
      const handleClosed = async () => {
        loading.value = true
        const status = await confirmBachsCheckout(checkoutReference, 1)
        loading.value = false
        if (status === 'active') {
          usePosthogCapture('PAYMENT_SUCCESSFUL', {
            plan, amount: planDetails.amount, currency: planDetails.currency, provider: 'bachs',
          })
          activate()
          return
        }
        usePosthogCapture('PAYMENT_CANCELLED', { plan, amount: planDetails.amount, currency: planDetails.currency, provider: 'bachs' })
        trackPaymentCancelled(planDetails.code, 'User closed Bachs payment overlay')
        useToast().add({
          icon: 'i-heroicons-information-circle',
          title: 'Payment Cancelled',
          description: 'If you approved the payment on your phone, Teams turns on as soon as it arrives.',
          color: 'gray',
        })
        onCancel?.()
      }

      const handleEvent = (event: BachsCheckoutEvent) => {
        switch (event.type) {
          case 'checkout.ready':
            loading.value = false
            break

          case 'checkout.completed':
            // Keep the spinner on while we confirm; the overlay closes itself.
            finished = true
            loading.value = true
            void handlePaid()
            break

          case 'checkout.failed':
            // The overlay stays open, so the customer can try again in it.
            useToast().add({
              icon: 'i-heroicons-exclamation-triangle',
              title: 'Payment Failed',
              description: "The payment didn't go through. Try again, or use another number or method.",
              color: 'red',
            })
            break

          case 'checkout.expired': {
            finished = true
            loading.value = false
            const expiredMsg = 'Checkout session expired. Please try again.'
            useToast().add({ icon: 'i-heroicons-clock', title: 'Session Expired', description: expiredMsg, color: 'amber' })
            onError?.(expiredMsg)
            break
          }

          case 'checkout.closed':
            if (finished) break
            finished = true
            void handleClosed()
            break

          case 'checkout.error': {
            loading.value = false
            const errMsg = (event.data?.message as string) || 'An error occurred during checkout.'
            console.error('Bachs checkout error:', errMsg)
            useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errMsg, color: 'orange' })
            onError?.(errMsg)
            break
          }
        }
      }

      await Bachs.Checkout.open({ checkoutUrl, onEvent: handleEvent })
    } catch (error: any) {
      loading.value = false
      awaitingConfirmation.value = false
      const errorMessage = error.message || 'Payment system is unavailable. Please try again.'
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errorMessage, color: 'orange' })
      onError?.(errorMessage)
    }
  }

  // ─── Paystack ────────────────────────────────────────────────────────────────

  /**
   * Warm the Paystack SDK ahead of time (e.g. when the upgrade modal mounts),
   * so the first checkout click opens with no load delay.
   */
  const preloadPaystack = (): Promise<any> => loadPaystack()

  /**
   * Get plan details by plan type (used by Paystack / NGN flow)
   */
  const getPlanDetails = async (plan: PaymentPlan, currency: BillingCurrency = 'NGN'): Promise<PlanDetails | null> => {
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
      amount: backendPlan.amount || 0,
      name: plan === 'yearly' ? 'Yearly' : 'Monthly',
      discount: backendPlan.discount || undefined,
      currency: backendPlan.currency,
    }
  }


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

    // Spinner shows from the first click — covers SDK load + plan fetch + iframe render.
    loading.value = true

    try {
      // SDK load and plan lookup are independent — run them together.
      const [PaystackPop, planDetails] = await Promise.all([
        loadPaystack(),
        getPlanDetails(plan, currency),
      ])
      if (!planDetails) throw new Error('Selected plan is not available')

      const reference = `cow_${Date.now()}_${authStore.user._id}`

      usePosthogCapture('UPGRADE_BUTTON_CLICKED', {
        plan, planCode: planDetails.code, amount: planDetails.amount,
        currency: planDetails.currency, discount: planDetails.discount || 'none', provider: 'paystack',
      })
      const { trackPaymentInitiated, trackPaymentCancelled } = useSendEvent()
      trackPaymentInitiated(planDetails.code, planDetails.amount, planDetails.currency)

      const nameParts = authStore.user.fullname?.trim().split(/\s+/).filter(Boolean) ?? []
      const firstName = nameParts[0] || authStore.user.email?.split('@')?.[0] || 'User'
      const lastName = nameParts.slice(1).join(' ') || 'User'

      // Watchdog: if the checkout iframe never signals it loaded, recover instead of
      // leaving the user staring at a blank full-screen overlay indefinitely.
      let settled = false
      const watchdog = setTimeout(() => {
        if (settled) return
        settled = true
        loading.value = false
        const msg = 'Checkout is taking too long to load. Please check your connection and try again.'
        useToast().add({ icon: 'i-heroicons-clock', title: 'Checkout Timed Out', description: msg, color: 'amber' })
        onError?.(msg)
      }, 15000)

      const popup = new PaystackPop()
      popup.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: authStore.user.email,
        firstName,
        lastName,
        amount: planDetails.amount * 100,
        currency: planDetails.currency,
        plan: planDetails.code,
        reference,
        // Iframe finished rendering — drop our spinner; Paystack's UI is now visible.
        onLoad: () => {
          settled = true
          clearTimeout(watchdog)
          loading.value = false
        },
        onCancel: () => {
          settled = true
          clearTimeout(watchdog)
          loading.value = false
          usePosthogCapture('PAYMENT_CANCELLED', { plan, amount: planDetails.amount, currency: planDetails.currency })
          trackPaymentCancelled(planDetails.code, 'User closed payment modal')
          useToast().add({ icon: 'i-heroicons-information-circle', title: 'Payment Cancelled', description: 'You can upgrade anytime', color: 'gray' })
          onCancel?.()
        },
        onError: (error: any) => {
          settled = true
          clearTimeout(watchdog)
          loading.value = false
          const errMsg = error?.message || 'An error occurred during checkout. Please try again.'
          useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errMsg, color: 'orange' })
          onError?.(errMsg)
        },
        onSuccess: (transaction: any) => {
          settled = true
          clearTimeout(watchdog)
          loading.value = false
          const txRef = transaction?.reference || reference
          usePosthogCapture('PAYMENT_SUCCESSFUL', {
            plan, amount: planDetails.amount, currency: planDetails.currency,
            reference: txRef, status: transaction?.status, provider: 'paystack',
          })
          successPlanName.value = planDetails.name
          showSuccessModal.value = true
          onSuccess?.(txRef)

          // Confirm with backend in the background — activates immediately without waiting for the webhook
          useAPIFetch<{ message: string; data: { status: string } }>('/billing/confirm', {
            method: 'POST',
            body: { provider: 'paystack', checkoutReference: txRef },
            key: `paystack-confirm-${txRef}`,
          }).then(({ data: confirmData }) => {
            if (confirmData.value?.data?.status === 'active') {
              if (authStore.church) {
                authStore.setChurch({ ...authStore.church, subscriptionPlan: 'teams' })
              }
              authStore.clearSubscriptionDetails()
            }
          }).catch(err => {
            console.error('Failed to confirm Paystack subscription:', err)
            // Webhook will still activate — not a blocker
          })
        },
      })
    } catch (error: any) {
      loading.value = false
      const errorMessage = error.message || 'Payment system is unavailable. Please try again.'
      useToast().add({ icon: 'i-heroicons-exclamation-triangle', title: 'Payment Error', description: errorMessage, color: 'orange' })
      onError?.(errorMessage)
    }
  }

  // ─── Unified entry point ─────────────────────────────────────────────────────

  /**
   * Initiate payment with the provider the API routed this church to
   * (usePayment callers pass it from useSubscriptionPlans().selectedProvider).
   * Without one, the currency decides: USD → Dodo, mobile money → Bachs, NGN → Paystack.
   */
  const initiatePayment = (config: PaymentConfig) => {
    const provider =
      config.provider ??
      (isBillingCurrency(config.currency) ? providerForCurrency(config.currency) : 'paystack')
    if (provider === 'bachs') return initiateBachsPayment(config)
    if (provider === 'dodo') return initiateDodoPayment(config)
    return initiatePaystackPayment(config)
  }

  return {
    loading: readonly(loading),
    awaitingConfirmation: readonly(awaitingConfirmation),
    showSuccessModal,
    successPlanName: readonly(successPlanName),
    plansLoading: subscriptionPlans.loading,
    plansData: subscriptionPlans.plans,
    fetchPlans: subscriptionPlans.fetchPlans,
    getPlanDetails,
    initiatePayment,
    preloadPaystack,
  }
}
