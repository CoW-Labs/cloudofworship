import type { Slide } from "~/types"
import type { SlideRepository } from "~/composables/useSlideRepository"

export type ScheduleHydrationResult = {
  source: "indexeddb" | "legacy" | "empty" | "stale" | "error"
  slides: Slide[]
  applied: boolean
  error?: unknown
}

type ScheduleHydratorOptions = {
  repository: Pick<SlideRepository, "getScheduleSlides">
  getActiveScheduleId: () => string | null | undefined
  getLegacySlides: (scheduleId: string) => readonly Slide[]
  applyScheduleSlides: (scheduleId: string, slides: Slide[]) => void
  onError?: (error: unknown, scheduleId: string) => void
}

const slideKey = (slide: Slide) => slide.id || slide._id

const sortSlides = (slides: Slide[]) =>
  slides.sort((a, b) => (a.index || 0) - (b.index || 0))

/**
 * Merge the durable cache with the temporary Pinia/localStorage fallback.
 * The fallback wins matching records while both systems are active because it
 * may contain an editor change whose coalesced IndexedDB write has not run yet.
 */
export const mergeIndexedAndLegacyScheduleSlides = (
  indexedSlides: readonly Slide[],
  legacySlides: readonly Slide[]
) => {
  const merged = new Map<string, Slide>()
  indexedSlides.forEach((slide) => {
    const key = slideKey(slide)
    if (key) merged.set(key, slide)
  })
  legacySlides.forEach((slide) => {
    const key = slideKey(slide)
    if (key) merged.set(key, slide)
  })
  return sortSlides([...merged.values()])
}

/** Server records replace synced local records, while unsaved local slides survive. */
export const mergeServerAndPendingScheduleSlides = (
  serverSlides: readonly Slide[],
  localSlides: readonly Slide[]
) => {
  const merged = new Map<string, Slide>()
  serverSlides.forEach((slide) => {
    const key = slideKey(slide)
    if (key) merged.set(key, slide)
  })
  localSlides.forEach((slide) => {
    const key = slideKey(slide)
    if (key && !slide._id && !merged.has(key)) merged.set(key, slide)
  })
  return sortSlides([...merged.values()])
}

/** Replace one schedule without rebuilding or discarding the other schedules. */
export const replaceScheduleSlidesInCorpus = (
  corpus: readonly Slide[],
  scheduleId: string,
  scheduleSlides: readonly Slide[]
) => [
  ...corpus.filter((slide) => slide.scheduleId !== scheduleId),
  ...scheduleSlides.filter((slide) => slide.scheduleId === scheduleId),
]

const hasSameSlideReferences = (
  left: readonly Slide[],
  right: readonly Slide[]
) =>
  left.length === right.length &&
  left.every((slide, index) => slide === right[index])

/**
 * Creates a latest-request-wins loader. A slow IndexedDB read for the previous
 * schedule can never overwrite the schedule selected after it.
 */
export const createScheduleSlideHydrator = (
  options: ScheduleHydratorOptions
) => {
  let generation = 0

  return {
    async hydrate(scheduleId: string): Promise<ScheduleHydrationResult> {
      const requestGeneration = ++generation
      let indexedSlides: Slide[]

      try {
        indexedSlides = await options.repository.getScheduleSlides(scheduleId)
      } catch (error) {
        const legacySlides = [...options.getLegacySlides(scheduleId)]
        if (
          requestGeneration !== generation ||
          options.getActiveScheduleId() !== scheduleId
        ) {
          return { source: "stale", slides: [], applied: false }
        }
        options.onError?.(error, scheduleId)
        return {
          source: legacySlides.length ? "legacy" : "error",
          slides: legacySlides,
          applied: false,
          error,
        }
      }

      if (
        requestGeneration !== generation ||
        options.getActiveScheduleId() !== scheduleId
      ) {
        return { source: "stale", slides: [], applied: false }
      }

      const legacySlides = [...options.getLegacySlides(scheduleId)]
      if (!indexedSlides.length) {
        return {
          source: legacySlides.length ? "legacy" : "empty",
          slides: legacySlides,
          applied: false,
        }
      }

      const mergedSlides = mergeIndexedAndLegacyScheduleSlides(
        indexedSlides.filter((slide) => slide.scheduleId === scheduleId),
        legacySlides
      )
      const shouldApply = !hasSameSlideReferences(legacySlides, mergedSlides)
      if (shouldApply) {
        options.applyScheduleSlides(scheduleId, mergedSlides)
      }

      return {
        source: "indexeddb",
        slides: mergedSlides,
        applied: shouldApply,
      }
    },

    invalidate() {
      generation += 1
    },
  }
}

