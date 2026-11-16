<template>
  <Transition name="fade-sm">
    <div
      v-if="showBanner"
      class="subscription-expiry-banner w-full shrink-0 bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700 px-4 py-2 flex items-center justify-between gap-4 text-sm"
    >
      <div
        class="flex items-center gap-2 text-amber-800 dark:text-amber-200 w-full"
      >
        <Icon name="i-bx-time-five" class="w-4 h-4 shrink-0" />
        <span class="block w-[100%] text-center">
          Your <strong>Teams</strong> subscription
          <strong>{{ expiryLabel }}</strong
          >. Renew to keep access to all premium features.
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          size="xs"
          color="amber"
          variant="solid"
          @click="openUpgradePlanModal"
        >
          Renew
        </UButton>
        <UButton
          size="xs"
          color="amber"
          variant="ghost"
          icon="i-mdi-close"
          @click="dismiss"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import { appWideActions } from "~/utils/constants"
import { needsManualRenewal } from "~/utils/billing"

const authStore = useAuthStore()
const dismissed = ref(false)

const activeSubscription = computed(
  () => authStore.subscriptionDetails?.activeSubscription ?? null
)

const daysUntilExpiry = computed(() => {
  const expiresAt = activeSubscription.value?.expiresAt
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const showBanner = computed(() => {
  if (dismissed.value) return false
  const days = daysUntilExpiry.value
  if (days === null) return false
  // Only for Teams plans that end within 7 days unless the church pays
  // again: mobile money, bank transfer, admin-granted. A card subscription
  // renews itself, so telling it to renew would invite a second payment.
  return (
    authStore.subscriptionDetails?.subscriptionPlan === "teams" &&
    needsManualRenewal(activeSubscription.value) &&
    days >= 0 &&
    days <= 7
  )
})

const expiryLabel = computed(() => {
  const days = daysUntilExpiry.value

  if (days === null) return ""
  if (days === 0) return "expires today"
  if (days === 1) return "expires tomorrow"
  if (days === -1) return `expired a day ago`
  if (days < 0) return `expired ${Math.abs(days)} days ago`
  return `expires in ${days} days`
})

const openUpgradePlanModal = () => {
  useGlobalEmit("show-upgrade-modal")
}

const openSubscriptionSettings = () => {
  useGlobalEmit(appWideActions.openSettings, "Subscription Settings")
}

const dismiss = () => {
  dismissed.value = true
}
</script>
