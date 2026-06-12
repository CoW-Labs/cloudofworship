import { useAppStore } from '~/store/app'
import type { BibleVerse, Scripture } from '~/types'
import { safeDBGet } from './useIndexedDB'

// ── Module-level index cache ────────────────────────────────────────────────
// Built once per Bible version per session. Avoids re-scanning 31k+ verses on
// every lookup. Keyed by version ID.
interface VersionIndex {
  /** "book:chapter:verse" → position in the data array */
  verseMap: Map<string, number>
  /** Set of book numbers that exist (for fast "book not found" check) */
  bookSet: Set<number>
  /** Set of "book:chapter" strings (for fast "chapter not found" check) */
  chapterSet: Set<string>
  /** "book:chapter" → highest verse number (for the scripture picker) */
  chapterVerseCounts: Map<string, number>
  data: BibleVerse[]
}
const versionIndexCache = new Map<string, VersionIndex>()
const versionIndexPromiseCache = new Map<string, Promise<VersionIndex | null>>()

function buildIndex(version: string, data: BibleVerse[]): VersionIndex {
  const verseMap = new Map<string, number>()
  const bookSet = new Set<number>()
  const chapterSet = new Set<string>()
  const chapterVerseCounts = new Map<string, number>()

  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (!v) continue
    const b = Number(v.book)
    const c = Number(v.chapter)
    const vs = Number(v.verse)
    verseMap.set(`${b}:${c}:${vs}`, i)
    bookSet.add(b)
    const chapterKey = `${b}:${c}`
    chapterSet.add(chapterKey)
    if (vs > (chapterVerseCounts.get(chapterKey) ?? 0)) {
      chapterVerseCounts.set(chapterKey, vs)
    }
  }

  const index: VersionIndex = { verseMap, bookSet, chapterSet, chapterVerseCounts, data }
  versionIndexCache.set(version, index)
  return index
}

async function getVersionIndex(version: string, db: any): Promise<VersionIndex | null> {
  // Return cached index if already built
  if (versionIndexCache.has(version)) return versionIndexCache.get(version)!

  if (versionIndexPromiseCache.has(version)) {
    return await versionIndexPromiseCache.get(version)!
  }

  const indexPromise = (async () => {
    const bibleEntry = await safeDBGet<{ data: BibleVerse[] }>(db.bibleAndHymns, version)
    if (!bibleEntry) return null

    const data = bibleEntry.data as unknown as BibleVerse[]
    if (!data?.length) return null

    return buildIndex(version, data)
  })()

  versionIndexPromiseCache.set(version, indexPromise)
  try {
    return await indexPromise
  } finally {
    versionIndexPromiseCache.delete(version)
  }
}

// ── Main composable ─────────────────────────────────────────────────────────

export const prewarmScriptureVersion = async (version: string = ''): Promise<void> => {
  const db = useIndexedDB()
  const appStore = useAppStore()
  const resolvedVersion = version || appStore.currentState.settings.defaultBibleVersion || 'KJV'
  await getVersionIndex(resolvedVersion, db)
}

/**
 * Number of verses in a given book/chapter for a Bible version.
 * Reads from the cached version index (built once per session), so repeated
 * calls while browsing the scripture picker incur no IndexedDB reads.
 * Returns 0 when the version isn't downloaded or the chapter doesn't exist.
 */
export const getChapterVerseCount = async (
  book: number,
  chapter: number,
  version: string = ''
): Promise<number> => {
  const db = useIndexedDB()
  const appStore = useAppStore()
  const resolvedVersion = version || appStore.currentState.settings.defaultBibleVersion || 'KJV'
  const index = await getVersionIndex(resolvedVersion, db)
  return index?.chapterVerseCounts.get(`${book}:${chapter}`) ?? 0
}

