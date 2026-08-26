import type { Slide } from "~/types"
import useIndexedDB, {
  type SlideSyncState,
  type StoredSlideRecord,
  type WorshipCloudDatabase,
} from "~/composables/useIndexedDB"
import { cloneDurableSlide } from "~/utils/durableSlide"
import { notifySlideDatabaseChanged } from "~/composables/useSlideDatabaseNotifications"

export type SlideWriteOptions = {
  syncState?: SlideSyncState | ((slide: Slide) => SlideSyncState)
}

export type ReplaceScheduleOptions = SlideWriteOptions & {
  removeMissing?: boolean
  preservePending?: boolean
}

export type ScheduleVerification = {
  complete: boolean
  expectedCount: number
  actualCount: number
  missingIds: string[]
  unexpectedIds: string[]
  mismatchedIds: string[]
}

export interface SlideRepository {
  getSlide(scheduleId: string, slideId: string): Promise<Slide | undefined>
  getStoredSlide(
    scheduleId: string,
    slideId: string
  ): Promise<StoredSlideRecord | undefined>
  getScheduleSlides(scheduleId: string): Promise<Slide[]>
  putSlide(slide: Slide, options?: SlideWriteOptions): Promise<void>
  putSlides(slides: readonly Slide[], options?: SlideWriteOptions): Promise<void>
  replaceScheduleSlides(
    scheduleId: string,
    slides: readonly Slide[],
    options?: ReplaceScheduleOptions
  ): Promise<void>
  deleteSlide(scheduleId: string, slideId: string): Promise<void>
  deleteSlides(
    scheduleId: string,
    slideIds: readonly string[]
  ): Promise<void>
  clearAllSlides(): Promise<void>
  verifySchedule(
    scheduleId: string,
    expectedSlides: readonly Slide[]
  ): Promise<ScheduleVerification>
}

type SlideSanitizer = (slide: Slide) => Promise<Slide>

const isValidSlide = (slide: Slide | undefined | null): slide is Slide =>
  !!slide?.id && !!slide?.scheduleId

const resolveSyncState = (slide: Slide, options?: SlideWriteOptions) => {
  if (typeof options?.syncState === "function") {
    return options.syncState(slide)
  }
  if (options?.syncState) return options.syncState
  return slide._id ? "synced" : "pending"
}

export const createSlideRepository = (
  db: WorshipCloudDatabase = useIndexedDB(),
  sanitize: SlideSanitizer = cloneDurableSlide
): SlideRepository => {
  const prepareSlides = async (slides: readonly Slide[]) => {
    const unique = new Map<string, Slide>()
    slides.forEach((slide) => {
      if (!isValidSlide(slide)) return
      unique.set(`${slide.scheduleId}\u0000${slide.id}`, slide)
    })
    return await Promise.all([...unique.values()].map(sanitize))
  }

  const putPreparedSlides = async (
    prepared: Slide[],
    options?: SlideWriteOptions
  ) => {
    if (!prepared.length) return

    await db.transaction("rw", db.slides, async () => {
      const keys = prepared.map(
        (slide) => [slide.scheduleId, slide.id] as [string, string]
      )
      const existing = await db.slides.bulkGet(keys)
      const storedAt = new Date().toISOString()
      const records: StoredSlideRecord[] = prepared.map((slide, index) => ({
        scheduleId: slide.scheduleId,
        id: slide.id,
        index: Number.isFinite(slide.index) ? slide.index : 0,
        serverId: slide._id,
        updatedAt: slide.updatedAt,
        localRevision: (existing[index]?.localRevision || 0) + 1,
        syncState: resolveSyncState(slide, options),
        storedAt,
        deletedAt: null,
        slide,
      }))
      await db.slides.bulkPut(records)
    })
  }

  return {
    async getStoredSlide(scheduleId, slideId) {
      if (!scheduleId || !slideId) return undefined
      return await db.slides.get([scheduleId, slideId])
    },

    async getSlide(scheduleId, slideId) {
      if (!scheduleId || !slideId) return undefined
      return (await db.slides.get([scheduleId, slideId]))?.slide
    },

    async getScheduleSlides(scheduleId) {
      if (!scheduleId) return []
      const records = await db.slides
        .where("scheduleId")
        .equals(scheduleId)
        .sortBy("index")
      return records
        .filter((record) => !record.deletedAt)
        .map((record) => record.slide)
    },

    async putSlide(slide, options) {
      if (!isValidSlide(slide)) return
      await putPreparedSlides([await sanitize(slide)], options)
    },

    async putSlides(slides, options) {
      await putPreparedSlides(await prepareSlides(slides), options)
    },

    async replaceScheduleSlides(scheduleId, slides, options = {}) {
      if (!scheduleId) return
      const prepared = (await prepareSlides(slides)).filter(
        (slide) => slide.scheduleId === scheduleId
      )

      await db.transaction("rw", db.slides, async () => {
        const existing = await db.slides
          .where("scheduleId")
          .equals(scheduleId)
          .toArray()
        const existingById = new Map(
          existing.map((record) => [record.id, record] as const)
        )
        const storedAt = new Date().toISOString()
        const records: StoredSlideRecord[] = prepared.map((slide) => ({
          scheduleId,
          id: slide.id,
          index: Number.isFinite(slide.index) ? slide.index : 0,
          serverId: slide._id,
          updatedAt: slide.updatedAt,
          localRevision: (existingById.get(slide.id)?.localRevision || 0) + 1,
          syncState: resolveSyncState(slide, options),
          storedAt,
          deletedAt: null,
          slide,
        }))

        if (records.length) await db.slides.bulkPut(records)

        if (options.removeMissing) {
          const incomingIds = new Set(records.map((record) => record.id))
          const staleKeys = existing
            .filter(
              (record) =>
                !incomingIds.has(record.id) &&
                !(options.preservePending !== false &&
                  record.syncState === "pending")
            )
            .map(
              (record) => [record.scheduleId, record.id] as [string, string]
            )
          if (staleKeys.length) await db.slides.bulkDelete(staleKeys)
        }
      })
    },

    async deleteSlide(scheduleId, slideId) {
      if (!scheduleId || !slideId) return
      await db.slides.delete([scheduleId, slideId])
    },

    async deleteSlides(scheduleId, slideIds) {
      if (!scheduleId || !slideIds.length) return
      await db.slides.bulkDelete(
        [...new Set(slideIds)].map(
          (slideId) => [scheduleId, slideId] as [string, string]
        )
      )
    },

    async clearAllSlides() {
      await db.transaction(
        "rw",
        db.slides,
        db.slideOutbox,
        db.liveProjection,
        async () => {
          await db.slides.clear()
          await db.slideOutbox.clear()
          await db.liveProjection.clear()
        }
      )
    },

    async verifySchedule(scheduleId, expectedSlides) {
      const expected = (await prepareSlides(expectedSlides)).filter(
        (slide) => slide.scheduleId === scheduleId
      )
      const expectedById = new Map(expected.map((slide) => [slide.id, slide]))
      const expectedIds = new Set(expectedById.keys())
      const actual = await db.slides
        .where("scheduleId")
        .equals(scheduleId)
        .toArray()
      const actualIds = new Set(
        actual.filter((record) => !record.deletedAt).map((record) => record.id)
      )
      const missingIds = [...expectedIds].filter((id) => !actualIds.has(id))
      const unexpectedIds = [...actualIds].filter((id) => !expectedIds.has(id))
      const mismatchedIds = actual
        .filter((record) => {
          const expectedSlide = expectedById.get(record.id)
          return (
            expectedSlide &&
            JSON.stringify(record.slide) !== JSON.stringify(expectedSlide)
          )
        })
        .map((record) => record.id)

      return {
        complete:
          missingIds.length === 0 &&
          unexpectedIds.length === 0 &&
          mismatchedIds.length === 0,
        expectedCount: expectedIds.size,
        actualCount: actualIds.size,
        missingIds,
        unexpectedIds,
        mismatchedIds,
      }
    },
  }
}

