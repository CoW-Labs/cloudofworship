import { ref, computed } from 'vue'
import { bibleBooks } from '~/utils/constants'
import type { BibleReference } from '~/types/transcript'

export interface ScriptureResult {
  _id: string
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
}

/**
 * Composable that searches the backend scriptures collection as transcription
 * text arrives. Debounces calls so the API is not hammered on every interim word.
 */
export default function useScriptureSearch() {
  const results = ref<ScriptureResult[]>([])
  const isSearching = ref(false)
  const lastQuery = ref('')

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
  const search = async (query: string, version = 'nkjv') => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 10) return // skip very short strings

    // Avoid re-fetching the exact same query text
    if (trimmed === lastQuery.value) return
    lastQuery.value = trimmed

    isSearching.value = true
    try {
      const { data } = await useAPIFetch(
        `/scripture/search?q=${encodeURIComponent(trimmed)}&limit=5`
      )
      if (data.value) {
        const payload = data.value as { results: any[] }
        payload.results.reverse()
        const enriched = (payload.results || []).map(enrichResult)

        // Merge new results, avoiding duplicates by _id
        for (const item of enriched) {
          if (!results.value.some((r) => r._id === item._id)) {
            results.value.push(item)
          }
        }
      }
    } catch (err) {
      console.error('Scripture search failed:', err)
    } finally {
      isSearching.value = false
    }
  }

  /**
   * Debounced search — call this whenever a final transcript segment arrives.
   */
  const debouncedSearch = (query: string, version = 'nkjv') => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      search(query, version)
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
        _id: ref.shortLabel, // stable unique id
        book: bookIndexStr ?? '',
        chapter: chapter ?? '',
        verse: verse ?? '',
        scripture: ref.text, // the original matched text from the transcript
        version: 'kjv',
        lang: 'en',
        score: 0,
        shortLabel: ref.shortLabel,
        displayLabel: `${bookName} ${chapter}:${verse}`,
      })
    }
  }

  const clearResults = () => {
    results.value = []
    lastQuery.value = ''
  }

  return {
    results: computed(() => results.value),
    isSearching: computed(() => isSearching.value),
    search,
    debouncedSearch,
    addFromBibleReferences,
    clearResults,
  }
}
