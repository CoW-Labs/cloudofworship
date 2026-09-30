<template>
  <button
    type="button"
    class="cow-teams-preview-notice group block w-full rounded-2xl text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8980]"
    :aria-label="`${title}. Upgrade to Teams`"
    @click="upgrade"
  >
    <!-- #FF8980 is the Teams badge colour (see ActionCard), not a theme token. -->
    <UAlert
      color="white"
      variant="solid"
      icon="i-bxs-award"
      class="bg-[#FF8980]/10 dark:bg-[#FF8980]/15 ring-1 ring-inset ring-[#FF8980]/40 text-gray-900 dark:text-white shadow-none"
      :ui="{ rounded: 'rounded-2xl', padding: 'p-3', gap: 'gap-2.5', title: 'text-sm font-medium leading-snug', icon: { base: 'flex-shrink-0 w-5 h-5 self-center text-[#FF8980]' } }"
    >
      <template #title>
        <span class="flex items-center justify-between gap-2">
          <span>{{ title }}</span>
          <UIcon
            name="i-bx-chevron-right"
            class="h-6 w-6 shrink-0 opacity-0 -translate-x-1 transition group-hover:opacity-80 group-hover:translate-x-0 group-focus-visible:opacity-80 group-focus-visible:translate-x-0"
          />
        </span>
      </template>
    </UAlert>
  </button>
</template>

<script setup lang="ts">
/**
 * Shown at the top of a Teams panel a free church has opened to try (see
 * PREVIEWABLE_ACTIONS in useSubscription), or of a metered one to say how much
 * of the free allowance is left. The whole card opens the upgrade modal. The
 * panel's own Create/Add button is what actually stops them; this only says
 * so up front.
 */
const props = defineProps<{
  /** The action name, so the upgrade modal opens with that feature's copy. */
  feature: string
  /** Omit for a random line from PREVIEW_TITLES, picked once per mount. */
  title?: string
}>()

const PREVIEW_TITLES = [
  "No harm in looking. This one's on Teams.",
  "Just window shopping? This one's on Teams.",
  "You found a Teams feature. Look all you like.",
  "Seek and ye shall find... a Teams feature.",
  "Behold! A Teams feature.",
  "Ask, and it shall be upgraded unto you.",
  "Ooh, fancy. This one's a Teams feature.",
  "Caught you peeking! This is a Teams feature.",
] as const

const randomTitle = pickOne(PREVIEW_TITLES)
const title = computed(() => props.title ?? randomTitle)

const upgrade = () => {
  useGlobalEmit(appWideActions.showUpgradeModal, { feature: props.feature })
  usePosthogCapture("TEAMS_PREVIEW_UPGRADE_CLICKED", { feature: props.feature })
}
</script>

<style scoped>
.cow-teams-preview-notice:hover :deep(> div) {
  filter: brightness(1.06);
}
</style>