let repositoryInstance: SlideRepository | null = null
let shadowWriteTail: Promise<void> = Promise.resolve()
const pendingSlidePuts = new Map<
  string,
  { slide: Slide; syncState: SlideSyncState }
>()
let pendingSlidePutTimer: ReturnType<typeof setTimeout> | null = null

export const useSlideRepository = () => {
  if (!repositoryInstance) repositoryInstance = createSlideRepository()
  return repositoryInstance
}

/**
 * Preserve mutation order without making UI actions await storage. A rejected
 * shadow write is logged and the queue continues, while Pinia/localStorage
 * remains the rollback source during this migration stage.
 */
export const enqueueSlideShadowWrite = (
  label: string,
  operation: (repository: SlideRepository) => Promise<void>
) => {
  shadowWriteTail = shadowWriteTail
    .then(async () => {
      await operation(useSlideRepository())
      notifySlideDatabaseChanged()
    })
    .catch((error) => {
      console.error(`Slide shadow write failed (${label}):`, error)
    })
  return shadowWriteTail
}

const shadowKey = (scheduleId: string, slideId: string) =>
  `${scheduleId}\u0000${slideId}`

const flushPendingSlidePuts = () => {
  if (pendingSlidePutTimer) clearTimeout(pendingSlidePutTimer)
  pendingSlidePutTimer = null
  if (!pendingSlidePuts.size) return

  const batch = [...pendingSlidePuts.values()]
  pendingSlidePuts.clear()
  const syncStates = new Map(
    batch.map(({ slide, syncState }) => [
      shadowKey(slide.scheduleId, slide.id),
      syncState,
    ])
  )
  enqueueSlideShadowWrite("coalesced slide edits", (repository) =>
    repository.putSlides(
      batch.map(({ slide }) => slide),
      {
        syncState: (slide) =>
          syncStates.get(shadowKey(slide.scheduleId, slide.id)) || "pending",
      }
    )
  )
}

/** Coalesce high-frequency editor/realtime changes into one batch. */
export const enqueueCoalescedSlideShadowPut = (
  slide: Slide,
  options: SlideWriteOptions = {},
  intervalMs = 500
) => {
  if (!isValidSlide(slide)) return
  pendingSlidePuts.set(shadowKey(slide.scheduleId, slide.id), {
    slide,
    syncState: resolveSyncState(slide, options),
  })
  if (!pendingSlidePutTimer) {
    pendingSlidePutTimer = setTimeout(flushPendingSlidePuts, intervalMs)
  }
}

export const cancelPendingSlideShadowPut = (
  scheduleId: string,
  slideId: string
) => {
  pendingSlidePuts.delete(shadowKey(scheduleId, slideId))
}

export const cancelPendingScheduleShadowPuts = (scheduleId: string) => {
  for (const [key, pending] of pendingSlidePuts) {
    if (pending.slide.scheduleId === scheduleId) pendingSlidePuts.delete(key)
  }
}

export const cancelAllPendingSlideShadowPuts = () => {
  pendingSlidePuts.clear()
  if (pendingSlidePutTimer) clearTimeout(pendingSlidePutTimer)
  pendingSlidePutTimer = null
}

export const flushSlideShadowWrites = async () => {
  flushPendingSlidePuts()
  await shadowWriteTail
}

export default useSlideRepository
