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
            @click="newScheduleVisible = !newScheduleVisible"
          >
            <PlusIcon />
            <div>New Schedule</div>
          </UButton>

          <Transition name="fade-sm">
            <div v-if="newScheduleVisible" class="schedules-ctn mt-2 mb-8">
              <form
                class="schedules flex items-end mt-4 overflow-auto gap-2"
                @submit.prevent="createNewSchedule()"
              >
                <UFormGroup label="New Schedule Name" size="lg" class="flex-1">
                  <UInput
                    :placeholder="testScheduleName"
                    v-model="scheduleName"
                  />
                </UFormGroup>
                <UButton
                  type="submit"
                  class="h-[40px]"
                  size="sm"
                  icon="i-bx-save"
                >
                  Save Schedule
                </UButton>
              </form>
            </div>
          </Transition>

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
const scheduleName = ref<string>("")
const testScheduleName = ref<string>(
  `CoW Schedule ${new Date().toLocaleDateString("en-GB")?.replaceAll("/", "-")}`
)

const props = defineProps<{
  visible: boolean
  activeSchedule: Schedule
}>()

const visible = ref<boolean>(props.visible)
const searchVisible = ref<boolean>(false)
const newScheduleVisible = ref<boolean>(true)
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
    if (visible.value) {
      uploadBatchSchedules()
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

const createScheduleOnline = async (schedule: Schedule) => {
  return useAPIFetch(`/church/${authStore.user?.churchId}/schedules`, {
    method: "POST",
    body: schedule,
  })
}

const createNewSchedule = () => {
  const scheduleId = useObjectID()
  const schedule: Schedule = {
    _id: scheduleId,
    name: scheduleName.value?.trim() || testScheduleName.value,
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
  scheduleName.value = ""

  emit("close")
}

const uploadBatchSchedules = async () => {
  const schedules = appStore.schedules
  const tempSchedules = schedules.filter((schedule) => !schedule.lastUpdated)
  if (tempSchedules.length === 0) {
    return
  }
  appStore.setSlidesLoading(true)
  await Promise.all(
    tempSchedules.map((schedule) => createScheduleOnline(schedule))
  )
  appStore.setSlidesLoading(false)
  retrieveSchedules()
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

  mergedSchedules?.sort((scheduleA, scheduleB) => {
    const containsScheduleA = Number(!!scheduleA?.lastUpdated)
    const containsScheduleB = Number(!!scheduleB?.lastUpdated)
    return containsScheduleA - containsScheduleB
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
    appStore.setActiveSchedule(updatedScheduleList?.at(0))
  }
  appStore.setSchedules(updatedScheduleList)

  // TODO: network call to delete schedule on BE
  deleteScheduleOnline(scheduleId)
  useGlobalEmit("delete-schedule-slides", scheduleId)

  emit("close")
}

retrieveSchedules()
</script>
