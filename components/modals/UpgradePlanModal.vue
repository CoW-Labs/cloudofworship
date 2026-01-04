<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[800px] w-full max-w-[900px]',
        overlay: {
          background: 'bg-gray-200/75 dark:bg-gray-800/75',
        },
        padding: 'p-0',
      }"
    >
      <div
        class="upgrade-modal grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-lg"
      >
        <!-- Left Side - Pricing -->
        <div class="bg-white dark:bg-gray-900 p-8 relative">
          <button
            class="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
            @click="visible = false"
          >
            <IconWrapper name="i-heroicons-x-mark-20-solid" class="w-5 h-5" />
          </button>

          <h2 class="text-2xl font-bold mb-6">Do more for your ministry</h2>

          <!-- Yearly Plan -->
          <div
            class="border-2 rounded-xl p-4 mb-4 cursor-pointer transition-all"
            :class="
              selectedPlan === 'yearly'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            "
            @click="selectedPlan = 'yearly'"
          >
            <div class="flex items-start justify-between mb-2">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-lg">Yearly</h3>
                  <UBadge color="green" variant="solid" size="xs">
                    Save 16%
                  </UBadge>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ currencySymbol }}{{ yearlyPrice.toLocaleString() }} / year
                </p>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="
                  selectedPlan === 'yearly'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                "
              >
                <div
                  v-if="selectedPlan === 'yearly'"
                  class="w-2 h-2 bg-white rounded-full"
                ></div>
              </div>
            </div>
          </div>

          <!-- Monthly Plan -->
          <div
            class="border-2 rounded-xl p-4 mb-6 cursor-pointer transition-all"
            :class="
              selectedPlan === 'monthly'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            "
            @click="selectedPlan = 'monthly'"
          >
            <div class="flex items-start justify-between mb-2">
              <div>
                <h3 class="font-semibold text-lg">Monthly</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ currencySymbol }}{{ monthlyPrice.toLocaleString() }} /
                  month
                </p>
              </div>
              <div
                class="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                :class="
                  selectedPlan === 'monthly'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 dark:border-gray-600'
                "
              >
                <div
                  v-if="selectedPlan === 'monthly'"
                  class="w-2 h-2 bg-white rounded-full"
                ></div>
              </div>
            </div>
          </div>

          <!-- Features List -->
          <div class="mb-6">
            <h4 class="font-semibold mb-3">
              Everything you need to elevate your worship experience
            </h4>
            <div class="space-y-2">
              <div
                v-for="feature in features"
                :key="feature"
                class="flex items-center gap-2 text-sm"
              >
                <IconWrapper
                  name="i-heroicons-check-circle-20-solid"
                  class="w-5 h-5 text-primary-500 flex-shrink-0"
                />
                <span>{{ feature }}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2">
            <UButton
              color="primary"
              size="lg"
              block
              @click="handleUpgrade"
              :loading="loading"
              class="font-semibold"
            >
              Continue with
              {{ selectedPlan === "yearly" ? "Yearly" : "Monthly" }}
            </UButton>
            <UButton
              color="white"
              variant="ghost"
              size="lg"
              block
              @click="visible = false"
            >
              Maybe later
            </UButton>
          </div>

          <!-- Ends of Earth Initiative Disclaimer -->
          <div
            class="mb-6 mt-4 p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg"
          >
            <div class="flex gap-3">
              <IconWrapper
                name="i-heroicons-heart-solid"
                class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5"
              />
              <div class="text-sm">
                <p
                  class="font-semibold text-primary-700 dark:text-primary-400 mb-1 text-xs"
                >
                  Ends of Earth Initiative
                </p>
                <p class="text-gray-700 dark:text-gray-300 text-xs">
                  90% of profits go directly to efforts pushing the gospel
                  forward in churches across Africa and other regions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Testimonial -->
        <div
          class="hidden md:block bg-cover bg-center relative overflow-hidden"
        >
          <div class="overlay"></div>
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20"
          ></div>
          <div class="absolute bottom-6 left-0 right-0 p-8 text-white">
            <p class="text-xl mb-4">
              "The app’s ability for different users to create accounts and
              share lyrics fosters community. Cloud of Worship is indispensable,
              and we highly recommend it for any congregation looking to enhance
              their worship experience."
            </p>
            <div class="flex items-center gap-3 mt-8">
              <div
                class="w-10 min-w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                :style="`background-image: url('/images/testimonials/bro-yinka.jpg'); background-size: cover; background-position: center;`"
              ></div>
              <div>
                <p class="font-semibold text-sm">Yinka Adenikinju</p>
                <p class="text-xs">
                  Head of Ministry, Foursquare Church in Lagos, Nigeria
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UModal>

    <!-- Payment Success Modal -->
    <PaymentSuccessModal
      v-model="showSuccessModal"
      :plan-name="successPlanName"
      @close="handleSuccessModalClose"
    />
  </div>
</template>

<script setup lang="ts">
import type { PaymentPlan } from "~/composables/usePayment"

const visible = ref(false)
const selectedPlan = ref<PaymentPlan>("yearly")

// Use payment composable
const {
  loading,
  showSuccessModal,
  successPlanName,
  PRICING,
  PLAN_CODES,
  initiatePayment,
  loadPaystackScript,
} = usePayment()

// Use subscription plans composable
const {
  plans,
  selectedCurrency,
  detectedCurrency,
  isDetectingCurrency,
  detectCurrency,
  fetchPlans,
  getPlanByIntervalAndCurrency,
  getCurrencySymbol,
  formatAmount,
} = useSubscriptionPlans()

