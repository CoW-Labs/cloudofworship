<template>
  <UButton
    variant="ghost"
    :as="isRenaming ? 'div' : 'button'"
    class="schedule-card group flex items-center justify-between border-b border-gray-100 w-full dark:border-[#202838] py-3 last:border-0 text-black dark:text-white transition-colors hover:!bg-white dark:hover:!bg-[#2b3242]"
    @click="!isRenaming && $emit('select', schedule)"
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
          <input
            v-if="isRenaming"
            ref="renameInput"
            v-model="nameDraft"
            class="rename-input min-w-0 w-[220px] bg-transparent border-b border-gray-300 dark:border-[#2a3244] outline-none"
            type="text"
            @click.stop
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename"
          />
          <template v-else>{{ schedule?.name }}</template>
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
        :class="{ '!opacity-100': moreMenuOpen }"
      >
        <MoreActionsMenu
          v-slot="{ close }"
          flush
          @update:open="moreMenuOpen = $event"
        >
          <UButton
            variant="ghost"
            color="gray"
            block
            @click.stop.prevent="
              () => {
                close()
                startRename()
              }
            "
          >
            <template #leading><EditIcon class="w-4 h-4" /></template>
            Rename
          </UButton>
          <UButton
            variant="ghost"
            color="gray"
            block
            @click.stop.prevent="
              () => {
                duplicateSchedule()
                close()
              }
            "
          >
            <template #leading><CopyIcon class="w-4 h-4" /></template>
            Duplicate
          </UButton>
          <ConfirmDialog
            button-label="Delete"
            button-icon="i-bx-trash"
            button-color="red"
            button-variant="ghost"
            no-tooltip
            header="Delete schedule"
            button-styles="more-item-danger"
            label="Are you sure you want to delete this schedule and all it's slides? This process is irreversible."
            @confirm="
              () => {
                $emit('delete', schedule?._id)
                close()
              }
            "
          >
            <template #icon><DeleteIcon class="w-4 h-4" /></template>
          </ConfirmDialog>
        </MoreActionsMenu>
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

const emit = defineEmits<{
  select: [schedule: Schedule]
  delete: [scheduleId: string]
  duplicate: [schedule: Schedule]
  rename: [schedule: Schedule, name: string]
}>()

const authStore = useAuthStore()

const moreMenuOpen = ref(false)

// Inline rename, mirroring the navbar's schedule switcher: the title turns into
// an input, Enter/blur commits, Escape discards.
const isRenaming = ref(false)
const nameDraft = ref("")
const renameInput = ref<HTMLInputElement | null>(null)

const startRename = async () => {
  nameDraft.value = props.schedule?.name || ""
  isRenaming.value = true
  await nextTick()
  // Focus after the menu has finished restoring focus to its trigger, otherwise
  // that restore steals it back and the input blurs itself shut.
  setTimeout(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  }, 80)
}

const cancelRename = () => {
  isRenaming.value = false
}

const commitRename = () => {
  if (!isRenaming.value) return
  isRenaming.value = false

  const name = nameDraft.value.trim()
  if (!name || name === props.schedule?.name) return
  emit("rename", props.schedule, name)
}

const scheduleAuthor = computed(() => {
  if (props.schedule?.authorId) {
    return authStore.church?.users?.find(
      (user) => user._id === props.schedule?.authorId
    )
  }
  return null
})

const duplicateSchedule = () => {
  emit("duplicate", props.schedule)
}
</script>
