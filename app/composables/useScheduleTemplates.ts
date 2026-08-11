import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  Countdown,
  Schedule,
  Slide,
  ScheduleTemplate,
  ScheduleTemplateSeed,
} from "~/types"
import { tabSessionId } from "./useRealtimeSlides"

/**
 * Creates a brand-new schedule pre-populated from a schedule starter template.
 *
 * Both the schedule and every slide get real cloud identity (new Mongo
 * ObjectIds persisted to the backend), exactly like normally-created
 * schedules/slides. Template seeds are resolved into slides via the existing
 * `useSlideCreation` builders so they respect the user's backgrounds, fonts and
 * settings.
 */
export default function useScheduleTemplates() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()

  const {
    createTextSlide,
    createBibleSlide,
    createHymnSlide,
    createSongSlide,
    createSongSetlistSlide,
    createCountdownSlide,
    createMediaSlide,
  } = useSlideCreation()
  const { appendSongToSetlist } = useSongSetlist()

  /** Build the HTML contents array for a text seed. */
  const buildTextSlide = (
    seed: Extract<ScheduleTemplateSeed, { type: "text" }>
  ): Slide => {
    const slide = createTextSlide()
    const toHtml = (text?: string) =>
      text ? `<p>${text.replace(/\n/g, "<br>")}</p>` : ""

    // Template text slides always use the single editable textbox. A heading,
    // when present, remains a heading node inside that same TipTap document.
    slide.layout = slideLayoutTypes.full_text
    slide.contents = [
      "",
      [
        seed.heading ? `<h1>${seed.heading}</h1>` : "",
        toHtml(seed.subtitle ?? seed.body),
      ].join(""),
    ]

    slide.name = seed.heading || seed.subtitle || "Text slide"
    return slide
  }

  /** Resolve a single seed into a Slide (or null if it can't be built). */
  const buildSlideFromSeed = async (
    seed: ScheduleTemplateSeed
  ): Promise<Slide | null> => {
    switch (seed.type) {
      case "text":
        return buildTextSlide(seed)

      case "bible": {
        const scripture = await useScripture(seed.ref)
        if (!scripture) {
          console.warn(
            `[scheduleTemplates] Skipping Bible slide — could not resolve ref "${seed.ref}"`
          )
          return null
        }
        return createBibleSlide(scripture)
      }

      case "hymn": {
        const hymn = await useHymn(seed.number)
        if (!hymn) {
          console.warn(
            `[scheduleTemplates] Skipping hymn slide — hymn ${seed.number} not found`
          )
          return null
        }
        return createHymnSlide(hymn)
      }

      case "song":
        return createSongSlide(seed.song)

      case "song-setlist": {
        if (!seed.songs.length) return null
        let slide = await createSongSetlistSlide(seed.songs[0])
        for (const song of seed.songs.slice(1)) {
          // keep the template's own ordering — new songs only jump to the top
          // when a user adds them
          const updated = await appendSongToSetlist(slide, song, {
            position: "end",
          })
          if (updated) slide = updated
        }
        return slide
      }

      case "countdown": {
        const countdown: Countdown = {
          id: useObjectID(),
          time: seed.time,
          timeLeft: seed.time,
          content: seed.label,
        }
        return createCountdownSlide(countdown)
      }

      case "media":
        return createMediaSlide(
          seed.mediaType === "youtube"
            ? ({ isExternal: true, url: seed.url, type: "youtube", name: seed.name } as any)
            : ({ url: seed.url, type: "image", name: seed.name } as any)
        )

      default:
        return null
    }
  }

  const cloneValue = <T>(value: T): T => {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value)
      } catch (err) {
        console.warn("[scheduleTemplates] Falling back from structuredClone", err)
      }
    }

    try {
      return JSON.parse(JSON.stringify(value)) as T
    } catch {
      if (Array.isArray(value)) return [...value] as T
      if (value && typeof value === "object") return { ...(value as any) } as T
      return value
    }
  }

  const sanitizeSlideForUpload = (slide: Slide): Slide => {
    const sanitizedSlide = { ...slide }
    if (sanitizedSlide.data && typeof sanitizedSlide.data === "object") {
      const sanitizedData = {
        ...(sanitizedSlide.data as unknown as Record<string, unknown>),
      }
      delete sanitizedData.blob
      sanitizedSlide.data = sanitizedData as unknown as typeof sanitizedSlide.data
    }
    return sanitizedSlide
  }

  const persistNewScheduleSlides = async (
    slides: Slide[],
    logPrefix: string,
    warningTitle: string
  ) => {
    appStore.appendActiveSlides(slides)

    if (slides.length === 0) return

    try {
      const { batchCreateSlides } = useSlides()
      const slidesForUpload = slides.map(sanitizeSlideForUpload)
      const { inserted } = await batchCreateSlides(slidesForUpload)

      // Backfill server _id onto local copies (backend sets _id = client id).
      inserted.forEach((serverSlide) => {
        const local = slides.find((s) => s.id === serverSlide.id)
        if (local && serverSlide._id) local._id = serverSlide._id
      })

      // Best-effort peer sync, REST above is the source of truth.
      const socket = useNuxtApp().$socketio as any
      if (socket?.connected && inserted.length > 0) {
        socket.emit("batch-create-slides", {
          slides: inserted.map((s) => ({ ...s })),
          tabId: tabSessionId,
        })
      }
    } catch (err) {
      console.error(`${logPrefix} Failed to persist slides`, err)
      toast.add({
        icon: "i-bx-error",
        title: warningTitle,
        description: "They're saved locally and will retry when you're back online.",
        color: "orange",
      })
    }
  }

  const getScheduleSlidesForCopy = async (scheduleId: string): Promise<Slide[]> => {
    const localSlides = appStore.currentState.activeSlides.filter(
      (slide) => slide.scheduleId === scheduleId
    )
    const { fetchScheduleSlides } = useSchedules()
    const remoteSlides = await fetchScheduleSlides(scheduleId)
    const slidesById = new Map<string, Slide>()

    remoteSlides.forEach((slide) => {
      const key = slide.id || slide._id
      if (key) slidesById.set(key, slide)
    })
    localSlides.forEach((slide) => {
      const key = slide.id || slide._id
      if (key) slidesById.set(key, slide)
    })

    return Array.from(slidesById.values()).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    )
  }

  const cloneSlideForSchedule = (
    slide: Slide,
    scheduleId: string,
    index: number
  ): Slide => {
    const copiedSlide = cloneValue(slide)
    delete copiedSlide._id
    delete copiedSlide.createdAt
    delete copiedSlide.updatedAt
    delete copiedSlide.saved
    copiedSlide.id = useObjectID()
    copiedSlide.index = index
    copiedSlide.scheduleId = scheduleId
    copiedSlide.userId = authStore.user?._id as string
    copiedSlide.churchId = (authStore.user?.churchId || copiedSlide.churchId) as string
    return copiedSlide
  }

  /**
   * Create a schedule from a template. Assumes any subscription/limit gating has
   * already been performed by the caller (ScheduleModal does this before
   * branching).
   */
  const createScheduleFromTemplate = async (
    template: ScheduleTemplate,
    scheduleName?: string
  ): Promise<Schedule | null> => {
    // 1. Build the schedule and make it active (mirrors ScheduleModal).
    const scheduleId = useObjectID()
    const defaultName = `Untitled ${template.label}`
    const schedule: Schedule = {
      _id: scheduleId,
      name: scheduleName?.trim() || defaultName,
      authorId: authStore?.user?._id as string,
      editorIds: [],
      churchId: authStore?.user?.churchId as string,
      createdAt: new Date().toISOString(),
    }

    // 2. Persist the schedule to the cloud first so slides (which POST to the
    //    active schedule) have a server-side parent. createSchedule sets it
    //    active on success (with a server `updatedAt`, so the PreviewContent
    //    `activeSchedule` watcher takes its else-branch instead of persisting a
    //    second time). We intentionally do NOT call setActiveSchedule ourselves
    //    beforehand — that would trip the same watcher and POST the schedule
    //    twice. On failure (e.g. offline) fall back to a local activation so
    //    the slides still attach and later batch-upload flows retry.
    const { createSchedule } = useSchedules()
    const createdSchedule = await createSchedule(schedule)
    if (!createdSchedule) {
      appStore.setActiveSchedule(schedule)
    }

    // 3. Build slides from the template seeds (in order). Builders read the now
    //    active schedule for scheduleId; index is stamped explicitly below.
    const slides: Slide[] = []
    for (const seed of template.slides) {
      try {
        const slide = await buildSlideFromSeed(seed)
        if (slide) slides.push(slide)
      } catch (err) {
        console.error("[scheduleTemplates] Failed to build slide from seed", seed, err)
      }
    }
    slides.forEach((slide, index) => {
      slide.index = index
    })

    // 4. Add locally, then persist with new ids + broadcast to collaborators.
    await persistNewScheduleSlides(
      slides,
      "[scheduleTemplates]",
      "Some template slides didn't sync"
    )

    // 5. Notify the rest of the app that this schedule is now selected.
    useGlobalEmit(appWideActions.selectedSchedule, schedule)
    usePosthogCapture("SCHEDULE_CREATED_FROM_TEMPLATE", {
      templateKey: template.key,
      scheduleName: schedule.name,
      slideCount: slides.length,
    })

    return schedule
  }

  const duplicateSchedule = async (
    sourceSchedule: Schedule
  ): Promise<Schedule | null> => {
    if (!sourceSchedule?._id) return null

    const sourceSlides = await getScheduleSlidesForCopy(sourceSchedule._id)
    const scheduleId = useObjectID()
    const sourceName = sourceSchedule.name?.trim() || "Untitled schedule"
    const schedule: Schedule = {
      _id: scheduleId,
      name: `${sourceName} Copy`,
      authorId: authStore?.user?._id || sourceSchedule.authorId,
      editorIds: [],
      churchId: authStore?.user?.churchId || sourceSchedule.churchId,
      createdAt: new Date().toISOString(),
    }

    const { createSchedule } = useSchedules()
    const createdSchedule = await createSchedule(schedule)
    if (!createdSchedule) {
      appStore.setActiveSchedule(schedule)
    }

    const copiedSlides = sourceSlides.map((slide, index) =>
      cloneSlideForSchedule(slide, scheduleId, index)
    )

    await persistNewScheduleSlides(
      copiedSlides,
      "[scheduleTemplates]",
      "Some duplicated slides didn't sync"
    )

    useGlobalEmit(appWideActions.selectedSchedule, schedule)
    usePosthogCapture("SCHEDULE_DUPLICATED", {
      sourceScheduleId: sourceSchedule._id,
      newScheduleId: schedule._id,
      scheduleName: schedule.name,
      slideCount: copiedSlides.length,
    })

    return schedule
  }

  return {
    createScheduleFromTemplate,
    duplicateSchedule,
  }
}
