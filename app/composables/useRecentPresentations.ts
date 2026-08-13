import type { LocalMediaFileRecord, PresentationObject } from "~/types"

/**
 * Presentations previously imported on THIS device.
 *
 * There is no endpoint that lists a church's uploaded files, so the only
 * source is local media storage. Every imported deck writes one record per
 * page (see createPresentationSlide in useSlideCreation.ts):
 *
 *   key:          `${slideId}-page-${page}`
 *   groupId:      slideId
 *   category:     "presentation-page"
 *   originalName: `${fileName}-page-${page}.png`
 *
 * so a deck is exactly one groupId, and its pages are recovered by parsing the
 * page number back off each key.
 */

export interface RecentPresentationPage {
  key: string
  page: number
}

export interface RecentPresentation {
  groupId: string
  name: string
  createdAt: string
  pages: RecentPresentationPage[]
}

type PresentationRecord = Pick<
  LocalMediaFileRecord,
  "key" | "groupId" | "category" | "createdAt"
> &
  Partial<Pick<LocalMediaFileRecord, "originalName">>

const PAGE_IN_KEY = /-page-(\d+)$/
const PAGE_IN_NAME = /-page-(\d+)\.[^/.]+$/i

/** `deck.pptx-page-3.png` → `deck` */
const displayNameFrom = (originalName?: string): string => {
  if (!originalName) return "Presentation"
  const withoutPageSuffix = originalName.replace(PAGE_IN_NAME, "")
  const withoutExtension = withoutPageSuffix.replace(/\.[^/.]+$/, "")
  return withoutExtension.trim() || "Presentation"
}

const pageNumberFrom = (record: PresentationRecord, fallback: number): number => {
  const fromKey = record.key?.match(PAGE_IN_KEY)?.[1]
  if (fromKey) return Number(fromKey)
  const fromName = record.originalName?.match(PAGE_IN_NAME)?.[1]
  if (fromName) return Number(fromName)
  return fallback
}

/**
 * Pure grouping step, split out from the composable so it can be tested without
 * touching storage.
 */
export const groupPresentationRecords = (
  records: PresentationRecord[],
  limit = 10
): RecentPresentation[] => {
  const groups = new Map<string, RecentPresentation>()

  records
    .filter((record) => record.category === "presentation-page" && record.groupId)
    .forEach((record, index) => {
      const existing = groups.get(record.groupId)
      const page = {
        key: record.key,
        page: pageNumberFrom(record, index + 1),
      }

      if (!existing) {
        groups.set(record.groupId, {
          groupId: record.groupId,
          name: displayNameFrom(record.originalName),
          createdAt: record.createdAt,
          pages: [page],
        })
        return
      }

      existing.pages.push(page)
      // The deck's own timestamp is when its first page landed.
      if (record.createdAt && record.createdAt < existing.createdAt) {
        existing.createdAt = record.createdAt
      }
    })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      pages: group.pages.sort((a, b) => a.page - b.page),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

export default function useRecentPresentations() {
  const localMedia = useLocalMediaStorage()

  const presentations = ref<RecentPresentation[]>([])
  const loading = ref(true)

  const load = async (limit = 10) => {
    loading.value = true
    try {
      presentations.value = groupPresentationRecords(
        await localMedia.listRecords(),
        limit
      )
    } catch (error) {
      console.error("Failed to read recent presentations:", error)
      presentations.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Rebuild the page images for a stored deck. Returns null when any page no
   * longer resolves — an evicted deck must not produce a half-empty slide.
   */
  const toPresentationObjects = async (
    presentation: RecentPresentation
  ): Promise<PresentationObject[] | null> => {
    const objects: PresentationObject[] = []

    for (const page of presentation.pages) {
      const imageUrl = await localMedia.getPlaybackUrl(page.key)
      if (!imageUrl) return null
      objects.push({ page: page.page, imageUrl })
    }

    return objects.length ? objects : null
  }

  return { presentations, loading, load, toPresentationObjects }
}
