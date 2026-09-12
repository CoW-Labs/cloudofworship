<template>
  <div
    class="presence-modal w-[260px] overflow-hidden rounded-xl bg-white text-left dark:bg-[#222838]"
  >
    <!-- IDENTITY — one panel for everyone in the service, so a teammate and the
         phone driving this screen read as the same kind of thing. The device
         badge is the half operators actually need: a name on its own reads like
         a normal collaborator, and a collaborator cannot move the congregation
         screen. -->
    <div class="flex items-center gap-2.5 px-4 pb-3 pt-4">
      <div class="relative shrink-0">
        <UAvatar
          :src="avatar"
          :alt="name"
          :text="name?.charAt(0)?.toUpperCase()"
          size="sm"
          :ui="{ text: 'font-semibold' }"
          :style="{
            backgroundColor: `${theme}20`,
            color: theme,
          }"
        />
        <span
          v-if="controlling"
          class="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-white dark:bg-[#222838]"
        >
          <UIcon
            name="i-bx-mobile"
            class="w-3 h-3 text-primary-500 dark:text-primary-400"
          />
        </span>
      </div>
      <div class="min-w-0">
        <h5
          class="truncate text-sm leading-[18px] text-gray-900 dark:text-[#F8F9FB]"
        >
          {{ name }}
        </h5>
        <p class="truncate text-xs leading-4 text-gray-500 dark:text-[#9BA3B2]">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <!-- ACTION — only the person actually driving this output has one. For
         everyone else this stays a presence card rather than growing a control
         that would do nothing. -->
    <div
      v-if="controlling"
      class="border-t border-gray-100 px-4 py-3 dark:border-white/[0.06]"
    >
      <CowButton
        variant="danger"
        size="xs"
        block
        class="!px-3 !py-2 text-xs gap-1.5"
        @click="$emit('stop')"
      >
        <template #leading>
          <IconWrapper name="i-bx-unlink" size="3.5" />
        </template>
        Stop remote control
      </CowButton>
      <p class="mt-2 text-[11px] leading-4 text-gray-500 dark:text-[#9BA3B2]">
        This turns mobile control off for this device. Turn it back on in
        Settings &rarr; Display settings.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Display name of the person. */
    name: string
    avatar?: string
    /** Their presence colour, when they are in the online-users list. */
    theme?: string
    /** They are driving this device's live output from the mobile app. */
    controlling?: boolean
    /** When they joined the schedule, for the "active since" line. */
    joinedAt?: string
  }>(),
  { theme: "#6366f1", controlling: false }
)

defineEmits<{ (e: "stop"): void }>()

// How long they have been in the schedule. Deliberately coarse — the useful
// question is "did they just arrive or have they been here all service", not
// the exact minute.
const joinedLabel = computed(() => {
  if (!props.joinedAt) return "In this schedule"
  const joined = new Date(props.joinedAt).getTime()
  if (Number.isNaN(joined)) return "In this schedule"

  const minutes = Math.floor((Date.now() - joined) / 60000)
  if (minutes < 1) return "Joined just now"
  if (minutes < 60) return `Joined ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Joined ${hours}h ago`
  return `Joined ${Math.floor(hours / 24)}d ago`
})

const subtitle = computed(() =>
  props.controlling ? "Controlling from a mobile device" : joinedLabel.value
)
</script>
