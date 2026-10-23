<template>
  <div class="settings-ctn h-[100%] overflow-y-auto p-1">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-[200px]">
      <Icon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="rounded-2xl bg-red-50 dark:bg-red-900/25 ring-1 ring-red-200 dark:ring-red-500/20 p-4 mb-4"
    >
      <p class="text-sm text-red-800 dark:text-red-200">
        {{ error }}
      </p>
      <CowButton
        variant="secondary"
        size="2xs"
        class="mt-3 !px-3.5 !py-1.5 text-xs"
        @click="fetchSubscriptionDetails"
      >
        Retry
      </CowButton>
    </div>

    <!-- Subscription Content -->
    <div v-else>
      <!-- Current Plan Section -->
      <div
        class="current-plan-section rounded-2xl bg-white dark:bg-[#131a27] ring-1 ring-gray-200 dark:ring-white/10 p-4 mb-4"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              :class="
                isFreeTrial || subscriptionData?.subscriptionPlan === 'free'
                  ? 'bg-amber-100 dark:bg-amber-900'
                  : 'bg-primary-100 dark:bg-primary-900'
              "
            >
              <Icon
                :name="
                  isFreeTrial
                    ? 'i-bx-gift'
                    : subscriptionData?.subscriptionPlan === 'teams'
                    ? 'i-bxs-award'
                    : 'i-bx-user'
                "
                class="w-6 h-6"
                :class="
                  isFreeTrial || subscriptionData?.subscriptionPlan === 'free'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-primary-600 dark:text-primary-400'
                "
              />
            </div>
            <div class="min-w-0">
              <h3 class="font-semibold text-base truncate">
                {{ currentPlanLabel }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-[#9aa3b2]">
                {{ currentPlanDescription }}
              </p>
            </div>
          </div>
          <CowButton
            v-if="
              subscriptionData?.subscriptionPlan === 'free' &&
              !isFreeTrial &&
              !isPastDue
            "
            variant="primary"
            size="2xs"
            class="!px-4 !py-2 text-xs shrink-0"
            @click="handleUpgrade"
          >
            Upgrade to Teams
          </CowButton>
        </div>
      </div>

      <!-- Payment Failed Banner -->
      <div
        v-if="isPastDue"
        class="payment-failed-banner rounded-2xl bg-red-50 dark:bg-red-900/25 p-4 mb-4"
        role="alert"
      >
        <div class="flex items-start gap-3">
          <Icon
            name="i-bx-error"
            class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
          />
          <div>
            <h4 class="font-semibold text-sm text-red-800 dark:text-red-200">
              Your payment didn't go through
            </h4>
            <p
              v-if="pastDueKeepsTeams"
              class="text-sm text-red-700 dark:text-red-300 mt-1"
            >
              Teams stays on until
              {{ formatDate(subscriptionData?.activeSubscription?.pastDue?.accessEndsAt ?? null) }}.
              Retry or update your card before then to keep it.
            </p>
            <p v-else class="text-sm text-red-700 dark:text-red-300 mt-1">
              Your Teams features are paused. They come back as soon as a
              payment succeeds<template
                v-if="subscriptionData?.activeSubscription?.pastDue?.retryEndsAt"
                >, if you fix it by
                {{ formatDate(subscriptionData.activeSubscription.pastDue.retryEndsAt) }}</template
              >.
            </p>
            <template
              v-if="subscriptionData?.activeSubscription?.canUpdatePaymentMethod"
            >
              <div class="flex flex-wrap gap-2 mt-3">
                <CowButton
                  variant="danger"
                  size="2xs"
                  class="!px-3.5 !py-1.5 text-xs"
                  :loading="retryingPayment"
                  :disabled="openingPaymentMethod"
                  @click="retryPayment"
                >
                  Retry payment
                </CowButton>
                <CowButton
                  variant="secondary"
                  size="2xs"
                  class="!px-3.5 !py-1.5 text-xs"
                  :loading="openingPaymentMethod"
                  :disabled="retryingPayment"
                  @click="updatePaymentMethod"
                >
                  Update payment method
                </CowButton>
              </div>
              <!-- Paystack's card page only saves the card. Dodo's charges the
                   overdue amount itself, so it needs no follow-up. -->
              <p
                v-if="subscriptionData.activeSubscription.paystackSubscriptionCode"
                class="text-xs text-red-700/80 dark:text-red-300/80 mt-2"
              >
                Changed your card? Come back and tap Retry payment to charge it.
              </p>
            </template>
          </div>
        </div>
      </div>

      <!-- Free Trial Banner -->
      <div
        v-if="isFreeTrial"
        class="free-trial-banner rounded-2xl bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-500/20 p-4 mb-4"
      >
        <div class="flex items-start gap-3">
          <Icon
            name="i-bx-time-five"
            class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
          />
          <div>
            <h4 class="font-semibold text-sm text-amber-800 dark:text-amber-200">
              Free Trial Active
            </h4>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You're currently on a free trial. Enjoy all Teams features during
              your trial period.
              <template v-if="subscriptionData?.activeSubscription?.expiresAt">
                Trial ends on
                {{ formatDate(subscriptionData.activeSubscription.expiresAt) }}.
              </template>
            </p>
            <CowButton
              variant="secondary"
              size="2xs"
              class="mt-3 !px-3.5 !py-1.5 text-xs"
              @click="handleUpgrade"
            >
              Subscribe to continue access
            </CowButton>
          </div>
        </div>
      </div>

      <!-- Active Subscription Details -->
      <div
        v-if="
          subscriptionData?.activeSubscription &&
          subscriptionData?.subscriptionPlan === 'teams'
        "
        class="subscription-details rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-4 mb-4"
      >
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">Status</p>
            <UBadge
              :color="getStatusColor(subscriptionData.activeSubscription.status)"
              size="sm"
              :ui="{ rounded: 'rounded-full' }"
            >
              {{ subscriptionData.activeSubscription.status }}
            </UBadge>
          </div>
          <div v-if="subscriptionData.activeSubscription.amount">
            <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">Amount</p>
            <p class="font-medium text-sm">
              {{
                formatCurrency(
                  subscriptionData.activeSubscription.amount,
                  subscriptionData.activeSubscription.currency
                )
              }}
              /
              {{
                subscriptionData.activeSubscription.interval === "yearly"
                  ? "year"
                  : "month"
              }}
            </p>
          </div>
          <div v-if="subscriptionData.activeSubscription.expiresAt">
            <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">
              {{
                subscriptionData.activeSubscription.status === "canceled"
                  ? "Access Until"
                  : "Next Billing Date"
              }}
            </p>
            <p class="font-medium text-sm">
              {{ formatDate(subscriptionData.activeSubscription.expiresAt) }}
            </p>
          </div>
          <div v-if="subscriptionData.activeSubscription.lastPaidAt">
            <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">
              Last Payment
            </p>
            <p class="font-medium text-sm">
              {{ formatDate(subscriptionData.activeSubscription.lastPaidAt) }}
            </p>
          </div>
        </div>

        <!-- Cancel Subscription -->
        <div
          v-if="subscriptionData.activeSubscription.status === 'active' || subscriptionData.activeSubscription.status === 'trialing'"
          class="mt-6"
        >
          <div class="flex flex-wrap gap-2">
            <CowButton
              v-if="subscriptionData.activeSubscription.canUpdatePaymentMethod"
              variant="secondary"
              size="2xs"
              class="!px-3.5 !py-1.5 text-xs"
              :loading="openingPaymentMethod"
              @click="updatePaymentMethod"
            >
              Update payment method
            </CowButton>
            <CowButton
              variant="danger"
              size="2xs"
              class="!px-3.5 !py-1.5 text-xs"
              :loading="canceling"
              @click="showCancelConfirm = true"
            >
              Cancel Subscription
            </CowButton>
          </div>
          <p class="text-xs text-gray-500 dark:text-[#9aa3b2] mt-2">
            {{
              subscriptionData.activeSubscription.status === 'trialing'
                ? 'You will keep access until your trial ends. You will not be charged.'
                : 'You will have access until the end of your current billing period.'
            }}
          </p>
        </div>

        <!-- Already Canceled Notice -->
        <div
          v-else-if="subscriptionData.activeSubscription.status === 'canceled'"
          class="mt-6 pt-4 border-t border-gray-200 dark:border-white/5"
        >
          <div
            class="rounded-xl bg-amber-50 dark:bg-amber-900/30 p-3 flex items-start gap-2"
          >
            <Icon
              name="i-bx-info-circle"
              class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
            />
            <p class="text-sm text-amber-800 dark:text-amber-200">
              Your subscription has been canceled. You will have access until
              {{ formatDate(subscriptionData.activeSubscription.expiresAt) }}.
            </p>
          </div>
        </div>
      </div>

      <!-- Billing History Section -->
      <div
        v-if="transactions.length > 0"
        class="billing-history-section rounded-2xl bg-white dark:bg-[#131a27] ring-1 ring-gray-200 dark:ring-white/10 p-4"
      >
        <h4 class="font-semibold text-sm mb-3">Billing History</h4>
        <div class="overflow-x-auto">
          <table class="table-auto w-full text-sm">
            <thead>
              <tr
                class="border-b border-gray-200 dark:border-white/10 text-left"
              >
                <th class="py-2 px-2 font-medium">Date</th>
                <th class="py-2 px-2 font-medium">Type</th>
                <th class="py-2 px-2 font-medium">Amount</th>
                <th class="py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="transaction in transactions"
                :key="transaction._id"
                class="border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <td class="py-3 px-2">
                  {{ formatDate(transaction.occurredAt) }}
                </td>
                <td class="py-3 px-2">
                  {{ formatTransactionKind(transaction.kind) }}
                </td>
                <td class="py-3 px-2">
                  <template v-if="transaction.amount">
                    {{
                      formatCurrency(
                        parseFloat(transaction.amount),
                        transaction.currency
                      )
                    }}
                  </template>
                  <template v-else>
                    <span class="text-gray-400">-</span>
                  </template>
                </td>
                <td class="py-3 px-2">
                  <UBadge
                    :color="getStatusColor(transaction.status)"
                    size="xs"
                    :ui="{ rounded: 'rounded-full' }"
                  >
                    {{ transaction.status }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- No Billing History -->
      <div
        v-else-if="!transactionsLoading"
        class="no-billing-history text-center py-8 text-gray-500 dark:text-[#9aa3b2]"
      >
        <Icon name="i-bx-receipt" class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No billing history yet</p>
        <p class="text-sm">Subscribe to Teams to unlock premium features.</p>
      </div>
    </div>

    <!-- Cancel Confirmation Modal -->
    <UModal
      v-model="showCancelConfirm"
      :ui="{
        rounded: 'rounded-2xl',
        background: 'bg-transparent dark:bg-transparent',
        ring: '',
        shadow: 'shadow-none',
        width: 'w-[94vw] sm:max-w-md',
        overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
      }"
    >
      <div
        class="rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden p-6"
      >
        <h3 class="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
          Cancel Subscription?
        </h3>
        <p class="text-sm text-gray-600 dark:text-[#9aa3b2] mb-5">
          Are you sure you want to cancel your subscription? You will continue
          to have access to Teams features until the end of your current billing
          period.
        </p>
        <div class="flex gap-3 justify-end">
          <CowButton
            variant="secondary"
            size="2xs"
            class="!px-4 !py-2 text-xs"
            @click="showCancelConfirm = false"
          >
            Keep Subscription
          </CowButton>
          <CowButton
            variant="danger"
            size="2xs"
            class="!px-4 !py-2 text-xs"
            :loading="canceling"
            @click="cancelSubscription"
          >
            Yes, Cancel
          </CowButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import type { BillingTransaction, SubscriptionDetails } from "~/types"

const authStore = useAuthStore()
const toast = useToast()
const emitter = useNuxtApp().$emitter as any

// Only show loader if there's no cached data
const loading = ref(!authStore.subscriptionDetails)
const error = ref<string | null>(null)
const canceling = ref(false)
const showCancelConfirm = ref(false)

// Use cached data initially if available
const subscriptionData = ref<SubscriptionDetails | null>(
  authStore.subscriptionDetails
)

const transactions = ref<BillingTransaction[]>([])
const transactionsLoading = ref(true)

const isFreeTrial = computed(() => subscriptionData.value?.isFreeTrial ?? false)

// A failed renewal drops the church to the free plan but keeps the
// subscription linked, so this must not depend on subscriptionPlan.
const isPastDue = computed(
  () => subscriptionData.value?.activeSubscription?.status === "past-due"
)

// For the first few days after a failed payment the church keeps Teams.
const pastDueKeepsTeams = computed(
  () =>
    isPastDue.value &&
    subscriptionData.value?.subscriptionPlan === "teams" &&
    !!subscriptionData.value?.activeSubscription?.pastDue?.accessEndsAt
)

const currentPlanLabel = computed(() => {
  if (isFreeTrial.value) {
    return "Free Trial"
  }
  if (subscriptionData.value?.subscriptionPlan === "teams") {
    return `Teams Plan ${
      subscriptionData.value?.activeSubscription?.interval === "yearly"
        ? "(Annual)"
        : "(Monthly)"
    }`
  }
  return "Free Plan"
})

const currentPlanDescription = computed(() => {
  if (isFreeTrial.value) {
    return "Enjoy all Teams features during your trial period"
  }
  if (subscriptionData.value?.subscriptionPlan === "teams") {
    return "Full access to all premium features"
  }
  return "Basic features for getting started"
})

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const formatCurrency = (amount: number, currency: string | null) => {
  const currencyCode = currency || "USD"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount)
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
    case "successful":
      return "green"
    case "canceled":
    case "pending":
      return "amber"
    case "failed":
    case "reversed":
    case "past-due":
      return "red"
    case "inactive":
      return "gray"
    default:
      return "gray"
  }
}

