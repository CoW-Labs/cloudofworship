<template>
  <div class="schedules-list-main h-[100%] flex flex-col relative">
    <div
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2 come-up-1">
        <UInput
          placeholder="Search all schedules"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
        >
          <template #leading>
            <SearchIcon class="w-4 h-4 text-gray-400 dark:text-[#9aa3b2]" />
          </template>
        </UInput>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-2.5 !py-0 max-h-[40px] rounded-lg"
          @click="$emit('close')"
        >
          <CloseIcon class="w-4 h-4" />
        </CowButton>
      </div>

      <div
        class="actions-ctn -mx-1.5 mt-1.5 overflow-x-hidden flex-1 min-h-0 come-up-1"
      >
        <EmptyState
          v-if="filteredSchedules.length === 0"
          icon="i-tabler-database-search"
          :sub="
            searchInput.length >= 2
              ? `We couldn't find a schedule matching your query`
              : 'No schedules yet.'
          "
        />
        <RecycleScroller
          v-else
          class="h-full"
          :items="filteredSchedules"
          :item-size="78"
          key-field="_id"
          v-slot="{ item: schedule }"
        >
          <ScheduleCard
            :key="schedule._id"
            :schedule="schedule"
            @select="selectSchedule"
            @delete="deleteSchedule($event)"
          />
        </RecycleScroller>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Schedule } from "~/types"
import { appWideActions } from "~/utils/constants"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const emit = defineEmits(["close"])

const searchInput = ref<string>("")

const allSchedules = computed(() => {
  return (
    currentState.value.schedules?.filter(
      (schedule) => schedule?.name?.trim().length > 0
    ) || []
  )
})

const filteredSchedules = computed(() => {
  if (searchInput.value.length < 2) return allSchedules.value
  const query = searchInput.value.trim().toLowerCase()
  return allSchedules.value.filter((schedule) =>
    schedule?.name?.toLowerCase().includes(query)
  )
})

const selectSchedule = (schedule: Schedule) => {
  appStore.setActiveSchedule(schedule)
  useGlobalEmit(appWideActions.selectedSchedule, schedule)
  usePosthogCapture("SCHEDULE_SELECTED", {
    scheduleName: schedule.name,
    scheduleId: schedule._id,
  })
  emit("close")
}

const deleteSchedule = (scheduleId: string) => {
  let updatedScheduleList: Schedule[] = [...appStore.currentState.schedules]
  updatedScheduleList = updatedScheduleList.filter(
    (sch) => sch?._id !== scheduleId
  )

  if (scheduleId === appStore.currentState.activeSchedule?._id) {
    appStore.setActiveSchedule(updatedScheduleList?.at(0)!!)
    useGlobalEmit(appWideActions.selectedSchedule, null)
  }
  appStore.setSchedules(updatedScheduleList)

  const { deleteSchedule: deleteScheduleComposable } = useSchedules()
  deleteScheduleComposable(scheduleId)
  useGlobalEmit(appWideActions.deleteScheduleSlides, scheduleId)
}
</script>
