/**
 * Wraps matched portions of `text` in a <mark> tag for display via v-html.
 *
 * Strategy:
 *   1. If the trimmed query is a multi-word phrase AND it appears verbatim in
 *      the text, highlight the whole phrase as one block.
 *   2. Otherwise highlight each individual query word independently.
 *
 * The input text is HTML-escaped before replacement so no injected HTML
 * from the query or the verse content can break the page.
 */
export const highlightText = (text: string, query: string): string => {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  if (!text) return text
  if (!query?.trim()) return escapeHtml(text)

  const escapeRegex = (s: string) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const mark = (m: string) =>
    `<mark class="bg-primary-200 dark:bg-primary-700 text-inherit rounded px-0.5">${m}</mark>`

  const escapedText = escapeHtml(text)
  const trimmed = query?.trim()

  // ── Full-phrase match ──────────────────────────────────────────────────
  // When the query contains spaces and the entire phrase exists in the text,
  // highlight it as a single block rather than word-by-word.
  if (trimmed.includes(" ")) {
    const phraseRe = new RegExp(escapeRegex(trimmed), "gi")
    const withPhrase = escapedText.replace(phraseRe, mark)
    if (withPhrase !== escapedText) return withPhrase
  }

  // ── Word-by-word fallback ──────────────────────────────────────────────
  const words = trimmed
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(escapeRegex)
  if (words.length === 0) return escapedText

  const wordRe = new RegExp(`(${words.join("|")})`, "gi")
  return escapedText.replace(wordRe, mark)
}

const normaliseForMatch = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

/**
 * Picks the line of `lines` that best matches `query`, or -1 if none match.
 *
 * Scoring, strongest first:
 *   1. The whole query phrase appears in the line (punctuation ignored).
 *   2. The phrase straddles this line and the next one.
 *   3. Otherwise, the query words the line contains, weighted by word length
 *      so filler like "the" or "you" counts for little, plus a bonus for the
 *      longest run of query words appearing in order.
 * Ties go to the earliest line, which for songs is usually the first chorus.
 */
export const findBestMatchLine = (lines: string[], query: string): number => {
  const q = normaliseForMatch(query || "")
  if (!q) return -1
  const queryWords = q.split(" ")
  const normLines = lines.map(normaliseForMatch)

  let bestIndex = -1
  let bestScore = 0

  normLines.forEach((line, i) => {
    if (!line) return
    let score = 0

    if (` ${line} `.includes(` ${q} `) || line.includes(q)) {
      score = 10000 + q.length
    } else if (
      queryWords.length > 1 &&
      `${line} ${normLines[i + 1] || ""}`.includes(q)
    ) {
      score = 9000 + q.length
    } else {
      const lineWords = line.split(" ")
      const seen = new Set<string>()
      queryWords.forEach((word) => {
        if (seen.has(word)) return
        seen.add(word)
        const weight = Math.min(word.length, 8)
        if (lineWords.includes(word)) score += weight * 10
        else if (lineWords.some((w) => w.startsWith(word))) score += weight * 6
        else if (word.length >= 3 && line.includes(word)) score += weight * 3
      })

      // Longest run of consecutive query words appearing in order.
      let longestRun = 0
      for (let start = 0; start < queryWords.length; start++) {
        for (let end = queryWords.length; end > start + longestRun; end--) {
          if (line.includes(queryWords.slice(start, end).join(" "))) {
            longestRun = end - start
            break
          }
        }
      }
      if (longestRun > 1) score += longestRun * 25
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  })

  return bestIndex
}