const formatTransactionKind = (kind: BillingTransaction["kind"]) => {
  switch (kind) {
    case "initial_payment":
      return "Initial Payment"
    case "renewal":
      return "Renewal"
    default:
      return "Other"
  }
}

const fetchSubscriptionDetails = async (showLoader = true) => {
  if (showLoader) {
    loading.value = true
  }
  error.value = null

  const { data, error: fetchError } = await useAPIFetch("/billing/details")

  if (fetchError.value) {
    error.value = "Failed to load subscription details. Please try again."
    loading.value = false
    return
  }

  const newData = (data.value as any)?.data || null
  subscriptionData.value = newData

  // Cache the data in auth store
  if (newData) {
    authStore.setSubscriptionDetails(newData)

    // The plan gates every Teams feature. A recovered payment (or a lapse)
    // must reach those gates now, not on the next church refresh.
    if (
      authStore.church &&
      newData.subscriptionPlan &&
      authStore.church.subscriptionPlan !== newData.subscriptionPlan
    ) {
      authStore.setChurch({
        ...authStore.church,
        subscriptionPlan: newData.subscriptionPlan,
      })
    }
  }

  loading.value = false
}

const fetchTransactions = async () => {
  transactionsLoading.value = true

  const { data, error: fetchError } = await useAPIFetch(
    "/billing/transactions",
    { query: { limit: 100 } }
  )

  if (fetchError.value) {
    transactionsLoading.value = false
    return
  }

  transactions.value = (data.value as any)?.data?.transactions || []
  transactionsLoading.value = false
}

