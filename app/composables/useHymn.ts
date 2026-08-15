import type { Hymn } from '~/types'
import { safeDBGet } from './useIndexedDB'

// ── Module-level index cache ────────────────────────────────────────────────
// The hymn library is a single ~1.6MB record. Read uncached, every navigation
// within a hymn (each verse, each chunk) paid for a full IndexedDB read plus a
// linear scan of ~1500 hymns. Built once per window, keyed by hymn number.
let hymnIndexCache: Map<string, Hymn> | null = null
let hymnIndexPromise: Promise<Map<string, Hymn> | null> | null = null

/** Call after the hymn library is re-downloaded so the next lookup rebuilds. */
export const invalidateHymnCache = () => {
  hymnIndexCache = null
  hymnIndexPromise = null
}

const getHymnIndex = async (): Promise<Map<string, Hymn> | null> => {
  if (hymnIndexCache) return hymnIndexCache
  if (hymnIndexPromise) return await hymnIndexPromise

  hymnIndexPromise = (async () => {
    const db = useIndexedDB()
    const record = await safeDBGet(db.bibleAndHymns, 'hymns')
    const hymns = record?.data as unknown as Hymn[]
    if (!hymns?.length) return null

    const index = new Map<string, Hymn>()
    for (const hymn of hymns) {
      if (hymn?.number !== undefined) index.set(String(hymn.number), hymn)
    }
    hymnIndexCache = index
    return index
  })()

  try {
    return await hymnIndexPromise
  } finally {
    hymnIndexPromise = null
  }
}

const useHymn = async (number: string): Promise<Hymn | null> => {
  const toast = useToast()

  try {
    const index = await getHymnIndex()
    // Only an unavailable library is worth a toast — an unmatched number
    // returned quietly before this cache existed, and callers test for falsy.
    if (!index) throw new Error('Hymn library is not available offline')
    return index.get(String(number)) || null
  } catch (err) {
    toast.add({ title: 'Hymn not found', icon: 'i-bx-error', color: 'red' })
  }
  return null
}

export default useHymn

/**
 * Number of real lines in a chunk. Chunks are newline-joined and songs keep a
 * trailing "\n", so a naive split length overshoots by one.
 */
const countChunkLines = (chunk?: string): number =>
  chunk?.split('\n')?.filter(line => line?.trim() !== '')?.length || 0

/**
 * Re-points the active chunk after "lines per slide" changes so the operator
 * stays on the line they were reading, instead of on the same chunk *number*.
 *
 * 8 lines at 2/slide, sitting on chunk 2 (lines 3-4) → at 1/slide this returns
 * chunk index 2 (line 3), not index 1 (line 2). Always returns an in-range
 * index for [newChunks], so it doubles as the clamp when the count shrinks.
 */
export const remapChunkIndex = (
  oldChunks: string[],
  oldIndex: number,
  newChunks: string[]
): number => {
  if (!oldChunks?.length || !newChunks?.length) return 0
  const currentIndex = Math.min(Math.max(oldIndex, 0), oldChunks.length - 1)

  // Position of this chunk's first line within the whole song/verse
  let firstLine = 0
  for (let i = 0; i < currentIndex; i++) {
    firstLine += countChunkLines(oldChunks[i])
  }

  // The chunk holding that line under the new arrangement
  let linesSoFar = 0
  for (let i = 0; i < newChunks.length; i++) {
    linesSoFar += countChunkLines(newChunks[i])
    if (firstLine < linesSoFar) return i
  }
  return newChunks.length - 1
}

export const splitVerseByLines = (text: string, linesPerSlide?: number | string): string[] => {
  if (!text) return ['']
  const n = Number(linesPerSlide)
  const lines = text.split('\n').filter(l => l?.trim() !== '')
  if (!n || n < 1 || n >= lines.length) {
    return [text]
  }
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += n) {
    chunks.push(lines.slice(i, i + n).join('\n'))
  }
  return chunks
}
