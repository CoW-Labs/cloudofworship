import useIndexedDB, {
  type LiveProjectionRecord,
  type WorshipCloudDatabase,
} from "~/composables/useIndexedDB"
import type { Slide } from "~/types"
import { cloneDurableSlide } from "~/utils/durableSlide"

export interface LiveProjectionRepository {
  getCurrent(): Promise<LiveProjectionRecord | undefined>
  putCurrent(
    slide: Slide | null,
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
  if (record.slideId !== options.expectedSlideId) return false
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
  db: WorshipCloudDatabase = useIndexedDB()
): LiveProjectionRepository => ({
  async getCurrent() {
    return await db.liveProjection.get("current")
  },

  async putCurrent(slide, revision, updatedAt) {
    const prepared = await prepareSlide(slide)
    const record: LiveProjectionRecord = {
      id: "current",
      revision,
      slideId: prepared?.id || null,
      scheduleId: prepared?.scheduleId || null,
      churchId: prepared?.churchId || null,
      updatedAt,
      slide: prepared,
    }
    await db.liveProjection.put(record)
    return record
  },

  async clear() {
    await db.liveProjection.delete("current")
  },
})

let repositoryInstance: LiveProjectionRepository | null = null

export const useLiveProjectionRepository = () => {
  if (!repositoryInstance) {
    repositoryInstance = createLiveProjectionRepository()
  }
  return repositoryInstance
}

export default useLiveProjectionRepository
