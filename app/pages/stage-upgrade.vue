<template>
  <div class="w-full">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Stage Display is a Teams feature
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[20rem]"
      >
        Stage Display is part of
        <span class="font-semibold text-gray-900 dark:text-white">Teams</span>.
        It shows your musicians and speakers the current slide, the next one
        and a clock.
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
        Not now?
        <UButton size="sm" class="p-1" variant="link" to="/">
          Back to the console
        </UButton>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Shown when `/stage` is opened but the church is not on Teams. Mirrors
 * `mobile-upgrade.vue`: the `auth` layout mounts `<UpgradePlanModal />`, so
 * this page only emits `show-upgrade-modal`, and the tier is called "Starter"
 * to match that modal.
 */
import { appWideActions } from "~/utils/constants"

definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Stage Display is a Teams feature - Cloud of Worship",
})

// A church that upgrades while sitting here should land on the stage display.
const { isTeamsPlan } = useSubscription()
watch(isTeamsPlan, (isTeams) => {
  if (isTeams) navigateTo("/stage")
})
</script>