const cancelSubscription = async () => {
  canceling.value = true

  const { data, error: cancelError } = await useAPIFetch("/billing/cancel", {
    method: "POST",
  })

  if (cancelError.value) {
    toast.add({
      color: "red",
      title: "Failed to cancel subscription",
      icon: "i-bx-error",
    })
    canceling.value = false
    return
  }

  toast.add({
    color: "green",
    title: "Subscription canceled",
    description:
      "You will have access until the end of your current billing period.",
    icon: "i-bx-check-circle",
  })

  showCancelConfirm.value = false
  canceling.value = false

  // Refresh subscription data without showing loader
  await fetchSubscriptionDetails(false)
}

const handleUpgrade = () => {
  emitter.emit("show-upgrade-modal")
}

/**
 * Payment requests must never be sent offline: useAPIFetch queues offline
 * POSTs and replays them on reconnect, which here would charge a card long
 * after the customer gave up waiting.
 */
const ensureOnline = () => {
  if (navigator.onLine) return true
  toast.add({
    color: "red",
    title: "You're offline",
    description: "Reconnect to the internet to manage your payment.",
    icon: "i-bx-wifi-off",
  })
  return false
}

/**
 * Opens a provider page. On the web, `pendingTab` is a tab opened inside the
 * click: browsers block window.open once an await has run.
 */
