import type { Slide } from "~/types"
import useIndexedDB, {
  type DataMigrationRecord,
  type StoredSlideRecord,
  type WorshipCloudDatabase,
} from "~/composables/useIndexedDB"
import { toTransportSafeSlide } from "~/utils/mediaTransport"

export const LEGACY_ACTIVE_SLIDES_MIGRATION =
  "001-import-pinia-active-slides"

export type SlideMigrationResult = {
  status: "completed" | "already-completed"
  record: DataMigrationRecord
}

const isMigratableSlide = (slide: unknown): slide is Slide => {
  if (!slide || typeof slide !== "object") return false
  const candidate = slide as Partial<Slide>
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.scheduleId === "string" &&
    candidate.scheduleId.length > 0
  )
}

const fingerprintKeys = (keys: string[]) => {
  // FNV-1a gives us a compact deterministic verification fingerprint. This is
  // not a security checksum, it only detects a different migration input.
  let hash = 0x811c9dc5
  for (const character of keys.sort().join("\u0000")) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

const plainSlide = async (slide: Slide): Promise<Slide> => {
  const transportSafe = await toTransportSafeSlide(slide)
  // Pinia exposes reactive proxies. IndexedDB cannot structured-clone those,
  // while JSON also matches the shape users previously had in localStorage.
  return JSON.parse(JSON.stringify(transportSafe)) as Slide
}

const prepareLegacySlides = async (slides: readonly Slide[]) => {
  const unique = new Map<string, Slide>()
  let skippedCount = 0

  for (const slide of slides) {
    if (!isMigratableSlide(slide)) {
      skippedCount += 1
      continue
    }

    const key = `${slide.scheduleId}\u0000${slide.id}`
    if (unique.has(key)) {
      skippedCount += 1
      continue
    }
    unique.set(key, slide)
  }

  const storedAt = new Date().toISOString()
  const records = await Promise.all(
    [...unique.values()].map(async (slide): Promise<StoredSlideRecord> => {
      const safeSlide = await plainSlide(slide)
      return {
        scheduleId: safeSlide.scheduleId,
        id: safeSlide.id,
        index: Number.isFinite(safeSlide.index) ? safeSlide.index : 0,
        serverId: safeSlide._id,
        updatedAt: safeSlide.updatedAt,
        localRevision: 1,
        syncState: safeSlide._id ? "synced" : "pending",
        storedAt,
        deletedAt: null,
        slide: safeSlide,
      }
    })
  )

  return { records, skippedCount }
}

/**
 * Copies legacy Pinia-persisted slides into IndexedDB exactly once.
 *
 * The completion marker is committed in the same transaction as the records.
 * Existing IndexedDB records win, which prevents a stale localStorage snapshot
 * from overwriting a later repository write if startup is interrupted.
 */
export const migrateLegacyActiveSlides = async (
  legacySlides: readonly Slide[],
  db: WorshipCloudDatabase = useIndexedDB()
): Promise<SlideMigrationResult> => {
  const completed = await db.migrationMeta.get(LEGACY_ACTIVE_SLIDES_MIGRATION)
  if (completed?.status === "completed") {
    return { status: "already-completed", record: completed }
  }

  const sourceSlides = Array.isArray(legacySlides) ? legacySlides : []
  const { records, skippedCount } = await prepareLegacySlides(sourceSlides)
  const keys = records.map(
    (record) => `${record.scheduleId}\u0000${record.id}`
  )

  return await db.transaction(
    "rw",
    db.slides,
    db.migrationMeta,
    async (): Promise<SlideMigrationResult> => {
      // A second window may have completed the migration while this one was
      // preparing transport-safe records.
      const concurrentCompletion = await db.migrationMeta.get(
        LEGACY_ACTIVE_SLIDES_MIGRATION
      )
      if (concurrentCompletion?.status === "completed") {
        return {
          status: "already-completed",
          record: concurrentCompletion,
        }
      }

      const compoundKeys = records.map(
        (record) => [record.scheduleId, record.id] as [string, string]
      )
      const existing = compoundKeys.length
        ? await db.slides.bulkGet(compoundKeys)
        : []
      const missing = records.filter((_, index) => !existing[index])

      if (missing.length) await db.slides.bulkPut(missing)

      const verified = compoundKeys.length
        ? await db.slides.bulkGet(compoundKeys)
        : []
      if (verified.some((record) => !record)) {
        throw new Error("Legacy slide migration verification failed")
      }

      const record: DataMigrationRecord = {
        id: LEGACY_ACTIVE_SLIDES_MIGRATION,
        version: 1,
        status: "completed",
        completedAt: new Date().toISOString(),
        sourceCount: sourceSlides.length,
        eligibleCount: records.length,
        insertedCount: missing.length,
        skippedCount,
        sourceFingerprint: fingerprintKeys(keys),
      }
      await db.migrationMeta.put(record)

      return { status: "completed", record }
    }
  )
}

export const runDataMigrations = async (legacySlides: readonly Slide[]) => {
  return await migrateLegacyActiveSlides(legacySlides)
}