const useScripture = async (label: string = '1:1:1', version: string = ''): Promise<Scripture | null> => {
  const db = useIndexedDB()
  const appStore = useAppStore()
  const toast = useToast()

  version = version || appStore.currentState.settings.defaultBibleVersion || 'KJV'

  const shortLabelSplitted = label.split(':')
  const book = Number(shortLabelSplitted?.[0] || '1')
  const chapter = Number(shortLabelSplitted?.[1] || '1')
  const verseRaw = shortLabelSplitted?.[2]?.includes('-')
    ? shortLabelSplitted?.[2]
    : Number(shortLabelSplitted?.[2] || 1)
  const verses: number[] = []

  // If verse contains hyphen (e.g. "3-5" → verses 3, 4, 5)
  if (verseRaw.toString().includes('-')) {
    const [startStr, endStr] = verseRaw.toString().split('-')
    const verseStart = Number(startStr || '1')
    const verseEnd = Number(endStr || '1')
    for (let i = verseStart; i <= verseEnd; i++) verses.push(i)
  } else {
    verses.push(Number(verseRaw))
  }

  try {
    // ── 1. Load (or retrieve cached) index ───────────────────────────────
    const index = await getVersionIndex(version, db)

    if (!index) {
      // Distinguish: entry missing entirely vs entry has empty data
      const bibleEntry = await safeDBGet(db.bibleAndHymns, version)
      if (!bibleEntry) {
        toast.add({
          title: `${version} is not downloaded yet.`,
          description: 'Go to Settings → Bible Versions to download it.',
          icon: 'i-bx-download',
          color: 'amber',
          actions: [
            {
              label: 'Download Bible version',
              click: () =>
                useGlobalEmit(appWideActions.openSettings, 'Bible Version Settings'),
            },
          ],
        })
      } else {
        toast.add({
          title: `${version} data is empty`,
          description: 'The downloaded Bible file appears to be corrupt. Try re-downloading it in Settings.',
          icon: 'i-bx-error',
          color: 'red',
        })
      }
      return null
    }

    const { verseMap, bookSet, chapterSet, data } = index

    // ── 2. O(1) lookups using the index ──────────────────────────────────
    const startIndex = verseMap.get(`${book}:${chapter}:${verses[0]}`)

    if (startIndex === undefined) {
      const bookName = bibleBooks?.[book - 1]

      if (!bookSet.has(book)) {
        toast.add({
          title: 'Book not found',
          description: bookName
            ? `"${bookName}" was not found in ${version}.`
            : `Book index ${book} does not exist in ${version}.`,
          icon: 'i-bx-bible',
          color: 'red',
        })
        return null
      }

      if (!chapterSet.has(`${book}:${chapter}`)) {
        toast.add({
          title: 'Chapter not found',
          description: `${bookName || `Book ${book}`} chapter ${chapter} does not exist in ${version}.`,
          icon: 'i-bx-bible',
          color: 'red',
        })
        return null
      }

      toast.add({
        title: 'Verse not found',
        description: `${bookName || `Book ${book}`} ${chapter}:${verseRaw} does not exist in ${version}.`,
        icon: 'i-bx-bible',
        color: 'red',
      })
      return null
    }

    // ── 3. Slice and join ────────────────────────────────────────────────
    const scripture = data
      .slice(startIndex, startIndex + verses.length)
      .map((v) => v.scripture)
      .join(' ')

    if (!scripture?.trim()) {
      toast.add({
        title: 'Empty verse',
        description: `The verse text for ${bibleBooks?.[book - 1]} ${chapter}:${verseRaw} is empty in ${version}.`,
        icon: 'i-bx-error',
        color: 'amber',
      })
      return null
    }

    if (!appStore.currentState.settings.defaultBibleVersion) {
      appStore.setDefaultBibleVersion(version)
    }

    return {
      label: `${bibleBooks?.[book - 1]} ${chapter}:${verseRaw}`,
      content: scripture,
      version,
      labelShortFormat: label,
    }
  } catch (err) {
    console.error('[useScripture] Unexpected error:', err)
    toast.add({
      title: 'Failed to load scripture',
      description: 'An unexpected error occurred. Please try again.',
      icon: 'i-bx-error',
      color: 'red',
    })
  }

  return null
}

export default useScripture
