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
  /** bookIndex:chapter:verse e.g. "43:3:16" — used by updateOrCreateBible */
  shortLabel: string
  /** Human-readable label e.g. "John 3:16" */
  displayLabel: string
}

/**
 * Composable that searches the backend scriptures collection as transcription
 * text arrives. Each call replaces the visible results with the queried
 * segment's matches (plus any references parsed from that same segment).
 */
export default function useScriptureSearch() {
  const results = ref<ScriptureResult[]>([])
  const isSearching = ref(false)
  const lastQuery = ref('')
  let latestSearchId = 0

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
   * Convert a parsed `BibleReference` into a `ScriptureResult` card.
   * Fully client-side — no network request. lang "en", version "kjv".
   */
  const referenceToResult = (ref: BibleReference): ScriptureResult => {
    // shortLabel format: "bookIndex:chapter:verse[range]"
    const [bookIndexStr, chapter, verse] = ref.shortLabel.split(':')
    const bookIndex = Number(bookIndexStr)
    const bookName = bibleBooks[bookIndex - 1] || `Book ${bookIndex}`
    return {
      _id: ref.shortLabel,
      book: bookIndexStr ?? '',
      chapter: chapter ?? '',
      verse: verse ?? '',
      scripture: ref.text,
      version: 'kjv',
      lang: 'en',
      shortLabel: ref.shortLabel,
      displayLabel: `${bookName} ${chapter}:${verse}`,
    }
  }

  /** Dedup a list of results by `shortLabel`, keeping the first occurrence. */
  const dedupeByShortLabel = (items: ScriptureResult[]): ScriptureResult[] => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.shortLabel)) return false
      seen.add(item.shortLabel)
      return true
    })
  }

  /**
   * Search scriptures for a single transcript segment and replace the visible
   * results with that segment's matches (per-segment authoritative — the panel
   * intentionally shows only the most recent segment).
   *
   * `references` are scripture references parsed from the same segment. They are
   * explicit (the verse was named aloud), so they sort ahead of the fuzzy
   * backend matches and are folded into the SAME atomic update — this avoids the
   * earlier race where the async response wiped out freshly-added references.
   */
  const search = async (query: string, references: BibleReference[] = []) => {
    const referenceResults = dedupeByShortLabel(references.map(referenceToResult))
    const trimmed = query?.trim()
    const searchId = ++latestSearchId

    // Too short to fuzzy-search. Surface this segment's explicit references if it
    // has any; otherwise leave the current results untouched so a brief segment
    // (e.g. "Amen.") doesn't blank the panel.
    if (!trimmed || trimmed.length < 10) {
      if (referenceResults.length) results.value = referenceResults
      isSearching.value = false
      return
    }

    // Same text already searched — re-apply this segment's references but skip
    // the redundant network call (version-agnostic, cross-translation search).
    if (trimmed === lastQuery.value) {
      if (referenceResults.length) {
        results.value = dedupeByShortLabel([...referenceResults, ...results.value])
      }
      isSearching.value = false
      return
    }
    lastQuery.value = trimmed

    isSearching.value = true
    try {
      const { data } = await useAPIFetch(
        `/scripture/search?q=${encodeURIComponent(trimmed)}&limit=20`
      )
      if (searchId !== latestSearchId) return

      if (data.value) {
        const payload = data.value as { results: any[] }
        const backendResults = (payload.results || []).map(enrichResult)
        // References first (explicit beats fuzzy), then backend matches, deduped.
        results.value = dedupeByShortLabel([...referenceResults, ...backendResults])
      }
    } catch (err) {
      console.error('Scripture search failed:', err)
    } finally {
      if (searchId === latestSearchId) {
        isSearching.value = false
      }
    }
  }

  const clearResults = () => {
    results.value = []
    lastQuery.value = ''
    latestSearchId++
  }

  return {
    results: computed(() => results.value),
    isSearching: computed(() => isSearching.value),
    lastQuery: computed(() => lastQuery.value),
    search,
    clearResults,
  }
}
