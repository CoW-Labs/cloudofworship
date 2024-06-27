<template>
  <div
    class="schedule-card flex items-center justify-between border-b border-gray-100 pb-4 last:border-0"
  >
    <div class="title-and-date">
      <div class="title font-medium">Father’s Day Sunday - A lovely father</div>
      <div class="flex items-center gap-2 mt-1">
        <UAvatar
          alt="Favour Felix"
          size="xs"
          class="border-primary-500 relative l-[20px]"
          :ui="{
            background: 'bg-primary-100 ring-0',
            wrapper: 'bg-red-500',
          }"
        />
        <span class="text-sm text-gray-500">Updated 4 days ago</span>
      </div>
    </div>
    <div class="col-2 flex items-center gap-4">
      <div class="editors w-[130px]">
        <UAvatarGroup class="mb-2" max="3" size="sm">
          <UAvatar
            alt="Favour Felix"
            class="border-primary-500 relative l-[20px]"
            :ui="{
              background: 'bg-primary-100 ring-0',
              wrapper: 'bg-red-500',
            }"
          />
          <UAvatar
            alt="John Felix"
            class="border-primary-500 relative l-[20px]"
            :ui="{
              background: 'bg-primary-100 ring-0',
              wrapper: 'bg-red-500',
            }"
          />
          <UAvatar
            alt="Favour Felix"
            class="border-primary-500 relative l-[20px]"
            :ui="{
              background: 'bg-primary-100 ring-0',
              wrapper: 'bg-red-500',
            }"
          />
          <UAvatar
            alt="John Felix"
            class="border-primary-500 relative l-[20px]"
            :ui="{
              background: 'bg-primary-100 ring-0',
              wrapper: 'bg-red-500',
            }"
          />
        </UAvatarGroup>
      </div>
      <div class="more-ctn w-[50px] flex justify-end">
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
                label="Are you sure you want to delete this schedule? This process is irreversible."
                @confirm="deleteSchedule()"
              />
              <UButton
                variant="ghost"
                color="gray"
                icon="i-bx-copy"
                class="justify-start"
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
  </div>
</template>
<script setup lang="ts">
import type { Schedule } from "~/types"

const props = defineProps<{
  schedule: Schedule
}>()

const duplicateSchedule = () => {}

const deleteSchedule = () => {}
</script>
