import { ref, computed } from 'vue'
import { bibleBooks } from '~/utils/constants'
import type { BibleReference } from '~/types/transcript'

export interface ScriptureResult {
  _id?: string
  book: string      // 1-based string e.g. "43"
  chapter: string
  verse: string
  scripture: string
  version: string
  lang: string
  score: number
  /** bookIndex:chapter:verse e.g. "43:3:16" — used by updateOrCreateBible */
  shortLabel: string
  /** Human-readable label e.g. "John 3:16" */
  displayLabel: string
  /**
   * Which search batch this result belongs to. Increments on every `search()`
   * call so the most recent batch always sorts above older ones. Within a batch,
   * results are ordered by `score`.
   */
  batchId: number
}

/**
 * Composable that searches the backend scriptures collection as transcription
 * text arrives. Debounces calls so the API is not hammered on every interim word.
 */
export default function useScriptureSearch() {
  const results = ref<ScriptureResult[]>([])
  const isSearching = ref(false)
  const lastQuery = ref('')
  let batchCounter = 0
  let latestSearchId = 0

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 1200 // slightly longer window so the segment fully settles

  /**
   * Convert a raw backend result into a `ScriptureResult` with display info.
   */
  const enrichResult = (raw: any): ScriptureResult => {
    const bookIndex = Number(raw.book) // already 1-based
    const bookName = bibleBooks[bookIndex - 1] || `Book ${bookIndex}`
    return {
      ...raw,
      shortLabel: `${raw.book}:${raw.chapter}:${raw.verse}`,
      displayLabel: `${bookName} ${raw.chapter}:${raw.verse}`,
    }
  }

  /**
   * Search scriptures on the backend. Can be called directly for immediate queries.
   */
  const search = async (query: string) => {
    const trimmed = query.trim()
    const searchId = ++latestSearchId

    if (!trimmed || trimmed.length < 10) {
      results.value = []
      isSearching.value = false
      return
    }

    // Avoid re-fetching the exact same query (version-agnostic, cross-translation search)
    if (trimmed === lastQuery.value) {
      isSearching.value = false
      return
    }
    lastQuery.value = trimmed

    isSearching.value = true
    const currentBatch = ++batchCounter
    try {
      const { data } = await useAPIFetch(
        `/scripture/search?q=${encodeURIComponent(trimmed)}&limit=20`
      )
      if (searchId !== latestSearchId) return

      if (data.value) {
        const payload = data.value as { results: any[] }
        const enriched = (payload.results || []).map(enrichResult)

        // Merge new results — dedup by shortLabel (book:chapter:verse).
        for (const item of enriched) {
          const existing = results.value.find((r) => r.shortLabel === item.shortLabel)
          if (existing) {
            existing.batchId = currentBatch
            existing.score = item.score
          } else {
            item.batchId = currentBatch
            results.value.push(item)
          }
        }
      }
    } catch (err) {
      console.error('Scripture search failed:', err)
    } finally {
      if (searchId === latestSearchId) {
        isSearching.value = false
      }
    }
  }

  /**
   * Debounced search — call this whenever a final transcript segment arrives.
   */
  const debouncedSearch = (query: string) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      search(query)
    }, DEBOUNCE_MS)
  }

  /**
   * Add scripture cards derived purely from parsed `BibleReference` objects.
   * No network request — fully client-side.
   * Each reference becomes a `ScriptureResult` with lang "en" and version "kjv".
   */
  const addFromBibleReferences = (refs: BibleReference[]) => {
    for (const ref of refs) {
      // shortLabel format: "bookIndex:chapter:verse[range]"
      const [bookIndexStr, chapter, verse] = ref.shortLabel.split(':')
      const bookIndex = Number(bookIndexStr)
      const bookName = bibleBooks[bookIndex - 1] || `Book ${bookIndex}`

      // Use shortLabel as a stable dedup key
      if (results.value.some((r) => r.shortLabel === ref.shortLabel)) continue

      results.value.push({
        _id: ref.shortLabel,
        book: bookIndexStr ?? '',
        chapter: chapter ?? '',
        verse: verse ?? '',
        scripture: ref.text,
        version: 'kjv',
        lang: 'en',
        score: 0,
        shortLabel: ref.shortLabel,
        displayLabel: `${bookName} ${chapter}:${verse}`,
        // Use the next batch slot so a freshly-spoken reference floats to the
        // top. Pre-increment so it sits above any AI results in the current batch.
        batchId: ++batchCounter,
      })
    }
  }

  const clearResults = () => {
    results.value = []
    lastQuery.value = ''
    batchCounter = 0
    latestSearchId++
  }

  return {
    results: computed(() => results.value),
    isSearching: computed(() => isSearching.value),
    lastQuery: computed(() => lastQuery.value),
    search,
    debouncedSearch,
    addFromBibleReferences,
    clearResults,
  }
}
