<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        width: 'w-full sm:max-w-[1040px]',
        base: 'w-full',
        overlay: {
          background: 'bg-gray-200/75 dark:bg-gray-950/80',
        },
        padding: 'p-0',
        rounded: 'rounded-[28px]',
        background: 'bg-white dark:bg-[#161b28]',
      }"
    >
      <div
        class="upgrade-modal relative bg-white dark:bg-[#161b28] px-6 py-8 sm:px-12 sm:py-10 lg:px-[6.5rem] lg:py-12 rounded-[28px]"
      >
        <!-- Close -->
        <button
          class="absolute top-5 right-5 p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors z-20"
          @click="handleDismiss"
        >
          <IconWrapper name="i-heroicons-x-mark-20-solid" class="w-5 h-5" />
        </button>

        <!-- Heading -->
        <h2
          class="text-center text-2xl sm:text-[1.75rem] font-bold text-gray-900 dark:text-white mb-8 lg:mb-10"
        >
          How do you want to continue?
        </h2>

        <div
          class="grid grid-cols-1 md:grid-cols-[4fr_3fr] gap-6 lg:gap-8 max-w-[850px] mx-auto"
        >
          <!-- LEFT — Plan chooser -->
          <div class="flex flex-col">
            <!-- Billing toggle + currency -->
            <div class="flex items-center gap-3 mb-6">
              <UTabs
                v-model="billingTabIndex"
                :items="billingTabs"
                :content="false"
                class="flex-1"
                :ui="{
                  list: {
                    height: 'h-12',
                    rounded: 'rounded-xl',
                    background: 'bg-gray-100 dark:bg-white/5',
                    padding: 'p-1',
                    tab: { height: 'h-10', rounded: 'rounded-lg' },
                    marker: {
                      rounded: 'rounded-lg',
                      background: 'bg-white dark:bg-white/10',
                    },
                  },
                }"
              >
                <template #default="{ item }">
                  <span class="flex items-center gap-1.5">
                    {{ item.label }}
                    <span
                      v-if="item.value === 'yearly'"
                      class="text-[10px] font-semibold bg-primary-400 text-white px-2 py-1 rounded-full leading-none"
                    >
                      17% Off
                    </span>
                  </span>
                </template>
              </UTabs>

              <UPopover
                mode="click"
                :popper="{ placement: 'bottom-end' }"
                :ui="{ ring: 'ring-1 ring-gray-200 dark:ring-white/10' }"
              >
                <button
                  class="flex items-center gap-2 h-12 text-sm font-medium px-4 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  {{ selectedCurrency }} ({{ currencySymbol }})
                  <IconWrapper
                    name="i-heroicons-chevron-down-20-solid"
                    class="w-4 h-4 text-gray-400"
                  />
                </button>
                <template #panel="{ close }">
                  <div class="p-1 min-w-[120px]">
                    <button
                      v-for="code in currencyCodes"
                      :key="code"
                      class="w-full flex items-center justify-between gap-3 text-sm py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      :class="
                        selectedCurrency === code
                          ? 'text-primary-600 dark:text-primary-400 font-semibold'
                          : 'text-gray-700 dark:text-gray-200'
                      "
                      @click="selectCurrency(code), close()"
                    >
                      {{ code }} ({{ getCurrencySymbol(code) }})
                      <IconWrapper
                        v-if="selectedCurrency === code"
                        name="i-heroicons-check-20-solid"
                        class="w-4 h-4"
                      />
                    </button>
                  </div>
                </template>
              </UPopover>
            </div>

            <!-- Starter (Free) -->
            <button
              type="button"
              class="text-left border-2 rounded-[20px] p-6 mb-4 transition-all relative bg-gray-50 dark:bg-white/[0.045]"
              :class="
                selectedTier === 'free'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-white/10'
              "
              @click="selectedTier = 'free'"
            >
              <span class="absolute top-6 right-6">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors"
                  :class="
                    selectedTier === 'free'
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-400 dark:border-gray-500 bg-white/50 dark:bg-black/20'
                  "
                >
                  <IconWrapper
                    v-if="selectedTier === 'free'"
                    name="i-heroicons-check-20-solid"
                    class="w-5 h-5 text-white shrink-0"
                  />
                </span>
              </span>

              <p
                class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-3"
              >
                Starter
              </p>
              <h3
                class="text-[2.5rem] leading-none font-bold text-gray-900 dark:text-white mb-3"
              >
                {{ currencySymbol }}0.00
              </h3>
              <p class="text-[15px] text-gray-500 dark:text-gray-400">
                For churches with a single steward
              </p>
            </button>

            <!-- Team (Paid) -->
            <button
              type="button"
              class="text-left border-2 rounded-[20px] p-6 mb-6 transition-all relative bg-gray-50 dark:bg-white/[0.045]"
              :class="
                selectedTier === 'team'
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-200 dark:hover:border-white/10'
              "
              @click="selectedTier = 'team'"
            >
              <span class="absolute top-6 right-6">
                <span
                  class="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors"
                  :class="
                    selectedTier === 'team'
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-400 dark:border-gray-500 bg-white/50 dark:bg-black/20'
                  "
                >
                  <IconWrapper
                    v-if="selectedTier === 'team'"
                    name="i-heroicons-check-20-solid"
                    class="w-5 h-5 text-white shrink-0"
                  />
                </span>
              </span>

              <p
                class="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-3"
              >
                Teams
              </p>
              <h3
                class="text-[2.5rem] leading-none font-bold text-gray-900 dark:text-white mb-3"
              >
                {{ currencySymbol }}{{ displayedTeamPrice.toLocaleString() }}
              </h3>
              <p
                class="text-[15px] text-gray-500 dark:text-gray-400 max-w-[34ch]"
              >
                For churches that need collaboration tools for multiple
                stewards.
              </p>
            </button>

            <!-- Continue -->
            <CowButton
              block
              class="mt-10"
              :loading="loading && selectedTier === 'team'"
              @click="handleContinue"
            >
              Continue
            </CowButton>
          </div>

          <!-- RIGHT — Mission visual -->
          <div
            class="mission-card relative rounded-[20px] overflow-hidden min-h-[560px] md:min-h-[600px]"
          >
            <!-- Drifting clouds -->
            <div class="cloud-drift cloud-drift--1"></div>
            <div class="cloud-drift cloud-drift--2"></div>
            <div class="cloud-drift cloud-drift--3"></div>

            <!-- Heart + title -->
            <div
              class="relative z-10 flex flex-col items-center text-center px-8 pt-8"
            >
              <img
                ref="heartEl"
                src="/images/upgrade/heart-cloud.png"
                alt=""
                class="heart-cloud w-40 h-40 object-contain mb-2"
              />
              <h3
                ref="titleEl"
                class="text-3xl font-bold text-white leading-tight max-w-[13ch]"
                style="text-shadow: 0 2px 12px rgba(0, 0, 0, 0.2)"
              >
                Ends of The Earth Initiative
              </h3>
            </div>

            <!-- Floating info cards — slanted, bleeding off opposite edges -->
            <div
              ref="card1El"
              class="mission-float-card absolute -left-5 bottom-[110px] w-[68%] bg-white rounded-[18px] p-5 shadow-2xl"
              style="transform: rotate(-6deg)"
            >
              <PieChartIcon class="w-11 h-11 mb-3" />
              <p class="text-sm leading-snug text-gray-800">
                <span class="font-bold">90% of profits</span> from Teams plan
                sales go directly to efforts pushing the gospel forward in
                churches across Africa and other regions.
              </p>
            </div>

            <div
              ref="card2El"
              class="mission-float-card absolute -right-6 -bottom-2 w-[60%] bg-[#f6efdc] rounded-[18px] p-5 shadow-2xl"
              style="transform: rotate(5deg)"
            >
              <EarthIcon class="w-11 h-11 mb-3" />
              <p class="text-sm leading-snug text-gray-800">
                Your subscription helps equip ministries with the tools they
                need to spread the good news.
              </p>
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
import { gsap } from "gsap"

