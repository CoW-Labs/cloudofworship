import { useAuthStore } from '~/store/auth'
import { useAppStore } from '~/store/app'
import type { Schedule, Slide } from '~/types'

export default function useSchedules() {
  const authStore = useAuthStore()
  const appStore = useAppStore()
  const toast = useToast()
  const churchId = authStore.user?.churchId

  // Reactive loading state
  const loading = ref<boolean>(false)

  /**
   * Create a new schedule online
   */
  const createSchedule = async (schedule: Schedule): Promise<Schedule | null> => {
    try {
      loading.value = true
      const { data, error } = await useAPIFetch(`/church/${churchId}/schedules`, {
        method: 'POST',
        body: schedule,
        key: 'create-schedule',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to create schedule')
      }

      const createdSchedule = data.value as Schedule
      appStore.setActiveSchedule(createdSchedule)
      appStore.setLastSynced(new Date().toISOString())

      return createdSchedule
    } catch (error: any) {
      console.error('Error creating schedule:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to create schedule',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all schedules for the church
   */
  const fetchSchedules = async (): Promise<Schedule[]> => {
    try {
      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules`,
        {
          method: 'GET',
          key: 'get-schedules',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch schedules')
      }

      const schedules = data.value as Schedule[]

      // Merge with local schedules
      const mergedSchedules = useMergeObjectArray(
        [...schedules],
        appStore.currentState.schedules
      )

      // Sort by updated date
      mergedSchedules?.sort((a, b) => {
        const dateA = new Date(a?.updatedAt || a?.createdAt || 0)
        const dateB = new Date(b?.updatedAt || b?.createdAt || 0)
        return dateB?.getTime() - dateA?.getTime()
      })

      // Sort by sync status (unsynced first)
      mergedSchedules?.sort((a, b) => {
        const hasLastUpdatedA = Number(!!a?.lastUpdated)
        const hasLastUpdatedB = Number(!!b?.lastUpdated)
        return hasLastUpdatedA - hasLastUpdatedB
      })

      appStore.setSchedules(mergedSchedules)
      return mergedSchedules
    } catch (error: any) {
      console.error('Error fetching schedules:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch schedules',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a schedule
   */
  const updateSchedule = async (
    scheduleId: string,
    updateData: Partial<Schedule>
  ): Promise<Schedule | null> => {
    try {
      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${scheduleId}`,
        {
          method: 'PUT',
          body: updateData,
          key: 'update-schedule',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to update schedule')
      }

      const updatedSchedule = data.value as Schedule
      appStore.setLastSynced(new Date().toISOString())

      return updatedSchedule
    } catch (error: any) {
      console.error('Error updating schedule:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to update schedule',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a schedule
   */
  const deleteSchedule = async (scheduleId: string): Promise<boolean> => {
    try {
      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${scheduleId}`,
        {
          method: 'DELETE',
          key: 'delete-schedule',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to delete schedule')
      }

      // Remove from local state
      let updatedScheduleList = [...appStore.currentState.schedules]
      updatedScheduleList = updatedScheduleList.filter(
        (sch) => sch?._id !== scheduleId
      )

      // If deleted schedule was active, switch to first available
      if (scheduleId === appStore.currentState.activeSchedule?._id) {
        appStore.setActiveSchedule(updatedScheduleList?.at(0)!)
      }

      appStore.setSchedules(updatedScheduleList)
      appStore.setLastSynced(new Date().toISOString())

      toast.add({
        icon: 'i-tabler-trash',
        title: 'Schedule deleted successfully'
      })

      return true
    } catch (error: any) {
      console.error('Error deleting schedule:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete schedule',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Batch upload schedules that haven't been synced
   */
  const batchUploadSchedules = async (): Promise<void> => {
    const schedules = appStore.currentState.schedules
    const unsyncedSchedules = schedules?.filter((schedule) => !schedule?.lastUpdated)

    if (unsyncedSchedules.length === 0) {
      await fetchSchedules()
      return
    }

    try {
      loading.value = true
      await Promise.all(
        unsyncedSchedules.map((schedule) => createSchedule(schedule))
      )
      await fetchSchedules()
    } catch (error: any) {
      console.error('Error batch uploading schedules:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to upload schedules',
        description: error.message,
        color: 'red',
      })
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a single schedule by ID
   */
  const getScheduleById = async (scheduleId: string): Promise<Schedule | null> => {
    try {
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${scheduleId}`,
        {
          method: 'GET',
          key: `get-schedule-${scheduleId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch schedule')
      }

      return data.value as Schedule
    } catch (error: any) {
      console.error('Error fetching schedule:', error)
      return null
    }
  }

  /**
   * Fetch slides for a specific schedule
   */
  const fetchScheduleSlides = async (scheduleId: string): Promise<Slide[]> => {
    try {
      loading.value = true
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${scheduleId}/slides`,
        {
          method: 'GET',
          key: `get-schedule-slides-${scheduleId}`,
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch slides')
      }

      return data.value as Slide[]
    } catch (error: any) {
      console.error('Error fetching schedule slides:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to fetch slides',
        description: error.message,
        color: 'red',
      })
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    createSchedule,
    fetchSchedules,
    updateSchedule,
    deleteSchedule,
    batchUploadSchedules,
    getScheduleById,
    fetchScheduleSlides,
  }
}
