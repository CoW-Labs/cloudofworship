<template>
  <UAlert
    color="primary"
    variant="subtle"
    icon="i-bxs-award"
    :title="title"
    :description="description"
    :actions="[
      {
        label: actionLabel,
        color: 'primary',
        variant: 'solid',
        size: 'xs',
        click: upgrade,
      },
    ]"
    :ui="{
      padding: 'p-3',
      gap: 'gap-2.5',
      description: 'mt-1 text-xs leading-4 opacity-90',
      actions: 'flex items-center gap-2 mt-2.5 flex-shrink-0',
    }"
  />
</template>

<script setup lang="ts">
/**
 * Shown at the top of a Teams panel a free church has opened to try (see
 * PREVIEWABLE_ACTIONS in useSubscription), or of a metered one to say how much
 * of the free allowance is left. The panel's own Create/Add button is what
 * actually stops them; this only says so up front.
 */
const props = withDefaults(
  defineProps<{
    /** The action name, so the upgrade modal opens with that feature's copy. */
    feature: string
    title?: string
    description?: string
    actionLabel?: string
  }>(),
  {
    title: "You're previewing a Teams feature",
    description:
      "Try it out here. Upgrade to Teams when you're ready to use it in your service.",
    actionLabel: "Upgrade to Teams",
  }
)

const upgrade = () => {
  useGlobalEmit(appWideActions.showUpgradeModal, { feature: props.feature })
  usePosthogCapture("TEAMS_PREVIEW_UPGRADE_CLICKED", { feature: props.feature })
}
</script>
