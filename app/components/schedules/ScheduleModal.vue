<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :prevent-close="true"
      :ui="{
        base: 'min-w-[570px] max-w-[570px]',
        background: 'bg-transparent dark:bg-transparent',
        ring: '',
        rounded: 'rounded-2xl',
        shadow: 'shadow-none',
        overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
      }"
      @close="activeSchedule ? emit('close') : null"
    >
      <AppSection
        heading="Create a schedule"
        heading-styles="text-lg font-semibold"
      >
        <template #actions>
          <button
            class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#222938] transition-colors"
            @click="closeScheduleModal"
          >
            <IconWrapper
              name="i-mdi-close"
              class="w-4 h-4 text-gray-600 dark:text-[#a7afbd]"
            />
          </button>
        </template>

        <div
          class="schedule-modal-body rounded-2xl bg-gray-50 dark:bg-[#1b212e] p-4"
        >
          <CowInput v-model="scheduleName" label="Schedule name" />
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Leave field blank to use default title
          </div>

          <div class="starters-ctn mt-6">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-gray-400">Start with a template</p>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <div class="flex flex-col gap-2.5">
                <button
                  class="h-[80px] rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2a3244] flex items-center justify-center transition-colors"
                  @click="selectedStarter = 'blank'"
                >
                  <PlusIcon />
                </button>
                <span
                  class="text-sm text-center text-gray-500 dark:text-gray-400"
                >
                  Start from blank
                </span>
              </div>
              <div
                v-for="preset in starterPresets"
                :key="preset.key"
                class="flex flex-col gap-2.5"
              >
                <button
                  class="starter-preset h-[80px] rounded-xl bg-cover bg-center ring-2 transition-all"
                  :class="
                    selectedStarter === preset.key
                      ? 'ring-primary-500'
                      : 'ring-transparent'
                  "
                  :style="{ backgroundImage: `url(${preset.image})` }"
                  @click="selectedStarter = preset.key"
                ></button>
                <span
                  class="text-sm text-center text-gray-500 dark:text-gray-400 truncate"
                >
                  {{ preset.label }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="recentSchedules.length > 0"
            class="recent-schedules-ctn mt-6"
          >
            <div class="flex items-center justify-between mb-1">
              <p class="text-sm text-gray-400">Recent Schedules</p>
              <span
                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
                @click="openAllSchedules"
              >
                See all
              </span>
            </div>
            <div class="max-h-[300px] overflow-auto">
              <ScheduleCard
                v-for="schedule in recentSchedules.slice(0, scheduleListLimit)"
                :key="schedule?._id"
                :schedule="schedule"
                @select="(schedule: Schedule) => {
                  appStore.setActiveSchedule(schedule)
                  useGlobalEmit(appWideActions.selectedSchedule, schedule)
                  usePosthogCapture('SCHEDULE_SELECTED', {
                    scheduleName: schedule.name,
                    scheduleId: schedule._id,
                  })
                  $emit('close')
                }"
                @delete="deleteSchedule($event)"
              />
            </div>
          </div>

          <div class="footer-actions flex justify-end gap-3 mt-8">
            <CowButton
              variant="secondary"
              class="min-w-[130px]"
              @click="closeScheduleModal"
            >
              Cancel
            </CowButton>
            <CowButton
              variant="primary"
              class="min-w-[130px]"
              @click="createNewSchedule"
            >
              Save
            </CowButton>
          </div>
        </div>
      </AppSection>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Schedule } from "~/types"
import { appWideActions } from "~/utils/constants"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["close"])
const scheduleName = ref<string>("")
const scheduleListLimit = ref<number>(5)
const testScheduleName = ref<string>(
  `CoW Schedule ${new Date().toLocaleDateString("en-GB")?.replaceAll("/", "-")}`
)

const props = defineProps<{
  visible: boolean
  activeSchedule: Schedule
}>()

const visible = ref<boolean>(props.visible)
const toast = useToast()
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

const selectedStarter = ref<string>("blank")
const starterPresets = [
  {
    key: "regular-sunday",
    label: "Regular Sunday",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
  },
  {
    key: "communion",
    label: "Communion Service",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600",
  },
  {
    key: "christmas",
    label: "Christmas Schedule",
    image:
      "https://images.unsplash.com/photo-1512389142860-9c449e58a543?q=80&w=600",
  },
]

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

const openAllSchedules = () => {
  useGlobalEmit(appWideActions.newSchedulesList)
  emit("close")
}

const recentSchedules = computed(() => {
  return (
    currentState.value.schedules?.filter(
      (schedule) => schedule?.name?.trim().length > 0
    ) || []
  )
})

const createScheduleOnline = async (schedule: Schedule) => {
  const { createSchedule } = useSchedules()
  return createSchedule(schedule)
}

const createNewSchedule = () => {
  // Check subscription limits for free users
  const { hasAccessToFeature, isFreePlan } = useSubscription()
  const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")

  const scheduleCount = appStore.currentState.schedules.length

  if (isFreePlan.value && scheduleCount >= 5 && isPremiumFeatureEnabled.value) {
    useGlobalEmit("show-upgrade-modal")
    usePosthogCapture("UPGRADE_PROMPT_SHOWN", {
      feature: "Create Schedule",
      location: "schedule_modal",
      currentCount: scheduleCount,
      limit: 5,
    })
    useToast().add({
      icon: "i-heroicons-exclamation-triangle",
      title: "Schedule Limit Reached",
      description:
        "Free plan allows up to 5 schedules. Upgrade to create unlimited schedules.",
      color: "orange",
    })
    return
  }

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
  useGlobalEmit(appWideActions.selectedSchedule, schedule)
  scheduleName.value = ""

  emit("close")

  // Track schedule creation
  usePosthogCapture("SCHEDULE_CREATED", {
    scheduleName: schedule.name,
    hasSlides: appStore.currentState.activeSlides.length > 0,
  })
}

const uploadBatchSchedules = async () => {
  const { batchUploadSchedules } = useSchedules()
  await batchUploadSchedules()
}

const retrieveSchedules = async () => {
  const { fetchSchedules } = useSchedules()
  await fetchSchedules()
}

const deleteScheduleOnline = async (scheduleId: string) => {
  const { deleteSchedule: deleteScheduleComposable } = useSchedules()
  await deleteScheduleComposable(scheduleId)
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

  // TODO: network call to delete schedule on BE
  deleteScheduleOnline(scheduleId)
  useGlobalEmit(appWideActions.deleteScheduleSlides, scheduleId)

  emit("close")
}

retrieveSchedules()
</script>
