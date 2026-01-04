<template>
  <button
    class="action-card flex gap-3 p-2 py-4 border-t first:border-t-0 border-gray-100 dark:border-primary-950 hover:rounded-md hover:bg-primary-50 dark:hover:bg-primary-800 transition-all cursor-pointer text-left w-[100%]"
    :class="{ 'pointer-events-none opacity-30': action?.unreleased }"
    @click="handleActionClick"
  >
    <div class="icon-ctn relative">
      <IconWrapper
        :name="action?.icon"
        class="mt-1 text-primary dark:text-primary-300"
        rounded-bg
      />
      <IconWrapper
        v-if="showTeamsBadge"
        name="i-bxs-award"
        class="inline-flex w-8 h-8 text-xs -bottom-2.5 -right-3.5 text-[#FF8980] absolute"
      />
    </div>
    <div class="texts">
      <h4 v-if="action?.searchableOnly">
        <span class="font-light italic pr-1 capitalize">
          {{ action?.type || "Action" }}:
        </span>
        <span class="font-semibold">
          {{ action?.name || "" }}
          <span v-if="action?.type === slideTypes.bible">{{
            action?.bibleChapterAndVerse || ""
          }}</span>
        </span>
      </h4>
      <h4 v-else class="font-semibold">
        {{ action?.name || "" }}
      </h4>
      <p class="font-light text-xs mt-1">{{ action?.desc || "" }}</p>
    </div>
  </button>
</template>
<script setup lang="ts">
import type { QuickAction } from "~/types"

const props = defineProps<{
  action: QuickAction
  actionSuffix?: String
}>()

const { requiresTeams, hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")
const emitter = useNuxtApp().$emitter as any

const emitParameter = computed(() => {
  switch (props.action?.type) {
    case slideTypes.bible:
      return props.action?.bibleChapterAndVerse
        ? `${props.action?.bibleBookIndex}:${props.action?.bibleChapterAndVerse}`
        : ""
    case slideTypes.hymn:
      return `${props.action?.hymnIndex}`
    default:
      return ""
  }
})

// Show teams badge if the action requires teams subscription
const showTeamsBadge = computed(() => {
  return (
    requiresTeams(props.action?.action || "") &&
    isPremiumFeatureEnabled.value &&
    !hasAccessToFeature(props.action?.action || "")
  )
})

const handleActionClick = () => {
  const actionName = props.action?.action || ""

  // Check if user has access to this feature
  if (!hasAccessToFeature(actionName) && isPremiumFeatureEnabled.value) {
    // Show upgrade modal instead of executing the action
    emitter.emit("show-upgrade-modal")
    usePosthogCapture("TEAMS_FEATURE_BLOCKED", {
      feature: actionName,
      action: props.action?.action,
    })
    return
  }

  // Execute the action normally
  useGlobalEmit(
    `${props.action?.action}${
      props.actionSuffix ? `-${props.actionSuffix}` : ""
    }`,
    emitParameter.value
  )
}
</script>

<style scoped></style>
