<template>
  <button
    type="button"
    class="cow-teams-preview-notice block w-full rounded-lg text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    :aria-label="`${title}. Upgrade to Teams`"
    @click="upgrade"
  >
    <UAlert
      color="primary"
      variant="subtle"
      icon="i-bxs-award"
      :ui="{ padding: 'p-3', gap: 'gap-2.5', icon: { base: 'flex-shrink-0 w-5 h-5 self-center' } }"
    >
      <template #title>
        <span class="flex items-center justify-between gap-2">
          <span>{{ title }}</span>
          <UIcon name="i-bx-chevron-right" class="h-4 w-4 shrink-0 opacity-70" />
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
const props = withDefaults(
  defineProps<{
    /** The action name, so the upgrade modal opens with that feature's copy. */
    feature: string
    title?: string
  }>(),
  {
    title: "You're previewing a Teams feature",
  }
)

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
