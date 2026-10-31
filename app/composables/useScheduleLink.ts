import { useOnline } from "@vueuse/core"
import type { Schedule } from "~/types"
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"

/**
 * Schedule links — `<app>/?schedule=<id>` — open the exact same schedule, and
 * its slides, on another computer signed in to the same church.
 *
 * Access needs no check of its own: the API only lists a church's own
 * schedules, so a link resolves only for someone who could already open it
 * from their schedule list.
 */

const SCHEDULE_QUERY_KEY = "schedule"
const PENDING_STORAGE_KEY = "pending_schedule_link"
const OBJECT_ID = /^[a-f\d]{24}$/i

/**
 * The web origin a link can be opened from. Packaged desktop origins only exist
 * on this machine; browser previews and localhost development keep their own.
 */
export const shareableAppOrigin = (appUrl: string) => {
  const { origin } = window.location
  const isWebOrigin =
    /^https?:\/\//.test(origin) &&
    !/^https?:\/\/tauri\.localhost(?::\d+)?$/.test(origin)
  return (isWebOrigin ? origin : appUrl).replace(/\/+$/, "")
}

export const isScheduleId = (value: unknown): value is string =>
  typeof value === "string" && OBJECT_ID.test(value)

/** The schedule id a pasted schedule link carries, or null when it is not one. */
export const scheduleIdFromLink = (text: string, appUrl: string) => {
  const trimmed = text.trim()
  // Runs on every paste, so reject anything that cannot be a link cheaply.
  if (trimmed.length > 300 || !trimmed.includes(`${SCHEDULE_QUERY_KEY}=`)) {
    return null
  }

  try {
    const url = new URL(trimmed)
    const hosts = [window.location.host, new URL(appUrl).host]
    if (!hosts.includes(url.host) || url.pathname.replace(/\/+$/, "")) {
      return null
    }
    const scheduleId = url.searchParams.get(SCHEDULE_QUERY_KEY)
    return isScheduleId(scheduleId) ? scheduleId : null
  } catch {
    return null
  }
}

/**
 * Signed-out visitors are sent to /login, which drops the query. Holding the id
 * for the tab lets the link still open once they have signed in.
 */
export const rememberScheduleLink = (scheduleId: string) => {
  try {
    sessionStorage.setItem(PENDING_STORAGE_KEY, scheduleId)
  } catch {
    // sessionStorage unavailable (private mode / SecurityError)
  }
}

const takeRememberedScheduleLink = () => {
  try {
    const scheduleId = sessionStorage.getItem(PENDING_STORAGE_KEY)
    sessionStorage.removeItem(PENDING_STORAGE_KEY)
    return isScheduleId(scheduleId) ? scheduleId : null
  } catch {
    return null
  }
}

export const useScheduleLink = () => {
  const appStore = useAppStore()
  const toast = useToast()
  const online = useOnline()
  const route = useRoute()
  const router = useRouter()
  const appUrl = useRuntimeConfig().public.APP_URL as string
  const { fetchSchedules } = useSchedules()

  const scheduleLink = (schedule: Schedule) =>
    `${shareableAppOrigin(appUrl)}/?${SCHEDULE_QUERY_KEY}=${schedule._id}`

  const copyScheduleLink = async (schedule: Schedule) => {
    try {
      await navigator.clipboard.writeText(scheduleLink(schedule))
    } catch {
      toast.add({
        title: "Couldn't copy the link",
        description: "Your browser blocked clipboard access.",
        color: "red",
        icon: "i-bx-error-circle",
      })
      return
    }

    toast.add({
      title: "Schedule link copied",
      // Unsynced schedules are not on the server yet, so no other computer
      // can find them until they are.
      description: schedule.lastUpdated
        ? "Paste it on another computer to open this schedule."
        : "It opens on other computers once this schedule syncs.",
      color: "green",
      icon: "i-bx-check-circle",
    })
    usePosthogCapture("SCHEDULE_LINK_COPIED", {
      scheduleId: schedule._id,
      scheduleName: schedule.name,
    })
  }

  const findSchedule = (scheduleId: string) =>
    appStore.currentState.schedules.find((item) => item?._id === scheduleId)

  /**
   * The linked schedule, from the list already in memory. Only a miss costs a
   * request: the schedule may have been made after this list was fetched.
   */
  const resolveLinkedSchedule = async (
    scheduleId: string,
    { refresh = true } = {}
  ) => {
    let schedule = findSchedule(scheduleId)
    if (!schedule && refresh && online.value) {
      await fetchSchedules()
      schedule = findSchedule(scheduleId)
    }

    if (!schedule) {
      toast.add({
        title: "Couldn't open that schedule",
        description: online.value
          ? "It may have been deleted, or it belongs to another church."
          : "Connect to the internet to open it.",
        color: "orange",
        icon: "i-heroicons-exclamation-triangle",
      })
    }
    return schedule ?? null
  }

  /** Switches the workspace to the linked schedule, as picking it would. */
  const openLinkedSchedule = async (scheduleId: string) => {
    if (appStore.currentState.activeSchedule?._id === scheduleId) {
      toast.add({
        title: "That schedule is already open",
        icon: "i-bx-info-circle",
      })
      return true
    }

    const schedule = await resolveLinkedSchedule(scheduleId)
    if (!schedule) return false

    appStore.setActiveSchedule(schedule)
    useGlobalEmit(appWideActions.selectedSchedule, schedule)
    usePosthogCapture("SCHEDULE_OPENED_FROM_LINK", {
      scheduleId: schedule._id,
      scheduleName: schedule.name,
      source: "paste",
    })
    return true
  }

  /**
   * The schedule id the app was opened with, from the URL or held across
   * sign-in. The query is consumed so a reload, after switching away, does
   * not jump back to the linked schedule.
   */
  const takeOpeningScheduleLink = () => {
    const { [SCHEDULE_QUERY_KEY]: fromQuery, ...restQuery } = route.query
    if (fromQuery !== undefined) router.replace({ query: restQuery })
    const remembered = takeRememberedScheduleLink()
    return isScheduleId(fromQuery) ? fromQuery : remembered
  }

  /** Opens a schedule link pasted anywhere outside a text editor. */
  const onSchedulePaste = (event: ClipboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest?.("textarea, [contenteditable]:not([contenteditable='false'])")) {
      return
    }

    const text = event.clipboardData?.getData("text/plain")
    const scheduleId = text ? scheduleIdFromLink(text, appUrl) : null
    if (!scheduleId) return

    event.preventDefault()
    void openLinkedSchedule(scheduleId)
  }

  return {
    scheduleLink,
    copyScheduleLink,
    resolveLinkedSchedule,
    openLinkedSchedule,
    takeOpeningScheduleLink,
    onSchedulePaste,
  }
}
