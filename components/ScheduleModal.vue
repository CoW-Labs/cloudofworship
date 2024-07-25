<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[700px]',
      }"
      :prevent-close="true"
      @close="activeSchedule ? emit('close') : null"
    >
      <UCard
        :ui="{
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="font-semibold text-md truncate">
              Projects and Schedule
            </h2>
            <div class="actions flex items-center gap-2">
              <UButton
                icon="i-bx-search"
                v-if="schedules.length > 0"
                color="primary"
                :variant="searchVisible ? 'outline' : 'ghost'"
                @click="
                  () => {
                    searchVisible = !searchVisible
                    if (!searchVisible) {
                      searchInput = ''
                    }
                  }
                "
                >Search</UButton
              >

              <UButton
                icon="i-mdi-close"
                variant="ghost"
                @click="
                  () => {
                    if (activeSchedule) {
                      visible = false
                      emit('close')
                    }
                  }
                "
              ></UButton>
            </div>
          </div>
        </template>
        <div class="search-and-add-content">
          <Transition name="fade-sm">
            <div v-if="searchVisible" class="flex search-input gap-2 mb-4">
              <UFormGroup size="lg" class="w-[100%]">
                <UInput
                  icon="i-bx-search"
                  placeholder="Search for schedules"
                  v-model="searchInput"
                />
              </UFormGroup>
            </div>
          </Transition>
          <UButton
            block
            class="h-[170px] bg-primary-100 dark:bg-primary-300 border border-primary-100 dark:border-primary-500 hover:bg-primary-100 dark:hover:bg-primary-400 hover:border-primary-500 transition-all flex-col gap-4 text-primary-500"
            @click="createNewSchedule()"
          >
            <PlusIcon />
            <div>New Schedule</div>
          </UButton>

          <div class="schedules-ctn mt-6">
            <p class="text-sm text-gray-400">Recent schedules</p>

            <div class="schedules flex-col flex mt-4 h-[40vh] overflow-auto">
              <EmptyState
                v-if="schedules.length === 0"
                icon="i-bx-calendar"
                sub="No schedules yet"
                desc="Click the button above to create a new schedule and start using Cloud of Worship."
                is-wider
              />
              <ScheduleCard
                v-else
                v-for="schedule in searchedSchedules"
                :key="schedule?._id"
                :schedule="schedule"
                @select="(schedule: Schedule) => {
                  appStore.setActiveSchedule(schedule)
                  $emit('close')
                }"
                @delete="deleteSchedule($event)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"
import type { Schedule } from "~/types"

const appStore = useAppStore()
const authStore = useAuthStore()
const { schedules } = storeToRefs(appStore)
const emit = defineEmits(["close"])

const props = defineProps<{
  visible: boolean
  activeSchedule: Schedule
}>()

const visible = ref<boolean>(props.visible)
const searchVisible = ref<boolean>(false)
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
    if (visible.value) {
      retrieveSchedules()
    }
  }
)

const searchedSchedules = computed(() => {
  if (searchInput.value.length === 0) {
    return appStore.schedules
  }
  const tempSchedules = [...appStore.schedules]
  return tempSchedules.filter((schedule) => {
    return schedule.name.toLowerCase().includes(searchInput.value.toLowerCase())
  })
})

const createNewSchedule = () => {
  const scheduleId = useObjectID()
  const schedule: Schedule = {
    _id: scheduleId,
    name: `CoW Untitled Schedule ${appStore.schedules.length + 1}`,
    authorId: authStore?.user?._id as string,
    editorIds: [],
    churchId: authStore?.user?.churchId as string,
    createdAt: new Date().toISOString(),
  }

  // Find all slides without a scheduleId and add the new scheduleId
  appStore.activeSlides.forEach((slide) => {
    if (!slide.scheduleId) {
      slide.scheduleId = scheduleId
    }
  })

  appStore.setActiveSchedule(schedule)

  emit("close")
}

const retrieveSchedules = async () => {
  appStore.setSlidesLoading(true)
  const schedulesPromise = await useAPIFetch(
    `/church/${authStore.user?.churchId}/schedules`
  )
  const schedules = schedulesPromise.data.value as unknown as Schedule[]
  const mergedSchedules = useMergeObjectArray(
    [...schedules],
    appStore.schedules
  )

  mergedSchedules?.sort((scheduleA, scheduleB) => {
    const dateA = new Date(scheduleA?.updatedAt)
    const dateB = new Date(scheduleB?.updatedAt)
    return dateB?.getTime() - dateA?.getTime()
  })
  appStore.setSchedules(mergedSchedules)
  appStore.setSlidesLoading(false)
}

const deleteScheduleOnline = async (scheduleId: string) => {
  const { data, error } = await useAPIFetch(
    `/church/${authStore.user?.churchId}/schedules/${scheduleId}`,
    {
      method: "DELETE",
    }
  )
  if (error.value) {
    throw new Error(error.value?.message)
  }
}

const deleteSchedule = (scheduleId: string) => {
  let updatedScheduleList: Schedule[] = [...appStore.schedules]
  updatedScheduleList = updatedScheduleList.filter(
    (sch) => sch?._id !== scheduleId
  )

  if (scheduleId === appStore.activeSchedule?._id) {
    appStore.setActiveSchedule(updatedScheduleList?.at(-1))
  }
  appStore.setSchedules(updatedScheduleList)

  // TODO: network call to delete schedule on BE
  deleteScheduleOnline(scheduleId)
  useGlobalEmit("delete-schedule-slides", scheduleId)

  emit("close")
}

retrieveSchedules()
</script>
