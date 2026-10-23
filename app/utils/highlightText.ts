/**
 * Wraps matched portions of `text` in a <mark> tag for display via v-html.
 *
 * Strategy:
 *   1. If the trimmed query is a multi-word phrase AND it appears verbatim in
 *      the text, highlight the whole phrase as one block.
 *   2. Otherwise highlight each run of consecutive matching query words as one
 *      block, and any leftover single words independently.
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

  // ── Consecutive-word runs ──────────────────────────────────────────────
  // Two or more query words that sit next to each other in the text (and in
  // the same order in the query) are highlighted as one block, so a line like
  // "You are the One that we praise" reads as "[You are the One] that we
  // [praise]" instead of every word lit up separately.
  const tokenRe = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
  const queryTokens = trimmed.toLowerCase().match(tokenRe) || []
  if (queryTokens.length === 0) return escapedText
  const wordRe = new RegExp(`(${queryTokens.map(escapeRegex).join("|")})`, "gi")
  const markWords = (segment: string) => escapeHtml(segment).replace(wordRe, mark)
  const textTokens = [...text.matchAll(tokenRe)].map((m) => ({
    word: m[0].toLowerCase(),
    start: m.index as number,
    end: (m.index as number) + m[0].length,
  }))

  const runs: { start: number; end: number }[] = []
  for (let i = 0; i < textTokens.length; ) {
    let bestLen = 0
    for (let s = 0; s < queryTokens.length; s++) {
      let len = 0
      while (
        s + len < queryTokens.length &&
        i + len < textTokens.length &&
        textTokens[i + len]!.word === queryTokens[s + len] &&
        // only join words on the same line
        (len === 0 ||
          !text.slice(textTokens[i + len - 1]!.end, textTokens[i + len]!.start).includes("\n"))
      ) {
        len++
      }
      if (len > bestLen) bestLen = len
    }
    if (bestLen >= 2) {
      runs.push({ start: textTokens[i]!.start, end: textTokens[i + bestLen - 1]!.end })
      i += bestLen
    } else {
      i++
    }
  }

  // ── Build output: runs as one mark, everything else word-by-word ───────
  let out = ""
  let cursor = 0
  for (const run of runs) {
    out += markWords(text.slice(cursor, run.start))
    out += mark(escapeHtml(text.slice(run.start, run.end)))
    cursor = run.end
  }
  out += markWords(text.slice(cursor))
  return out
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
