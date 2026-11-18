<template>
  <Transition name="fade-sm">
    <!-- Poster ground (purple-500) with night ink: the brand's loud band.
         Same in light and dark, as the design system keeps poster tokens. -->
    <div
      v-if="showBanner"
      class="subscription-expiry-banner w-full shrink-0 bg-purple-500 text-[#0c0f19] px-4 py-2 flex items-center justify-between gap-4 text-sm"
    >
      <div class="flex items-center gap-2 w-full">
        <Icon name="i-bx-time-five" class="w-4 h-4 shrink-0" />
        <span class="block w-[100%] text-center font-medium">
          Your <strong class="font-semibold">Teams</strong> plan
          <strong class="font-semibold">{{ expiryLabel }}</strong
          >. Renew before Sunday notices.
        </span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="h-7 px-4 rounded-full bg-[#0c0f19] text-white text-xs font-medium shadow-[0_3px_0_0_#1f232c] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c0f19]"
          @click="openUpgradePlanModal"
        >
          Renew
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          class="size-7 grid place-items-center rounded-full hover:bg-[#0c0f19]/10 transition"
          @click="dismiss"
        >
          <Icon name="i-mdi-close" class="w-4 h-4" />
        </button>
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