// Get pricing from API or fallback to composable
const yearlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("yearly", selectedCurrency.value)
  return plan
    ? plan.amount
    : selectedCurrency.value === "NGN"
    ? PRICING.yearly
    : 99
})

const monthlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("monthly", selectedCurrency.value)
  return plan
    ? plan.amount
    : selectedCurrency.value === "NGN"
    ? PRICING.monthly
    : 9.99
})

const currencySymbol = computed(() => {
  return getCurrencySymbol(selectedCurrency.value)
})

const features = computed(() => {
  const plan = getPlanByIntervalAndCurrency(
    selectedPlan.value,
    selectedCurrency.value
  )

  if (plan?.features && plan.features.length > 0) {
    return plan.features
  }

  // Fallback features if API doesn't provide them
  return [
    "Access 9,000+ growing songs library",
    "Create custom text slides",
    // "Add unlimited media files",
    "YouTube & Vimeo video support",
    // "Professional slide templates",
    "Dynamic countdown timers",
    // "Team collaboration tools",
    "5GB cloud storage",
    // "Early access to new features",
  ]
})

const emitter = useNuxtApp().$emitter as any

onMounted(async () => {
  // Detect user's currency based on location
  await detectCurrency()

  // Fetch all subscription plans from API (both NGN and USD)
  await fetchPlans()

  emitter.on(
    "show-upgrade-modal",
    (data?: { planCode?: string; planId?: string }) => {
      visible.value = true

      // Set plan based on plan_id (preferred) or plan_code (legacy support)
      if (data?.planId) {
        // Use plan_id to find the plan
        const plan = plans.value.find((p) => p.id === data.planId)
        if (plan) {
          selectedPlan.value = plan.interval
          // Override auto-detected currency with plan's currency if specified
          selectedCurrency.value = plan.currency

          usePosthogCapture("UPGRADE_MODAL_OPENED", {
            planId: data.planId,
            interval: plan.interval,
            currency: plan.currency,
            autoDetectedCurrency: detectedCurrency.value,
            source: "signup",
          })
        }
      } else if (data?.planCode) {
        // Legacy support for plan_code
        if (data.planCode === PLAN_CODES.yearly) {
          selectedPlan.value = "yearly"
        } else if (data.planCode === PLAN_CODES.monthly) {
          selectedPlan.value = "monthly"
        }

        usePosthogCapture("UPGRADE_MODAL_OPENED", {
          planCode: data.planCode,
          currency: selectedCurrency.value,
          autoDetectedCurrency: detectedCurrency.value,
          source: "signup",
        })
      } else {
        // No specific plan provided, use auto-detected currency
        usePosthogCapture("UPGRADE_MODAL_OPENED", {
          source: "feature_gate",
          currency: selectedCurrency.value,
          autoDetectedCurrency: detectedCurrency.value,
        })
      }
    }
  )

  // Preload Paystack script
  loadPaystackScript().catch(console.error)
})

onBeforeUnmount(() => {
  emitter.off("show-upgrade-modal")
})

const handleUpgrade = async () => {
  // Get the selected plan details
  const planDetails = getPlanByIntervalAndCurrency(
    selectedPlan.value,
    selectedCurrency.value
  )

  // Track upgrade attempt with currency
  usePosthogCapture("UPGRADE_INITIATED", {
    plan: selectedPlan.value,
    currency: selectedCurrency.value,
    autoDetectedCurrency: detectedCurrency.value,
    amount: planDetails?.amount,
    planId: planDetails?.id,
  })

  // Note: USD payment processing will be enabled once Paystack USD plans are configured
  // For now, show informative message for USD
  if (selectedCurrency.value === "USD") {
    useToast().add({
      icon: "i-heroicons-information-circle",
      title: "USD Payment Coming Soon",
      description:
        "USD payments will be available soon. We detected you're outside Nigeria. Contact support for assistance.",
      color: "blue",
      timeout: 8000,
    })
    return
  }

  await initiatePayment({
    plan: selectedPlan.value,
    onSuccess: async (reference) => {
      visible.value = false
      useChurch().fetchChurch()
    },
    onCancel: () => {
      useToast().add({
        icon: "i-heroicons-x-circle",
        title: "Payment Cancelled",
        color: "orange",
      })
    },
    onError: (error) => {
      console.error("Payment error:", error)
    },
  })
}

const handleSuccessModalClose = () => {
  // Optionally refresh user data or redirect
  // The modal state is already managed by the composable
}
</script>

<style scoped>
.upgrade-modal {
  max-height: 90vh;
  /* overflow: hidden; */
}

.overlay {
  position: absolute;
  background: url("/images/slide-bg.jpeg") center/cover no-repeat;
  /* background-size: 130%; */
  inset: 0;
  width: 100%;
  height: 100%;
  mix-blend-mode: lighten;
  opacity: 0.5;
  animation: rotateScale 90s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
  transform-origin: center center;
  transform: scale(1.15);
  /* background: linear-gradient(
    135deg,
    rgba(var(--color-primary-500), 0.3) 0%,
    rgba(var(--color-primary-700), 0.5) 100%
  ); */
}

@keyframes rotateScale {
  0% {
    transform: rotate(0deg) scale(1.15);
  }
  50% {
    transform: rotate(5deg) scale(1.6);
  }
  70% {
    transform: rotate(-5deg) scale(1.35);
  }
  100% {
    transform: rotate(-5deg) scale(1.15);
  }
}
</style>
