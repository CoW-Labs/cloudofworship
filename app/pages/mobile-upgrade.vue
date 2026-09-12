<template>
  <div class="w-full">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Mobile is a Teams feature
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[20rem]"
      >
        Running your service from a phone is part of
        <span class="font-semibold text-gray-900 dark:text-white">Teams</span>.
        That covers adding slides mid-service and keeping them in step with
        whoever is on the desktop console. Your church is on the Starter plan.
      </p>
    </div>

    <div class="flex flex-col gap-3.5 come-up-2">
      <CowButton block @click="useGlobalEmit(appWideActions.showUpgradeModal)">
        <template #leading>
          <IconWrapper name="i-bxs-award" class="w-4 h-4" />
        </template>
        Upgrade to Teams
      </CowButton>

      <p
        class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-0"
      >
        Using a computer instead?
        <UButton size="sm" class="p-1" variant="link" to="/?desktop=1">
          Open the console
        </UButton>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Shown when a phone reaches the app but the church is not on Teams.
 *
 * The `auth` layout already mounts `<UpgradePlanModal />` and fetches the plans
 * on mount, so the upgrade flow here is the same one every other upgrade prompt
 * in the app opens. This page only has to emit `show-upgrade-modal`.
 *
 * "Starter" rather than "Free" is deliberate: that is what the upgrade modal
 * this page opens calls the tier, so the two screens agree. Only the internal
 * plan id is `free`.
 *
 * Leaving is handled rather than trapped. The "Open the console" link carries
 * `?desktop=1`, the same opt-out the mobile redirect honours, so a Starter user
 * on a tablet is never stuck on this page.
 */
import { appWideActions } from "~/utils/constants"

definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Mobile is a Teams feature - Cloud of Worship",
})

// A church that upgrades while sitting here (the modal completes in place)
// should not have to find its own way back to the app.
const { isTeamsPlan } = useSubscription()
watch(isTeamsPlan, (isTeams) => {
  if (isTeams) navigateTo("/mobile")
})
</script>