const openProviderPage = async (url: string, pendingTab: Window | null) => {
  if (useTauri().isTauri) {
    await useOpenExternal(url)
  } else if (pendingTab) {
    pendingTab.opener = null
    pendingTab.location.href = url
  } else if (!window.open(url, "_blank", "noopener,noreferrer")) {
    window.location.href = url
  }
}

const RECOVERY_POLL_MS = 4000
const RECOVERY_POLL_ATTEMPTS = 8
let recoveryPoll: ReturnType<typeof setTimeout> | null = null

const stopRecoveryPoll = () => {
  if (recoveryPoll) clearTimeout(recoveryPoll)
  recoveryPoll = null
}

/**
 * A charge the provider is still processing restores access by webhook a few
 * seconds later, so keep re-reading the status until it clears or we give up.
 */
const pollForRecovery = (attempt = 1) => {
  stopRecoveryPoll()
  recoveryPoll = setTimeout(async () => {
    await fetchSubscriptionDetails(false)
    if (!isPastDue.value) {
      stopRecoveryPoll()
      fetchTransactions()
      toast.add({
        color: "green",
        title: "Payment successful",
        description: "Your Teams features are back.",
        icon: "i-bx-check-circle",
      })
      return
    }
    if (attempt < RECOVERY_POLL_ATTEMPTS) {
      pollForRecovery(attempt + 1)
      return
    }
    fetchTransactions()
    toast.add({
      color: "amber",
      title: "Payment not confirmed yet",
      description:
        "If your card was declined, update your payment method and try again.",
      icon: "i-bx-info-circle",
    })
  }, RECOVERY_POLL_MS)
}