const visible = ref(false)
const selectedPlan = ref<PaymentPlan>("yearly")
const selectedTier = ref<"free" | "team">("team")

// Billing interval as UTabs (index-based model)
const billingTabs = [
  { label: "Monthly", value: "monthly" as PaymentPlan },
  { label: "Annually", value: "yearly" as PaymentPlan },
]
const billingTabIndex = computed({
  get: () => (selectedPlan.value === "yearly" ? 1 : 0),
  set: (index: number) => {
    selectedPlan.value = billingTabs[index]?.value ?? "yearly"
  },
})

// Right-side animation refs
const heartEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const card1El = ref<HTMLElement | null>(null)
const card2El = ref<HTMLElement | null>(null)

const animateMissionIn = () => {
  const targets = [heartEl.value, titleEl.value, card1El.value, card2El.value]
  if (targets.some((el) => !el)) return

  gsap.killTweensOf(targets)
  gsap.set(heartEl.value, { opacity: 0, y: -16, scale: 0.8 })
  gsap.set(titleEl.value, { opacity: 0, y: 14 })
  // Keep each card's resting slant through the entrance so GSAP's transform
  // doesn't wipe the inline rotate.
  gsap.set(card1El.value, { opacity: 0, y: 28, rotation: -6 })
  gsap.set(card2El.value, { opacity: 0, y: 28, rotation: 5 })

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
  tl.to(heartEl.value, { opacity: 1, y: 0, scale: 1, duration: 0.7 })
    .to(titleEl.value, { opacity: 1, y: 0, duration: 0.6 }, "-=0.35")
    .to(
      card1El.value,
      { opacity: 1, y: 0, rotation: -6, duration: 0.6 },
      "-=0.25"
    )
    .to(
      card2El.value,
      { opacity: 1, y: 0, rotation: 5, duration: 0.6 },
      "-=0.4"
    )
}

