import type { QuickAction } from "~/types"
import { bibleBooks } from "~/utils/constants"

/**
 * Pure matching rules for the Quick Actions search box. QuickActions owns the
 * ranking and grouping; these helpers only answer "does this query mean X".
 */

// ── Bible book names ──────────────────────────────────────────────────────

// Common abbreviations, keyed by the 1-based book index used everywhere else
// (`bibleBookIndex`). Every key is compared after `normalizeBookQuery`, so
// "1 Cor", "1cor." and "I Cor" all land on "1cor". Abbreviations that point
// at two books ("jud" for Judges or Jude, "ph" for Philippians or Philemon)
// are left out on purpose and fall through to the fuzzy match.
const BOOK_ABBREVIATIONS: Record<number, string[]> = {
  1: ["gen", "ge", "gn"],
  2: ["ex", "exo", "exod"],
  3: ["lev", "le", "lv"],
  4: ["num", "nu", "nm", "nb"],
  5: ["deut", "deu", "de", "dt"],
  6: ["josh", "jos", "jsh"],
  7: ["judg", "jdg", "jg", "jdgs"],
  8: ["ru", "rth"],
  9: ["1sam", "1sa", "1sm", "1s"],
  10: ["2sam", "2sa", "2sm", "2s"],
  11: ["1kgs", "1kg", "1ki", "1k"],
  12: ["2kgs", "2kg", "2ki", "2k"],
  13: ["1chr", "1chron", "1ch"],
  14: ["2chr", "2chron", "2ch"],
  15: ["ezr"],
  16: ["neh", "ne"],
  17: ["esth", "est", "es"],
  18: ["jb"],
  19: ["ps", "psa", "pss", "psm", "pslm", "psalm"],
  20: ["prov", "pro", "prv", "pr"],
  21: ["eccl", "eccles", "ecc", "ec", "qoh"],
  22: ["song", "sos", "ss", "sg", "songofsongs", "cant"],
  23: ["isa", "is"],
  24: ["jer", "je", "jr"],
  25: ["lam", "la"],
  26: ["ezek", "eze", "ezk"],
  27: ["dan", "da", "dn"],
  28: ["hos", "ho"],
  29: ["jl"],
  30: ["am"],
  31: ["obad", "ob"],
  32: ["jon", "jnh"],
  33: ["mic", "mc"],
  34: ["nah", "na"],
  35: ["hab", "hb"],
  36: ["zeph", "zep", "zp"],
  37: ["hag", "hg"],
  38: ["zech", "zec", "zc"],
  39: ["mal", "ml"],
  40: ["matt", "mat", "mt"],
  41: ["mrk", "mk", "mr"],
  42: ["luk", "lk"],
  43: ["jhn", "joh", "jn"],
  44: ["acts", "act", "ac"],
  45: ["rom", "ro", "rm"],
  46: ["1cor", "1co"],
  47: ["2cor", "2co"],
  48: ["gal", "ga"],
  49: ["eph", "ephes"],
  50: ["phil", "php", "pp"],
  51: ["col"],
  52: ["1thess", "1thes", "1th"],
  53: ["2thess", "2thes", "2th"],
  54: ["1tim", "1ti"],
  55: ["2tim", "2ti"],
  56: ["tit"],
  57: ["philem", "phlm", "phm", "pm"],
  58: ["heb"],
  59: ["jas", "jam", "jm"],
  60: ["1pet", "1pe", "1pt", "1p"],
  61: ["2pet", "2pe", "2pt", "2p"],
  62: ["1jn", "1jhn", "1jo", "1joh"],
  63: ["2jn", "2jhn", "2jo", "2joh"],
  64: ["3jn", "3jhn", "3jo", "3joh"],
  // 65, Jude: "jud" could be Judges too, and "jude" is its full name already.
  66: ["rev", "re", "rv", "revelations"],
}

/**
 * Lowercases a book query and folds its common spellings together: dots and
 * spaces go, and a leading ordinal ("First", "1st", "I", "II") becomes a digit.
 */
export const normalizeBookQuery = (query: string): string => {
  let value = (query || "").toLowerCase().replace(/\./g, " ").trim()
  value = value
    .replace(/^(first|1st|i)\s+/, "1 ")
    .replace(/^(second|2nd|ii)\s+/, "2 ")
    .replace(/^(third|3rd|iii)\s+/, "3 ")
  return value.replace(/\s+/g, "")
}

const normalizedBookNames = bibleBooks.map((book) => normalizeBookQuery(book))

const bookByAlias = new Map<string, number>()
normalizedBookNames.forEach((name, index) => bookByAlias.set(name, index + 1))
for (const [index, aliases] of Object.entries(BOOK_ABBREVIATIONS)) {
  for (const alias of aliases) bookByAlias.set(alias, Number(index))
}

