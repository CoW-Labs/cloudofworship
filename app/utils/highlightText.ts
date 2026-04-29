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
  const trimmed = query.trim()

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
