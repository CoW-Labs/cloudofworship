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
            class="grid h-8 w-8 place-items-center rounded-md leading-none hover:bg-gray-100 dark:hover:bg-[#222938] transition-colors"
            @click="closeScheduleModal"
          >
            <UIcon
              name="i-lucide-x"
              class="block h-5 w-5 -translate-y-px text-gray-600 dark:text-[#a7afbd]"
            />
          </button>
        </template>

        <div
          class="schedule-modal-body rounded-2xl bg-gray-50 dark:bg-[#1b212e] p-4"
        >
          <div class="starters-ctn">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-gray-400">Start with a template</p>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <div class="flex flex-col gap-2.5">
                <button
                  class="relative h-[80px] rounded-xl border-2 border-dashed border-gray-200 dark:border-[#2a3244] flex items-center justify-center transition-colors hover:border-primary-500 disabled:cursor-not-allowed"
                  :disabled="!!creatingKey"
                  @click="createBlankSchedule"
                >
                  <PlusIcon />
                  <USkeleton
                    v-if="creatingKey === 'blank'"
                    class="rounded-xl schedule-skeleton"
                    :ui="skeletonUi"
                  />
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
                  class="starter-preset relative h-[80px] rounded-xl bg-cover bg-center ring-2 ring-transparent hover:ring-primary-500 transition-all disabled:cursor-not-allowed"
                  :style="{ backgroundImage: `url(${preset.image})` }"
                  :disabled="!!creatingKey"
                  @click="createFromTemplate(preset)"
                >
                  <USkeleton
                    v-if="creatingKey === preset.key"
                    class="rounded-xl schedule-skeleton"
                    :ui="skeletonUi"
                  />
                </button>
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
            <div class="max-h-[370px] overflow-auto">
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
                @duplicate="duplicateSchedule($event)"
                @rename="renameSchedule"
              />
            </div>
          </div>

        </div>
      </AppSection>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Schedule, ScheduleTemplate } from "~/types"
import { appWideActions } from "~/utils/constants"
import { scheduleTemplates } from "~/utils/scheduleTemplates"
import { escapePriority } from "~/composables/useEscapeKey"

const appStore = useAppStore()
const authStore = useAuthStore()
const { currentState } = storeToRefs(appStore)
const emit = defineEmits(["close"])
const scheduleListLimit = ref<number>(5)

const props = defineProps<{
  visible: boolean
  activeSchedule: Schedule
}>()

const visible = ref<boolean>(props.visible)
const toast = useToast()
const copied = ref<boolean>(false)

// Key of the template currently being created ('blank' or a preset key), used to
// show a per-tile loading state and block concurrent creations.
const creatingKey = ref<string>("")
const starterPresets = scheduleTemplates

// Full-card skeleton overlay shown on the tile being created (matches CowSkeleton).
const skeletonUi = {
  base: "absolute inset-0 overflow-hidden animate-pulse",
  background: "bg-gray-300 dark:bg-gray-600/80",
  rounded: "rounded-xl",
}

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

// `prevent-close` keeps a stray click on the overlay from dismissing the modal,
// which also opts it out of Headless UI's own Escape handling — so wire Escape
// up explicitly. It goes through `closeScheduleModal`, which still refuses to
// close (and says why) until a schedule has been selected or created.
useEscapeKey(
  () => {
    if (!visible.value) return false
    closeScheduleModal()
    return true
  },
  { priority: escapePriority.modal }
)

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

// Returns true (and surfaces the upgrade prompt) when the free-plan schedule
// limit has been reached, so callers should abort.
const isScheduleLimitReached = (): boolean => {
  const { isFreePlan } = useSubscription()
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
    return true
  }
  return false
}

// Create an empty schedule and open it immediately.
const createBlankSchedule = async () => {
  if (creatingKey.value) return
  if (isScheduleLimitReached()) return

  creatingKey.value = "blank"
  try {
    const scheduleId = useObjectID()
    const schedule: Schedule = {
      _id: scheduleId,
      name: "Untitled schedule",
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
    useGlobalEmit(appWideActions.selectedSchedule, schedule)

    usePosthogCapture("SCHEDULE_CREATED", {
      scheduleName: schedule.name,
      hasSlides: appStore.activeSlides.length > 0,
    })
  } finally {
    creatingKey.value = ""
  }

  emit("close")
}

// Create a schedule from a starter template (with its themed slides) and open it.
const createFromTemplate = async (template: ScheduleTemplate) => {
  if (creatingKey.value) return
  if (isScheduleLimitReached()) return

  creatingKey.value = template.key
  try {
    const { createScheduleFromTemplate } = useScheduleTemplates()
    await createScheduleFromTemplate(template)
  } finally {
    creatingKey.value = ""
  }

  emit("close")
}

// Same rename path as the navbar's schedule switcher: update local state first,
// then persist (the API layer queues the request when offline).
const replaceScheduleLocally = (schedule: Schedule) => {
  if (schedule._id === appStore.currentState.activeSchedule?._id) {
    // Also refreshes the entry in currentState.schedules
    appStore.setActiveSchedule(schedule)
    return true
  }

  const updatedScheduleList = [...appStore.currentState.schedules]
  const index = updatedScheduleList.findIndex(
    (item) => item?._id === schedule._id
  )
  if (index === -1) return false

  updatedScheduleList.splice(index, 1, schedule)
  appStore.setSchedules(updatedScheduleList)
  return true
}

const renameSchedule = async (schedule: Schedule, name: string) => {
  const updatedSchedule: Schedule = {
    ...schedule,
    name,
    updatedAt: new Date().toISOString(),
  }

  if (!replaceScheduleLocally(updatedSchedule)) return

  const { updateSchedule } = useSchedules()
  const result = await updateSchedule(schedule._id, { name })
  if (result.status === "failed") {
    const currentSchedule = appStore.currentState.schedules.find(
      (item) => item?._id === schedule._id
    )
    // Do not overwrite a newer rename if this request resolves out of order.
    if (currentSchedule?.name === name) {
      replaceScheduleLocally(schedule)
    }
    return
  }

  usePosthogCapture("SCHEDULE_RENAMED", {
    scheduleId: schedule._id,
    scheduleName: name,
    persistence: result.status,
  })
}

const duplicateSchedule = async (schedule: Schedule) => {
  if (creatingKey.value) return
  if (isScheduleLimitReached()) return

  creatingKey.value = `duplicate-${schedule._id}`
  try {
    const { duplicateSchedule } = useScheduleTemplates()
    await duplicateSchedule(schedule)
  } finally {
    creatingKey.value = ""
  }

  emit("close")
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

<style scoped>
.schedule-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.6),
    transparent
  );
  animation: schedule-skeleton-shimmer 1.3s ease-in-out infinite;
}

html.dark .schedule-skeleton::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.22),
    transparent
  );
}

@keyframes schedule-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