// Use payment composable
const {
  loading,
  showSuccessModal,
  successPlanName,
  initiatePayment,
  preloadPaystack,
} = usePayment()

// Use subscription plans composable
const {
  plans,
  selectedCurrency,
  detectedCurrency,
  detectCurrency,
  fetchPlans,
  getPlanByIntervalAndCurrency,
  getCurrencySymbol,
  setTestCurrency,
} = useSubscriptionPlans()

const currencyCodes = ["NGN", "USD"] as const

const selectCurrency = (code: "NGN" | "USD") => {
  setTestCurrency(code)
  selectedCurrency.value = code
}

// Pricing from API
const yearlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("yearly", selectedCurrency.value)
  if (!plan) return 0
  if (plan.currency === "USD" && plan.amountCents) return plan.amountCents / 100
  return plan.amount
})

const monthlyPrice = computed(() => {
  const plan = getPlanByIntervalAndCurrency("monthly", selectedCurrency.value)
  if (!plan) return 0
  if (plan.currency === "USD" && plan.amountCents) return plan.amountCents / 100
  return plan.amount
})

const teamPrice = computed(() =>
  selectedPlan.value === "yearly" ? yearlyPrice.value : monthlyPrice.value
)

// Rolling/odometer-style animation for the team price when the billing
// interval (or currency) changes while the modal is visible.
const displayedTeamPrice = ref(teamPrice.value)
let teamPriceTween: gsap.core.Tween | null = null

watch(teamPrice, (newPrice) => {
  if (!visible.value) {
    teamPriceTween?.kill()
    displayedTeamPrice.value = newPrice
    return
  }

  teamPriceTween?.kill()
  const proxy = { val: displayedTeamPrice.value }
  teamPriceTween = gsap.to(proxy, {
    val: newPrice,
    duration: 0.6,
    ease: "power2.out",
    onUpdate: () => {
      displayedTeamPrice.value = Math.round(proxy.val * 100) / 100
    },
  })
})

const currencySymbol = computed(() => getCurrencySymbol(selectedCurrency.value))

const emitter = useNuxtApp().$emitter as any

// Watch modal visibility to trigger the right-side entrance animation
watch(visible, (isVisible) => {
  if (isVisible) {
    nextTick(() => animateMissionIn())
  }
})

