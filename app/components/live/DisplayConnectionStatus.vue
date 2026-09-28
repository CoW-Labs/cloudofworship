<template>
  <!-- Always mounted, even while connected: a live region has to be in the page
       before its text changes for a screen reader to announce the change. -->
  <div
    role="status"
    aria-live="polite"
    class="pointer-events-none fixed right-4 z-50"
    :class="belowBanner ? 'top-[88px]' : 'top-4'"
  >
    <UBadge
      v-if="status !== 'connected'"
      size="lg"
      :ui="{ rounded: 'rounded-full' }"
      class="gap-2 px-4 py-2 text-sm font-medium shadow-lg"
      :class="
        status === 'failed'
          ? 'bg-red-500 text-white'
          : 'bg-primary-200 text-primary-800'
      "
    >
      <span
        v-if="status !== 'failed'"
        class="h-2 w-2 animate-pulse rounded-full bg-primary-800"
        aria-hidden="true"
      />
      {{ label }}
    </UBadge>
  </div>
</template>

<script setup lang="ts">
/**
 * Connection state for the public viewer pages — `/livestream/:schedule_id`
 * and `/stagestream/:schedule_id`. Everything on those screens arrives over the
 * network, so a dropped connection means what is showing may already be out of
 * date, and whoever is looking at it needs to know.
 *
 * Hidden while connected. Never shown on `/live` or `/stage`, which read the
 * operator's own browser and have no connection to lose.
 */
const props = defineProps<{
  status: "connecting" | "connected" | "disconnected" | "failed"
  /** Sit under a `DisplayWindowBanner` instead of over it. */
  belowBanner?: boolean
}>()

const label = computed(() =>
  props.status === "connecting"
    ? "Connecting..."
    : props.status === "disconnected"
    ? "Reconnecting..."
    : props.status === "failed"
    ? "Connection lost. Reload to try again."
    : ""
)
</script>
