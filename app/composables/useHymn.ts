import type { Hymn } from '~/types'
import { safeDBGet } from './useIndexedDB'

const useHymn = async (number: string): Promise<Hymn | null> => {
  const db = useIndexedDB()
  let hymns: any = await safeDBGet(db.bibleAndHymns, 'hymns')
  hymns = hymns?.data as unknown as Hymn[]
  const toast = useToast()

  try {
    const hymn = hymns.find((hymn: Hymn) => hymn.number === number) as Hymn
    return hymn
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