onMounted(async () => {
  await detectCurrency()
  await fetchPlans()

  emitter.on(
    "show-upgrade-modal",
    (data?: { planCode?: string; planId?: string }) => {
      visible.value = true

      if (data?.planId) {
        const plan = plans.value.find((p) => p.id === data.planId)
        if (plan) {
          selectedPlan.value = plan.interval
          selectedCurrency.value = plan.currency
          selectedTier.value = "team"

          usePosthogCapture("UPGRADE_MODAL_OPENED", {
            planId: data.planId,
            interval: plan.interval,
            currency: plan.currency,
            autoDetectedCurrency: detectedCurrency.value,
            source: "signup",
          })
        }
      } else if (data?.planCode) {
        const plan = plans.value.find((p) => p.planCode === data.planCode)
        if (plan) {
          selectedPlan.value = plan.interval
          selectedCurrency.value = plan.currency
          selectedTier.value = "team"

          usePosthogCapture("UPGRADE_MODAL_OPENED", {
            planCode: data.planCode,
            planId: plan.id,
            interval: plan.interval,
            currency: plan.currency,
            autoDetectedCurrency: detectedCurrency.value,
            source: "signup",
          })
        }
      } else {
        usePosthogCapture("UPGRADE_MODAL_OPENED", {
          source: "feature_gate",
          currency: selectedCurrency.value,
          autoDetectedCurrency: detectedCurrency.value,
        })
      }
    }
  )

  // Warm the Paystack SDK so the first checkout click opens instantly
  preloadPaystack().catch(console.error)
})

onBeforeUnmount(() => {
  emitter.off("show-upgrade-modal")
})

const handleContinue = () => {
  if (selectedTier.value === "free") {
    usePosthogCapture("UPGRADE_MODAL_CONTINUE_FREE", {
      currency: selectedCurrency.value,
    })
    visible.value = false
    navigateTo("/")
    return
  }
  handleUpgrade()
}

const handleDismiss = () => {
  usePosthogCapture("UPGRADE_MODAL_DISMISSED", {
    tier: selectedTier.value,
    currency: selectedCurrency.value,
  })
  visible.value = false
}

const handleUpgrade = async () => {
  const planDetails = getPlanByIntervalAndCurrency(
    selectedPlan.value,
    selectedCurrency.value
  )

  if (!planDetails) {
    useToast().add({
      icon: "i-heroicons-exclamation-triangle",
      title: "Plan Not Found",
      description: "The selected plan is not available. Please try again.",
      color: "red",
    })
    return
  }

  const amount =
    selectedCurrency.value === "USD" && planDetails.amountCents
      ? planDetails?.amountCents || 0
      : planDetails?.amountKobo || 0

  usePosthogCapture("UPGRADE_INITIATED", {
    plan: selectedPlan.value,
    currency: selectedCurrency.value,
    autoDetectedCurrency: detectedCurrency.value,
    amount: amount,
    planId: planDetails?.id,
  })

  await initiatePayment({
    plan: selectedPlan.value,
    currency: selectedCurrency.value,
    onSuccess: async () => {
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
  max-height: 92vh;
  overflow-y: auto;
}

/* Right-side sky card — bottom-anchored so the photo's clouds sit at the
   base of the card, peeking out behind the info cards */
.mission-card {
  background-image: url("/images/upgrade/sky-background.jpg");
  background-size: cover;
  background-position: 50% 100%;
  animation: sky-pan 40s ease-in-out infinite alternate;
}

@keyframes sky-pan {
  from {
    background-position: 42% 100%;
  }
  to {
    background-position: 58% 100%;
  }
}

/* Drifting cloud puffs — square boxes so the soft cloud image never crops */
.cloud-drift {
  position: absolute;
  aspect-ratio: 1 / 1;
  background-image: url("/images/upgrade/cloud-smoke.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  pointer-events: none;
  will-change: transform;
}

.cloud-drift--1 {
  top: 2%;
  width: 300px;
  opacity: 0.85;
  animation: drift-right 40s linear infinite;
}

.cloud-drift--2 {
  top: 30%;
  width: 420px;
  opacity: 0.6;
  animation: drift-left 52s linear infinite;
}

.cloud-drift--3 {
  top: 12%;
  width: 220px;
  opacity: 0.7;
  animation: drift-right 32s linear infinite;
  animation-delay: -14s;
}

@keyframes drift-right {
  from {
    transform: translateX(-120%);
  }
  to {
    transform: translateX(320%);
  }
}

@keyframes drift-left {
  from {
    transform: translateX(280%);
  }
  to {
    transform: translateX(-140%);
  }
}

/* Gentle float on the heart cloud */
.heart-cloud {
  animation: heart-bob 5s ease-in-out infinite;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.15));
}

@keyframes heart-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.mission-float-card {
  will-change: opacity, transform;
}

@media (prefers-reduced-motion: reduce) {
  .mission-card,
  .cloud-drift,
  .heart-cloud {
    animation: none;
  }
}
</style>