const openingPaymentMethod = ref(false)
// Set once the provider page is open, so returning to this window refreshes
// the status (a successful charge restores access via webhook).
const awaitingPaymentMethod = ref(false)

const updatePaymentMethod = async () => {
  if (!ensureOnline()) return
  openingPaymentMethod.value = true

  const pendingTab = useTauri().isTauri ? null : window.open("", "_blank")

  const { data, error: linkError } = await useAPIFetch("/billing/payment-method", {
    method: "POST",
  })
  openingPaymentMethod.value = false

  const url = (data.value as any)?.data?.url as string | undefined
  if (linkError.value || !url) {
    pendingTab?.close()
    toast.add({
      color: "red",
      title: "Couldn't open the payment page",
      description:
        (linkError.value as any)?.data?.message || "Please try again in a moment.",
      icon: "i-bx-error",
    })
    return
  }

  awaitingPaymentMethod.value = true
  await openProviderPage(url, pendingTab)
}

const refreshAfterPaymentMethod = () => {
  if (!awaitingPaymentMethod.value || document.visibilityState !== "visible") return
  awaitingPaymentMethod.value = false
  fetchTransactions()
  if (isPastDue.value) {
    // Dodo charges the overdue amount when the new card is saved; give its
    // webhook time to land.
    fetchSubscriptionDetails(false).then(() => {
      if (isPastDue.value) pollForRecovery()
    })
  } else {
    fetchSubscriptionDetails(false)
  }
}

const retryingPayment = ref(false)

const retryPayment = async () => {
  if (!ensureOnline()) return
  retryingPayment.value = true
  stopRecoveryPoll()

  const { data, error: retryError } = await useAPIFetch("/billing/retry-payment", {
    method: "POST",
  })
  retryingPayment.value = false

  const result = (data.value as any)?.data as
    | { status: "succeeded" | "pending" | "action_required" | "failed" | "nothing_due"; url?: string }
    | undefined

  // A decline comes back as a 402 with the bank's reason as the message.
  if (retryError.value || !result) {
    toast.add({
      color: "red",
      title: "Payment didn't go through",
      description:
        (retryError.value as any)?.data?.message ||
        "Please try again, or update your payment method.",
      icon: "i-bx-error",
    })
    fetchTransactions()
    return
  }

  switch (result.status) {
    case "succeeded":
      await fetchSubscriptionDetails(false)
      fetchTransactions()
      toast.add({
        color: "green",
        title: "Payment successful",
        description: "Your Teams features are back.",
        icon: "i-bx-check-circle",
      })
      break
    case "action_required":
      if (result.url) {
        awaitingPaymentMethod.value = true
        await openProviderPage(result.url, null)
      }
      toast.add({
        color: "amber",
        title: "Confirm the payment with your bank",
        description: "Finish the confirmation in the page that just opened.",
        icon: "i-bx-lock",
      })
      break
    case "pending":
      toast.add({
        color: "amber",
        title: "Processing your payment",
        description: "This usually takes a few seconds.",
        icon: "i-bx-time-five",
      })
      pollForRecovery()
      break
    case "nothing_due":
      await fetchSubscriptionDetails(false)
      fetchTransactions()
      if (isPastDue.value) {
        // The provider has been paid but its webhook hasn't reached us yet.
        toast.add({
          color: "amber",
          title: "Checking your payment",
          description: "Your payment went through. Restoring your Teams features.",
          icon: "i-bx-time-five",
        })
        pollForRecovery()
      } else {
        toast.add({
          color: "green",
          title: "You're all paid up",
          description: "Your Teams features are active.",
          icon: "i-bx-check-circle",
        })
      }
      break
  }
}

onBeforeUnmount(() => {
  stopRecoveryPoll()
  window.removeEventListener("focus", refreshAfterPaymentMethod)
  document.removeEventListener("visibilitychange", refreshAfterPaymentMethod)
})

onMounted(() => {
  window.addEventListener("focus", refreshAfterPaymentMethod)
  document.addEventListener("visibilitychange", refreshAfterPaymentMethod)

  // Fetch subscription details
  // If cached data exists, fetch in background without loader
  // If no cached data, show loader
  const hasCachedData = !!authStore.subscriptionDetails
  fetchSubscriptionDetails(!hasCachedData)
  fetchTransactions()
})
</script>

<style scoped>
.settings-ctn {
  max-height: 550px;
}
</style>
