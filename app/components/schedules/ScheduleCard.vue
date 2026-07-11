<template>
  <UButton
    variant="ghost"
    class="schedule-card group flex items-center justify-between border-b border-gray-100 w-full dark:border-[#202838] py-3 last:border-0 text-black dark:text-white"
    @click="$emit('select', schedule)"
  >
    <div class="flex items-center gap-3 min-w-0">
      <UAvatar
        :text="scheduleAuthor?.fullname?.split(' ')?.[0]?.[0]"
        :src="scheduleAuthor?.avatar"
        size="lg"
        :ui="{
          text: `text-[${scheduleAuthor?.theme}] dark:text-[${scheduleAuthor?.theme}] font-semibold`,
        }"
        :class="`shrink-0 dark:border border-[${scheduleAuthor?.theme}] bg-[${scheduleAuthor?.theme}20] dark:bg-[${scheduleAuthor?.theme}20]`"
      />
      <div class="title-and-date min-w-0 text-start">
        <div class="title font-medium flex items-center gap-2 truncate">
          {{ schedule?.name }}
          <UTooltip v-if="!schedule?.lastUpdated" text="Offline. Yet to sync">
            <Icon name="i-tabler-cloud-off" class="w-4 h-4 text-gray-500" />
          </UTooltip>
        </div>
        <span class="text-xs text-gray-500 mt-0.5 block"
          >Created
          {{ format(new Date(schedule?.updatedAt as string).getTime()) }}</span
        >
      </div>
    </div>
    <div class="col-2 flex items-center gap-4">
      <div
        class="more-ctn w-[50px] flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <UPopover
          :ui="{
            ring: 'ring-0',
            background: 'bg-white dark-bg-gray-900 border-0',
          }"
        >
          <UButton
            variant="ghost"
            icon="i-bx-dots-vertical-rounded"
            color="gray"
            class="p-1"
          >
          </UButton>
          <template #panel>
            <div class="more-modal flex flex-col p-2 gap-1 min-w-[120px]">
              <ConfirmDialog
                button-label="Delete"
                button-icon="i-bx-trash"
                button-color="red"
                button-variant="ghost"
                button-size="sm"
                no-tooltip
                header="Delete schedule"
                button-styles="justify-start"
                label="Are you sure you want to delete this schedule and all it's slides? This process is irreversible."
                @confirm="$emit('delete', schedule?._id)"
              />
              <UButton
                variant="ghost"
                color="gray"
                icon="i-bx-copy"
                class="justify-start"
                disabled
                size="sm"
                block
                @click="duplicateSchedule()"
              >
                Duplicate
              </UButton>
            </div>
          </template>
        </UPopover>
      </div>
    </div>
  </UButton>
</template>
<script setup lang="ts">
import type { Schedule } from "~/types"
import type { User } from "~/store/auth"
import { format } from "timeago.js"
import { useAuthStore } from "~/store/auth"

const props = defineProps<{
  schedule: Schedule
}>()

const authStore = useAuthStore()

const scheduleAuthor = computed(() => {
  if (props.schedule?.authorId) {
    return authStore.church?.users?.find(
      (user) => user._id === props.schedule?.authorId
    )
  }
  return null
})

const duplicateSchedule = () => {}
</script>
