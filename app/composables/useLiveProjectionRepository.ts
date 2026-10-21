import useIndexedDB, {
  type LiveProjectionRecord,
  type WorshipCloudDatabase,
} from "~/composables/useIndexedDB"
import type { LivePayload, Slide } from "~/types"
import { cloneDurableSlide } from "~/utils/durableSlide"
import { isPairPayload, primaryLiveSlide } from "~/utils/slidePairs"

export interface LiveProjectionRepository {
  getCurrent(): Promise<LiveProjectionRecord | undefined>
  putCurrent(
    payload: LivePayload,
    revision: string,
    updatedAt: number
  ): Promise<LiveProjectionRecord>
  clear(): Promise<void>
}

export const LIVE_PROJECTION_RESTORE_MAX_AGE_MS = 18 * 60 * 60 * 1000

export const isRestorableLiveProjection = (
  record: LiveProjectionRecord | undefined,
  options: {
    expectedSlideId: string | null
    churchId?: string | null
    now?: number
    maxAgeMs?: number
  }
) => {
  if (!record) return false
  const now = options.now ?? Date.now()
  const maxAgeMs = options.maxAgeMs ?? LIVE_PROJECTION_RESTORE_MAX_AGE_MS
  if (now - record.updatedAt > maxAgeMs) return false
  // A live pair answers to any of its members: the shared live slide id is its
  // active member, which another window may have switched a beat earlier.
  const memberIds = record.slides?.map((slide) => slide.id) ?? []
  if (
    record.slideId !== options.expectedSlideId &&
    !(options.expectedSlideId && memberIds.includes(options.expectedSlideId))
  ) {
    return false
  }
  if (!record.slideId) return record.slide === null
  if (!record.slide || record.slide.id !== record.slideId) return false
  if (options.churchId && record.churchId && record.churchId !== options.churchId) {
    return false
  }
  return true
}

const prepareSlide = async (slide: Slide | null) => {
  if (!slide) return null
  return await cloneDurableSlide(slide)
}

export const createLiveProjectionRepository = (
  injectedDb?: WorshipCloudDatabase
): LiveProjectionRepository => {
  // Resolved per call, never captured: this repository is a module-level
  // singleton written to on every go-live, so a connection captured once would
  // keep throwing DatabaseClosedError for the rest of a service once the
  // browser closed it under a backgrounded tab.
  const db = () => injectedDb ?? useIndexedDB()

  return {
    async getCurrent() {
      return await db().liveProjection.get("current")
    },

    async putCurrent(payload, revision, updatedAt) {
      const members = isPairPayload(payload)
        ? ((await Promise.all(payload.map(prepareSlide))) as Slide[])
        : null
      const prepared = members
        ? primaryLiveSlide(members)
        : await prepareSlide(payload as Slide | null)
      const record: LiveProjectionRecord = {
        id: "current",
        revision,
        slideId: prepared?.id || null,
        scheduleId: prepared?.scheduleId || null,
        churchId: prepared?.churchId || null,
        updatedAt,
        slide: prepared,
        slides: members,
      }
      await db().liveProjection.put(record)
      return record
    },

    async clear() {
      await db().liveProjection.delete("current")
    },
  }
}

let repositoryInstance: LiveProjectionRepository | null = null

export const useLiveProjectionRepository = () => {
  if (!repositoryInstance) {
    repositoryInstance = createLiveProjectionRepository()
  }
  return repositoryInstance
}

export default useLiveProjectionRepository
