<template>
  <div class="settings-ctn h-[100%] overflow-y-auto">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-[200px]">
      <Icon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-100 dark:bg-red-900 rounded-md p-4 mb-4"
    >
      <p class="text-sm text-red-800 dark:text-red-200">
        {{ error }}
      </p>
      <UButton
        variant="outline"
        size="sm"
        class="mt-2"
        @click="fetchSubscriptionDetails"
      >
        Retry
      </UButton>
    </div>

    <!-- Subscription Content -->
    <div v-else>
      <!-- Current Plan Section -->
      <div class="current-plan-section mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="icon-wrapper w-12 h-12 rounded-lg flex items-center justify-center"
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
            <div>
              <h3 class="font-semibold text-lg">
                {{ currentPlanLabel }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ currentPlanDescription }}
              </p>
            </div>
          </div>
          <UButton
            v-if="subscriptionData?.subscriptionPlan === 'free' && !isFreeTrial"
            color="primary"
            @click="handleUpgrade"
          >
            Upgrade to Teams
          </UButton>
        </div>
      </div>

      <!-- Free Trial Banner -->
      <div
        v-if="isFreeTrial"
        class="free-trial-banner bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6"
      >
        <div class="flex items-start gap-3">
          <Icon
            name="i-bx-time-five"
            class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5"
          />
          <div>
            <h4 class="font-medium text-amber-800 dark:text-amber-200">
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
            <UButton
              variant="outline"
              size="sm"
              class="mt-3"
              @click="handleUpgrade"
            >
              Subscribe to continue access
            </UButton>
          </div>
        </div>
      </div>

      <!-- Active Subscription Details -->
      <div
        v-if="
          subscriptionData?.activeSubscription &&
          subscriptionData?.subscriptionPlan === 'teams' &&
          !isFreeTrial
        "
        class="subscription-details bg-primary-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6"
      >
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Status</p>
            <UBadge
              :color="
                getStatusColor(subscriptionData.activeSubscription.status)
              "
              size="sm"
            >
              {{ subscriptionData.activeSubscription.status }}
            </UBadge>
          </div>
          <div v-if="subscriptionData.activeSubscription.amount">
            <p class="text-xs text-gray-500 dark:text-gray-400">Amount</p>
            <p class="font-medium">
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
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{
                subscriptionData.activeSubscription.status === "canceled"
                  ? "Access Until"
                  : "Next Billing Date"
              }}
            </p>
            <p class="font-medium">
              {{ formatDate(subscriptionData.activeSubscription.expiresAt) }}
            </p>
          </div>
          <div v-if="subscriptionData.activeSubscription.lastPaidAt">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Payment</p>
            <p class="font-medium">
              {{ formatDate(subscriptionData.activeSubscription.lastPaidAt) }}
            </p>
          </div>
        </div>

        <!-- Cancel Subscription -->
        <div
          v-if="subscriptionData.activeSubscription.status === 'active'"
          class="mt-6"
        >
          <UButton
            variant="outline"
            color="red"
            size="sm"
            :loading="canceling"
            @click="showCancelConfirm = true"
          >
            Cancel Subscription
          </UButton>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            You will have access until the end of your current billing period.
          </p>
        </div>

        <!-- Already Canceled Notice -->
        <div
          v-else-if="subscriptionData.activeSubscription.status === 'canceled'"
          class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800"
        >
          <div
            class="bg-amber-50 dark:bg-amber-900/30 rounded-md p-3 flex items-start gap-2"
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
        v-if="
          subscriptionData?.billingHistory &&
          subscriptionData.billingHistory.length > 0
        "
        class="billing-history-section mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <h4 class="font-semibold mb-4">Billing History</h4>
        <div class="overflow-x-auto">
          <table class="table-auto w-full text-sm">
            <thead>
              <tr
                class="border-b border-gray-200 dark:border-gray-700 text-left"
              >
                <th class="py-2 px-2 font-medium">Date</th>
                <th class="py-2 px-2 font-medium">Plan</th>
                <th class="py-2 px-2 font-medium">Amount</th>
                <th class="py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in subscriptionData.billingHistory"
                :key="record.id"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="py-3 px-2">
                  {{ formatDate(record.lastPaidAt || record.createdAt) }}
                </td>
                <td class="py-3 px-2 capitalize">
                  {{ record.plan }}
                </td>
                <td class="py-3 px-2">
                  <template v-if="record.amount">
                    {{ formatCurrency(record.amount, record.currency) }}
                  </template>
                  <template v-else>
                    <span class="text-gray-400">-</span>
                  </template>
                </td>
                <td class="py-3 px-2">
                  <UBadge :color="getStatusColor(record.status)" size="xs">
                    {{ record.status }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- No Billing History -->
      <div
        v-else-if="
          !isFreeTrial && subscriptionData?.subscriptionPlan === 'free'
        "
        class="no-billing-history text-center py-8 text-gray-500 dark:text-gray-400"
      >
        <Icon name="i-bx-receipt" class="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No billing history yet</p>
        <p class="text-sm">Subscribe to Teams to unlock premium features.</p>
      </div>
    </div>

    <!-- Cancel Confirmation Modal -->
    <UModal v-model="showCancelConfirm">
      <div class="p-6">
        <h3 class="font-semibold text-lg mb-2">Cancel Subscription?</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to cancel your subscription? You will continue
          to have access to Teams features until the end of your current billing
          period.
        </p>
        <div class="flex gap-3 justify-end">
          <UButton variant="ghost" @click="showCancelConfirm = false">
            Keep Subscription
          </UButton>
          <UButton color="red" :loading="canceling" @click="cancelSubscription">
            Yes, Cancel
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import type { SubscriptionDetails } from "~/types"

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

const isFreeTrial = computed(() => subscriptionData.value?.isFreeTrial ?? false)

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
      return "green"
    case "canceled":
      return "amber"
    case "inactive":
      return "gray"
    default:
      return "gray"
  }
}

const fetchSubscriptionDetails = async (showLoader = true) => {
  if (showLoader) {
    loading.value = true
  }
  error.value = null

  const { data, error: fetchError } = await useAPIFetch(
    "/subscriptions/details"
  )

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
  }

  loading.value = false
}

const cancelSubscription = async () => {
  canceling.value = true

  const { data, error: cancelError } = await useAPIFetch(
    "/subscriptions/cancel",
    {
      method: "POST",
    }
  )

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

onMounted(() => {
  // Fetch subscription details
  // If cached data exists, fetch in background without loader
  // If no cached data, show loader
  const hasCachedData = !!authStore.subscriptionDetails
  fetchSubscriptionDetails(!hasCachedData)
})
</script>

<style scoped>
.settings-ctn {
  max-height: 550px;
}
</style>