/**
 * The 1-based index of the one book a query names, or null when it names none
 * or could mean more than one. Tries a known abbreviation or full name first,
 * then a prefix that only one book starts with ("joh" → John, "lament" →
 * Lamentations). "ph" or "jud" stay null so the caller's fuzzy match decides.
 */
export const resolveBibleBook = (query: string): number | null => {
  const normalized = normalizeBookQuery(query)
  if (normalized.length < 2) return null

  const aliased = bookByAlias.get(normalized)
  if (aliased) return aliased

  const prefixMatches = normalizedBookNames
    .map((name, index) => (name.startsWith(normalized) ? index + 1 : 0))
    .filter(Boolean)
  return prefixMatches.length === 1 ? prefixMatches[0]! : null
}

// ── Hymnal numbers ────────────────────────────────────────────────────────

// Words a church puts in front of a hymnal number: "Hymn 23", "SDA 109",
// "CCC Hymn 238", "#45". The catalogue's own hymn numbers are internal ids,
// never shown and not any hymnal's numbering, so a number query is matched
// against song and hymn titles instead (churches save "Hymn 84" as a song).
// The one real hymnal in the catalogue is the SDA Hymnal: its hymns carry
// "SDAH109" in their author field (see `isSdaHymnalNumber`).
const HYMNAL_NUMBER_PATTERN =
  /^(?:((?:sdah?|ccc)(?:\s*hymn(?:s|al)?)?|hymn(?:s|al)?)\s*(?:no\.?|number|#)?|#|no\.?)\s*(\d{1,4})$/i

export const parseHymnalNumberQuery = (
  query: string
): { prefix: string; number: string } | null => {
  const match = (query || "").trim().match(HYMNAL_NUMBER_PATTERN)
  if (!match) return null
  return { prefix: (match[1] || "").toLowerCase(), number: match[2]! }
}

/** True when a hymn's author field is the SDA Hymnal entry `number` ("SDAH109"). */
export const isSdaHymnalNumber = (author: string, number: string): boolean => {
  const match = (author || "").trim().match(/^sdah\s*(\d+)$/i)
  return !!match && Number(match[1]) === Number(number)
}

/** True when `title` carries `number` as a whole number, so 23 never matches 238. */
export const titleHasNumber = (title: string, number: string): boolean =>
  new RegExp(`(^|\\D)0*${number}(\\D|$)`).test(title || "")

// ── Runnable actions ──────────────────────────────────────────────────────

// Words that carry no intent on their own. "love your enemies" should be
// judged on "love" and "enemies", not on "your" turning up in a settings
// description.
const STOP_WORDS = new Set([
  "a", "an", "and", "be", "for", "i", "in", "is", "it", "me", "my", "of",
  "on", "our", "the", "to", "with", "your",
])

const tokenize = (value: string): string[] =>
  (value || "").toLowerCase().split(/[^a-z0-9']+/).filter(Boolean)

// Plain Levenshtein, capped: callers only ask "within one edit?".
const editDistance = (a: string, b: string): number => {
  if (Math.abs(a.length - b.length) > 1) return 2
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]!
    previous[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j]!
      previous[j] = Math.min(
        above + 1,
        previous[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return previous[b.length]!
}

// How well a query word matches an action word: 1 when it starts it
// ("countd" → "countdown"), 0.9 when, from five letters up, it is one slip
// away from the word or its start ("dispay" → "display"), else 0. A slip
// scores lower so "vimeo" still prefers "Vimeo" over "video". Shorter words
// get no slack: one edit is too much of "love" ("live") or "well" ("welcome").
const tokenMatchesWord = (token: string, word: string): number => {
  if (word.startsWith(token)) return 1
  if (token.length < 5) return 0
  return editDistance(token, word) <= 1 ||
    editDistance(token, word.slice(0, token.length)) <= 1
    ? 0.9
    : 0
}

const bestWordMatch = (token: string, words: string[]): number =>
  Math.max(0, ...words.map((word) => tokenMatchesWord(token, word)))

/**
 * How well a query describes one of the app's own runnable actions, from 0
 * (not at all) to 1 (every meaningful word found). Matched on whole words of
 * the name, description and keywords rather than fuzzysort's letters-in-order
 * rule, which let "grace" reach "Pause Stage Clock" and "jn 3 16" reach
 * "Join Community" through scattered letters.
 */
export const actionMatchStrength = (
  action: QuickAction,
  query: string
): number => {
  const name = (action?.name || "").toLowerCase()
  const squashedQuery = (query || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  // "darkmode", "addmedia": the name with its spaces typed away.
  if (
    squashedQuery.length >= 3 &&
    name.replace(/[^a-z0-9]/g, "").includes(squashedQuery)
  ) {
    return 1
  }

  const allTokens = tokenize(query).filter((token) => !/^\d+$/.test(token))
  const meaningful = allTokens.filter((token) => !STOP_WORDS.has(token))
  const tokens = meaningful.length ? meaningful : allTokens
  if (!tokens.length) return 0

  const words = tokenize(`${action?.name} ${action?.desc} ${action?.meta}`)
  const nameWords = tokenize(action?.name || "")
  let score = 0
  for (const token of tokens) {
    // A word found only in the description or keywords counts for less, so
    // "add media" ranks "Add Media" above "Add Song".
    score += Math.max(
      bestWordMatch(token, nameWords),
      bestWordMatch(token, words) * 0.75
    )
  }
  return score / tokens.length
}

/**
 * An action shows in results only when at least half the query describes it,
 * and only when it is close to the best-described action: "add media" keeps
 * "Add Media" (1) and drops "Add Song" (0.5), while "upload video" keeps both
 * of its half matches.
 */
export const ACTION_MATCH_THRESHOLD = 0.5
export const ACTION_MATCH_SPREAD = 0.25

// ── Song titles ───────────────────────────────────────────────────────────

/** A title folded for comparison: "Good & Loved (ft. X)" → "good and loved". */
export const normalizeSongTitle = (value?: string): string =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s*[([]?\b(ft\.?|feat\.?|featuring)\b.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * How exactly a song answers a title query: 0 for the title (and, in a
 * "Promises by Maverick City" query, the artist too), 1 for the title alone
 * when the query named a different artist, 2 for anything else.
 */
export const songTitleMatchRank = (
  song: { title?: string; artist?: string; author?: string } | undefined,
  query: string
): 0 | 1 | 2 => {
  const title = normalizeSongTitle(song?.title)
  const normalizedQuery = normalizeSongTitle(query)
  if (!title || !normalizedQuery) return 2
  if (title === normalizedQuery) return 0

  const byArtist = normalizedQuery.match(/^(.+?) by (.+)$/)
  if (!byArtist || title !== byArtist[1]) return 2
  const artist = normalizeSongTitle(song?.artist || song?.author)
  const wanted = byArtist[2]!
  return artist && (artist.includes(wanted) || wanted.includes(artist)) ? 0 : 1
}

// ── Library content (songs, hymns, verses) ────────────────────────────────

/**
 * fuzzysort score floor for matching a song, hymn or book by its title.
 * Measured on the hymn catalogue: real matches score above -100, a title with
 * one letter missing ("amazng grace", "blesed assurance") about -18,000, and
 * letters merely scattered in order ("dark mode" → "Storm the Forts of
 * Darkness", "stage" → "The Stranger of Galilee") -26,000 and below.
 */
export const CONTENT_NAME_THRESHOLD = -20000

/**
 * Text folded for whole-word matching, padded with spaces so " grace" finds
 * a word that starts with "grace" anywhere, including the first.
 */
export const normalizeSearchText = (value?: string): string =>
  ` ${(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `

/**
 * How a query sits in a song's lyrics, a hymn's first line or a verse:
 * 0 when it appears as a phrase, 1 when every word of it starts a word there,
 * 2 when it doesn't. Lyrics used to be fuzzy-matched like titles, and a long
 * lyric holds almost any letters in order, so quizzes and sermon notes saved
 * as songs came back for "sda109", "5 min timer" and even "zzqqxxjj".
 */
export const textMatchRank = (
  normalizedText: string,
  query: string
): 0 | 1 | 2 => {
  const normalizedQuery = normalizeSearchText(query).trim()
  if (normalizedQuery.length < 3) return 2
  if (normalizedText.includes(` ${normalizedQuery}`)) return 0
  // Scattered words only count when two of them carry meaning: "it", "is" and
  // "well" turn up somewhere in most long lyrics, "love" and "enemies" don't.
  const words = normalizedQuery.split(" ")
  if (words.filter((word) => !STOP_WORDS.has(word)).length < 2) return 2
  return words.every((word) => normalizedText.includes(` ${word}`)) ? 1 : 2
}

/**
 * True when at least one meaningful word of the query starts a word of the
 * text. The scripture API answers anything, gibberish included, with some
 * verse; one shared word is the least a verse needs to be offered.
 */
export const sharesMeaningfulWord = (
  normalizedText: string,
  query: string
): boolean =>
  normalizeSearchText(query)
    .trim()
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word))
    .some((word) => normalizedText.includes(` ${word}`))

/**
 * True when every meaningful word of the query is a whole word of the
 * action's name: "dark mode" names "Toggle Dark Mode", "alert" names "Add
 * Banners/Alert". Such a query is a command, not a song or verse search.
 */
export const namesActionExactly = (
  action: QuickAction,
  query: string
): boolean => {
  const tokens = tokenize(query).filter(
    (token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token)
  )
  if (!tokens.length) return false
  const nameWords = new Set(tokenize(action?.name || ""))
  return tokens.every((token) => nameWords.has(token))
}
