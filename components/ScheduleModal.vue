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
                v-if="currentState.schedules.length > 0"
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
                @click="closeScheduleModal"
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
          <!-- <UButton
            block
            class="h-[170px] bg-primary-100 dark:bg-primary-300 border border-primary-100 dark:border-primary-500 hover:bg-primary-100 dark:hover:bg-primary-400 hover:border-primary-500 transition-all flex-col gap-4 text-primary-500"
            @click="newScheduleVisible = !newScheduleVisible"
          >
            <PlusIcon />
            <div>New Schedule</div>
          </UButton> -->

          <Transition name="fade-sm">
            <div v-if="newScheduleVisible" class="schedules-ctn mb-8">
              <form
                class="schedules flex items-end overflow-auto gap-2 bg-primary-100 dark:bg-primary-900 p-6 rounded-lg"
                @submit.prevent="createNewSchedule()"
              >
                <UFormGroup
                  label="Create New Schedule"
                  size="lg"
                  class="flex-1"
                >
                  <UInput
                    placeholder="Enter your schedule name"
                    v-model="scheduleName"
                    class="mt-3"
                  />
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Leave field blank to create schedule with name "{{
                      testScheduleName
                    }}"
                  </div>
                </UFormGroup>
                <UButton
                  type="submit"
                  class="h-[40px] mb-6"
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
                v-if="currentState.schedules.length === 0"
                icon="i-bx-calendar"
                sub="No schedules yet"
                desc="Click the button above to create a new schedule and start using Cloud of Worship."
                is-wider
              />
              <ScheduleCard
                v-else
                v-for="schedule in searchedSchedules
                  ?.filter((schedule) => schedule?.name?.trim().length > 0)
                  ?.slice(0, scheduleListLimit)"
                :key="schedule?._id"
                :schedule="schedule"
                @select="(schedule: Schedule) => {
                  appStore.setActiveSchedule(schedule)
                  useGlobalEmit(appWideActions.selectedSchedule, schedule)
                  $emit('close')
                }"
                @delete="deleteSchedule($event)"
              />
              <UButton
                v-if="searchedSchedules?.length > scheduleListLimit"
                variant="ghost"
                trailing-icon="i-bx-chevron-down"
                size="lg"
                class="justify-center mt-4"
                @click="scheduleListLimit += 5"
              >
                See more schedules
              </UButton>
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
import { appWideActions } from "~/utils/constants"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["close"])
const scheduleName = ref<string>("")
const scheduleListLimit = ref<number>(6)
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
const toast = useToast()
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
    if (visible.value) {
      uploadBatchSchedules()
    }
  }
)

const closeScheduleModal = () => {
  if (props.activeSchedule) {
    visible.value = false
    emit("close")
  } else {
    toast.add({
      description: "Please select or create a schedule to continue.",
      icon: "i-bx-info-circle",
    })
  }
}

const searchedSchedules = computed(() => {
  if (searchInput.value.length === 0) {
    return appStore.currentState.schedules
  }
  const tempSchedules = [...appStore.currentState.schedules]
  return tempSchedules?.filter((schedule) => {
    return schedule?.name
      ?.toLowerCase()
      .includes(searchInput.value.toLowerCase())
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
  appStore.currentState.activeSlides.forEach((slide) => {
    if (!slide.scheduleId) {
      slide.scheduleId = scheduleId
    }
  })

  appStore.setActiveSchedule(schedule)
  scheduleName.value = ""

  emit("close")
}

const uploadBatchSchedules = async () => {
  const schedules = appStore.currentState.schedules
  const tempSchedules = schedules?.filter((schedule) => !schedule?.lastUpdated)
  if (tempSchedules.length === 0) {
    retrieveSchedules()
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
    appStore.currentState.schedules
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
  let updatedScheduleList: Schedule[] = [...appStore.currentState.schedules]
  updatedScheduleList = updatedScheduleList.filter(
    (sch) => sch?._id !== scheduleId
  )

  if (scheduleId === appStore.currentState.activeSchedule?._id) {
    appStore.setActiveSchedule(updatedScheduleList?.at(0))
  }
  appStore.setSchedules(updatedScheduleList)

  // TODO: network call to delete schedule on BE
  deleteScheduleOnline(scheduleId)
  useGlobalEmit(appWideActions.deleteScheduleSlides, scheduleId)

  emit("close")
}

retrieveSchedules()
</script>
