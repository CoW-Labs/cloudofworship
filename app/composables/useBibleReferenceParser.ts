import type { BibleReference } from '~/types/transcript'
import { bibleBooks, bibleBookChapters } from '~/utils/constants'

// Mapping of book names and their variations to book index (1-based)
const bookNameVariations: Record<string, number> = {}

// Build the mapping
bibleBooks.forEach((book, index) => {
  const bookIndex = index + 1
  const bookLower = book.toLowerCase()

  // Add the full name
  bookNameVariations[bookLower] = bookIndex

  // Add common abbreviations and variations
  if (book === 'Genesis') {
    bookNameVariations['gen'] = bookIndex
  } else if (book === 'Exodus') {
    bookNameVariations['ex'] = bookIndex
    bookNameVariations['exod'] = bookIndex
  } else if (book === 'Leviticus') {
    bookNameVariations['lev'] = bookIndex
  } else if (book === 'Numbers') {
    bookNameVariations['num'] = bookIndex
  } else if (book === 'Deuteronomy') {
    bookNameVariations['deut'] = bookIndex
    bookNameVariations['deu'] = bookIndex
  } else if (book === 'Joshua') {
    bookNameVariations['josh'] = bookIndex
  } else if (book === 'Judges') {
    bookNameVariations['judg'] = bookIndex
  } else if (book === '1 Samuel') {
    bookNameVariations['1 sam'] = bookIndex
    bookNameVariations['first samuel'] = bookIndex
    bookNameVariations['1st samuel'] = bookIndex
  } else if (book === '2 Samuel') {
    bookNameVariations['2 sam'] = bookIndex
    bookNameVariations['second samuel'] = bookIndex
    bookNameVariations['2nd samuel'] = bookIndex
  } else if (book === '1 Kings') {
    bookNameVariations['1 kgs'] = bookIndex
    bookNameVariations['first kings'] = bookIndex
    bookNameVariations['1st kings'] = bookIndex
  } else if (book === '2 Kings') {
    bookNameVariations['2 kgs'] = bookIndex
    bookNameVariations['second kings'] = bookIndex
    bookNameVariations['2nd kings'] = bookIndex
  } else if (book === '1 Chronicles') {
    bookNameVariations['1 chr'] = bookIndex
    bookNameVariations['1 chron'] = bookIndex
    bookNameVariations['first chronicles'] = bookIndex
    bookNameVariations['1st chronicles'] = bookIndex
  } else if (book === '2 Chronicles') {
    bookNameVariations['2 chr'] = bookIndex
    bookNameVariations['2 chron'] = bookIndex
    bookNameVariations['second chronicles'] = bookIndex
    bookNameVariations['2nd chronicles'] = bookIndex
  } else if (book === 'Nehemiah') {
    bookNameVariations['neh'] = bookIndex
  } else if (book === 'Esther') {
    bookNameVariations['est'] = bookIndex
  } else if (book === 'Psalms') {
    bookNameVariations['ps'] = bookIndex
    bookNameVariations['psalm'] = bookIndex
    bookNameVariations['psa'] = bookIndex
  } else if (book === 'Proverbs') {
    bookNameVariations['prov'] = bookIndex
    bookNameVariations['pro'] = bookIndex
    bookNameVariations['proverb'] = bookIndex
  } else if (book === 'Ecclesiastes') {
    bookNameVariations['eccl'] = bookIndex
    bookNameVariations['ecc'] = bookIndex
  } else if (book === 'Song of Solomon') {
    bookNameVariations['song'] = bookIndex
    bookNameVariations['songs'] = bookIndex
    bookNameVariations['solomon'] = bookIndex
    bookNameVariations['sos'] = bookIndex
    bookNameVariations['song of songs'] = bookIndex
    bookNameVariations['songs of solomon'] = bookIndex
    bookNameVariations['canticles'] = bookIndex
  } else if (book === 'Isaiah') {
    bookNameVariations['isa'] = bookIndex
  } else if (book === 'Jeremiah') {
    bookNameVariations['jer'] = bookIndex
  } else if (book === 'Lamentations') {
    bookNameVariations['lam'] = bookIndex
    bookNameVariations['lamentation'] = bookIndex
  } else if (book === 'Ezekiel') {
    bookNameVariations['ezek'] = bookIndex
    bookNameVariations['eze'] = bookIndex
  } else if (book === 'Daniel') {
    bookNameVariations['dan'] = bookIndex
  } else if (book === 'Hosea') {
    bookNameVariations['hos'] = bookIndex
  } else if (book === 'Obadiah') {
    bookNameVariations['obad'] = bookIndex
  } else if (book === 'Micah') {
    bookNameVariations['mic'] = bookIndex
  } else if (book === 'Nahum') {
    bookNameVariations['nah'] = bookIndex
  } else if (book === 'Habakkuk') {
    bookNameVariations['hab'] = bookIndex
  } else if (book === 'Zephaniah') {
    bookNameVariations['zeph'] = bookIndex
  } else if (book === 'Haggai') {
    bookNameVariations['hag'] = bookIndex
  } else if (book === 'Zechariah') {
    bookNameVariations['zech'] = bookIndex
  } else if (book === 'Malachi') {
    bookNameVariations['mal'] = bookIndex
  } else if (book === 'Matthew') {
    bookNameVariations['matt'] = bookIndex
    bookNameVariations['mat'] = bookIndex
  } else if (book === 'Mark') {
    bookNameVariations['mk'] = bookIndex
  } else if (book === 'Luke') {
    bookNameVariations['lk'] = bookIndex
    bookNameVariations['luk'] = bookIndex
  } else if (book === 'John') {
    bookNameVariations['jn'] = bookIndex
    bookNameVariations['joh'] = bookIndex
  } else if (book === 'Acts of the Apostles') {
    bookNameVariations['acts'] = bookIndex
    bookNameVariations['act'] = bookIndex
    bookNameVariations['acts of apostles'] = bookIndex
  } else if (book === 'Romans') {
    bookNameVariations['rom'] = bookIndex
  } else if (book === '1 Corinthians') {
    bookNameVariations['1 cor'] = bookIndex
    bookNameVariations['first corinthians'] = bookIndex
    bookNameVariations['1st corinthians'] = bookIndex
  } else if (book === '2 Corinthians') {
    bookNameVariations['2 cor'] = bookIndex
    bookNameVariations['second corinthians'] = bookIndex
    bookNameVariations['2nd corinthians'] = bookIndex
  } else if (book === 'Galatians') {
    bookNameVariations['gal'] = bookIndex
  } else if (book === 'Ephesians') {
    bookNameVariations['eph'] = bookIndex
  } else if (book === 'Philippians') {
    bookNameVariations['phil'] = bookIndex
  } else if (book === 'Colossians') {
    bookNameVariations['col'] = bookIndex
  } else if (book === '1 Thessalonians') {
    bookNameVariations['1 thess'] = bookIndex
    bookNameVariations['1 thes'] = bookIndex
    bookNameVariations['first thessalonians'] = bookIndex
    bookNameVariations['1st thessalonians'] = bookIndex
  } else if (book === '2 Thessalonians') {
    bookNameVariations['2 thess'] = bookIndex
    bookNameVariations['2 thes'] = bookIndex
    bookNameVariations['second thessalonians'] = bookIndex
    bookNameVariations['2nd thessalonians'] = bookIndex
  } else if (book === '1 Timothy') {
    bookNameVariations['1 tim'] = bookIndex
    bookNameVariations['first timothy'] = bookIndex
    bookNameVariations['1st timothy'] = bookIndex
  } else if (book === '2 Timothy') {
    bookNameVariations['2 tim'] = bookIndex
    bookNameVariations['second timothy'] = bookIndex
    bookNameVariations['2nd timothy'] = bookIndex
  } else if (book === 'Titus') {
    bookNameVariations['tit'] = bookIndex
  } else if (book === 'Philemon') {
    bookNameVariations['phm'] = bookIndex
    bookNameVariations['philem'] = bookIndex
  } else if (book === 'Hebrews') {
    bookNameVariations['heb'] = bookIndex
  } else if (book === 'James') {
    bookNameVariations['jas'] = bookIndex
  } else if (book === '1 Peter') {
    bookNameVariations['1 pet'] = bookIndex
    bookNameVariations['first peter'] = bookIndex
    bookNameVariations['1st peter'] = bookIndex
  } else if (book === '2 Peter') {
    bookNameVariations['2 pet'] = bookIndex
    bookNameVariations['second peter'] = bookIndex
    bookNameVariations['2nd peter'] = bookIndex
  } else if (book === '1 John') {
    bookNameVariations['1 jn'] = bookIndex
    bookNameVariations['first john'] = bookIndex
    bookNameVariations['1st john'] = bookIndex
  } else if (book === '2 John') {
    bookNameVariations['2 jn'] = bookIndex
    bookNameVariations['second john'] = bookIndex
    bookNameVariations['2nd john'] = bookIndex
  } else if (book === '3 John') {
    bookNameVariations['3 jn'] = bookIndex
    bookNameVariations['third john'] = bookIndex
    bookNameVariations['3rd john'] = bookIndex
  } else if (book === 'Revelation') {
    bookNameVariations['rev'] = bookIndex
    bookNameVariations['revelations'] = bookIndex
    bookNameVariations['revelation of john'] = bookIndex
  }
})

/**
 * Books whose name is a genuine English plural, so a dropped "s" is a plausible
 * transcription slip ("1 King 4:7", "Roman 8:28") rather than a different word.
 *
 * Listed explicitly instead of stripping every trailing "s": that would produce
 * nonsense ("Exodu", "Titu", "Jame") and — worse — everyday words that would
 * false-positive on ordinary speech ("Numbers" -> "number 1 2", where a phrase
 * like "point number 2 3 times" would resolve to a verse).
 */
const PLURAL_BOOK_NAMES = [
  'kings', 'chronicles', 'judges', 'psalms', 'proverbs', 'lamentations',
  'romans', 'corinthians', 'galatians', 'ephesians', 'philippians',
  'colossians', 'thessalonians', 'hebrews',
]

// Register the singular of each, keeping any numeric prefix: "1 kings" -> "1 king".
// Spoken prefixes need no separate entry — normalizeSpokenNumbers turns
// "first king" into "1 king" before the lookup runs.
bibleBooks.forEach((book, index) => {
  const lower = book.toLowerCase()
  const withoutPrefix = lower.replace(/^\d\s+/, '')
  if (!PLURAL_BOOK_NAMES.includes(withoutPrefix)) return

  const singular = lower.slice(0, -1)
  if (!bookNameVariations[singular]) {
    bookNameVariations[singular] = index + 1
  }
})

/**
 * Normalize spoken number prefixes to digits
 * Converts "second corinthians" -> "2 corinthians", "third john" -> "3 john", etc.
 */
function normalizeSpokenNumbers(text: string): string {
  return text
    .replace(/\bfirst\s+/gi, '1 ')
    .replace(/\bsecond\s+/gi, '2 ')
    .replace(/\bthird\s+/gi, '3 ')
    .replace(/\b1st\s+/gi, '1 ')
    .replace(/\b2nd\s+/gi, '2 ')
    .replace(/\b3rd\s+/gi, '3 ')
}

/**
 * Map of English number words to their integer values.
 * Covers 1–150+, which spans the full range of Bible chapter/verse numbers
 * (the highest verse is Psalm 119:176).
 */
const NUMBER_WORDS: Record<string, number> = {}

  // Build the map programmatically so every combination is covered.
  ; (() => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
      'sixteen', 'seventeen', 'eighteen', 'nineteen']
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty',
      'sixty', 'seventy', 'eighty', 'ninety']

    // 1–9
    for (let i = 1; i <= 9; i++) NUMBER_WORDS[ones[i]!] = i

    // 10–19
    for (let i = 0; i < 10; i++) NUMBER_WORDS[teens[i]!] = 10 + i

    // 20–99
    for (let t = 2; t <= 9; t++) {
      NUMBER_WORDS[tens[t]!] = t * 10
      for (let o = 1; o <= 9; o++) {
        const val = t * 10 + o
        NUMBER_WORDS[`${tens[t]} ${ones[o]}`] = val   // "fifty seven"
        NUMBER_WORDS[`${tens[t]}-${ones[o]}`] = val    // "fifty-seven"
      }
    }

    // 100–176 (covers the full Bible verse range)
    NUMBER_WORDS['hundred'] = 100
    NUMBER_WORDS['one hundred'] = 100
    NUMBER_WORDS['a hundred'] = 100
    for (let i = 1; i <= 76; i++) {
      const iWord = i <= 19 ? (i < 10 ? ones[i]! : teens[i - 10]!)
        : `${tens[Math.floor(i / 10)]}${i % 10 ? ` ${ones[i % 10]}` : ''}`
      NUMBER_WORDS[`hundred ${iWord}`] = 100 + i
      NUMBER_WORDS[`hundred and ${iWord}`] = 100 + i
      NUMBER_WORDS[`one hundred ${iWord}`] = 100 + i
      NUMBER_WORDS[`one hundred and ${iWord}`] = 100 + i
      NUMBER_WORDS[`a hundred and ${iWord}`] = 100 + i
    }
  })()

const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS)
  // longest first so "twenty one" is tried before "twenty"
  .sort((a, b) => b.length - a.length)
  .join('|')

/**
 * Pre-process text so that every spoken-number chapter/verse token becomes a digit,
 * making all downstream patterns purely digit-based and much simpler.
 *
 * Examples:
 *   "first Timothy six from verse three to 12"
 *     → "1 Timothy 6 from verse 3 to 12"
 *   "third John verse four"
 *     → "3 John verse 4"
 *   "Psalm twenty three verse one"
 *     → "Psalm 23 verse 1"
 */
function replaceSpokenNumbers(text: string): string {
  // Replace book-prefix ordinals first (first/second/third at start of a ref)
  let out = normalizeSpokenNumbers(text)

  // Replace number words that appear directly after "chapter", "verse", "verses",
  // "from verse", "to", "through", or after a chapter digit (as the verse word).
  // We do a global replace of all standalone number-word tokens to their digit equivalent.
  const numWordRe = new RegExp(`\\b(${NUMBER_WORD_PATTERN})\\b`, 'gi')
  out = out.replace(numWordRe, (match) => {
    const n = NUMBER_WORDS[match.toLowerCase()]
    return n !== undefined ? String(n) : match
  })

  return out
}

/**
 * Smooth over how speech recognition writes a reference, so the patterns only
 * meet one shape. Every edit only deletes or joins characters, which the
 * processed-to-raw index map below copes with. Keep in step with the API's
 * `bibleReferenceParser.js`, which is the copy live transcription runs.
 */
function normalizeReferenceText(text: string, { looseSoundAlike = false } = {}): string {
  let out = text

  // "Mark 3? From breast 13 to 15": the recogniser heard "verse" as "breast".
  // On its own that is a body part, so it only counts when a number sits just
  // before it (the chapter), or when the caller knows a passage is in play.
  if (looseSoundAlike) {
    out = out.replace(/\bbreasts?(?=\s+\d)/gi, 'verse')
  } else {
    out = out.replace(/(\d[^a-z\d]*(?:[a-z']+\s+){0,1})breasts?(?=\s+\d)/gi, '$1verse')
  }

  // "John chapter 4, verse 23" / "John chapter 1. Verse 12" / "Mark 3? From verse
  // 13": a stop between the number and the word "verse" is the recogniser's
  // punctuation, not a break.
  out = out.replace(/(\d)\s*[,.;?]\s*(?=(?:from\s+)?verses?\b)/gi, '$1 ')

  // "Luke chapter 1, you can read from verse 35" / "Genesis chapter 9, again,
  // verse 1": commas around a few filler words. Only commas bridge these, so a
  // full stop still ends the sentence.
  out = out.replace(/(\d)\s*,\s*((?:[a-z']+,?\s+){1,4})(?=verses?\b)/gi, (_match, digit, fillers) =>
    `${digit} ${String(fillers).replace(/,/g, '')}`,
  )

  // "first, Timothy": a stop after the ordinal of a numbered book.
  out = out.replace(/\b(1st|2nd|3rd|first|second|third)\s*,\s*(?=[a-z])/gi, '$1 ')

  // "verse 24, of Genesis chapter 2": a stop before "of" in a verse-first phrase.
  out = out.replace(/(\bverses?\s+\d+)\s*[,.;]\s*(?=(?:of|in)\s)/gi, '$1 ')

  // "the book of Joshua. Chapter 14": a stop between a book and its chapter.
  out = out.replace(/\b([a-z]+)\s*[,.;]\s*(?=chapters?\s+\d)/gi, (match, word) =>
    bookNameVariations[String(word).toLowerCase()] ? `${word} ` : match,
  )

  // "Psalms 1 1 4": three digits said one by one are one number when the book has
  // that many chapters (only Psalms in practice). Otherwise leave them alone.
  out = out.replace(/\b([a-z]+)\s+(\d)\s+(\d)\s+(\d)\b(?!\s*[:-]?\s*\d)/gi, (match, book, a, b, c) => {
    const bookIndex = findBookIndex(String(book).toLowerCase())
    const joined = parseInt(`${a}${b}${c}`, 10)
    if (bookIndex && joined <= (bibleBookChapters[bookIndex - 1] ?? 0)) return `${book} ${joined}`
    return match
  })

  // "Psalm 1 19 verse 11": the recogniser split 119 in two, and a verse follows,
  // so these two numbers cannot be chapter and verse.
  out = out.replace(/\b(psalms?)\s+(\d)\s+(\d{2})\b(?=\s+verses?\b)/gi, (match, book, a, bc) => {
    const joined = parseInt(`${a}${bc}`, 10)
    return joined <= 150 ? `${book} ${joined}` : match
  })

  return out
}

/**
 * Build a processed-to-raw index map once for each raw/processed string pair and use
 * that map for lookups. This avoids trying to "resync" by scanning for matching
 * characters, which breaks when preprocessing inserts digits that never appear in
 * the original raw text (for example, "twenty three" -> "23").
 */
function buildProcessedToRawIndexMap(rawText: string, processedText: string): number[] {
  const rawLength = rawText.length
  const processedLength = processedText.length

  const lcs: number[][] = Array.from({ length: rawLength + 1 }, () =>
    Array<number>(processedLength + 1).fill(0),
  )

  for (let r = rawLength - 1; r >= 0; r--) {
    for (let p = processedLength - 1; p >= 0; p--) {
      if (rawText[r]!.toLowerCase() === processedText[p]!.toLowerCase()) {
        lcs[r]![p] = lcs[r + 1]![p + 1]! + 1
      } else {
        lcs[r]![p] = Math.max(lcs[r + 1]![p]!, lcs[r]![p + 1]!)
      }
    }
  }

  const map = Array<number>(processedLength + 1).fill(rawLength)
  let r = 0
  let p = 0
  map[0] = 0

  while (r < rawLength && p < processedLength) {
    if (rawText[r]!.toLowerCase() === processedText[p]!.toLowerCase()) {
      r++
      p++
      map[p] = r
    } else if (lcs[r + 1]![p]! >= lcs[r]![p + 1]!) {
      r++
    } else {
      p++
      map[p] = r
    }
  }

  while (p < processedLength) {
    p++
    map[p] = r
  }

  return map
}

function mapIndexToRaw(map: number[], processedText: string, processedIndex: number): number {
  const clamped = Math.max(0, Math.min(processedIndex, processedText.length))
  return map[clamped] ?? 0
}

// The end of a verse range said without the word "verse": "42 6 to 7" or "6-7".
// Skipped when a plural noun follows ("6 to 7 people"), which is only speech.
const RANGE_END = String.raw`(?:\s*-\s*|\s+(?:to|through)\s+)(\d+)\b(?!\s+(?:people|men|women|children|persons|feet|(?!says\b|was\b|has\b|this\b|his\b|is\b|as\b|us\b)[a-z]{2,}s)\b)`

// A book and a bare chapter ("in Philippians 2.") is a chapter mention. Books
// whose names are also everyday words stay out for now, since "Mark 5 people" and
// "Numbers 14" are as likely to be speech. Psalms has its own pattern.
const BARE_CHAPTER_EXCLUDED = new Set([
  'psalms', 'judges', 'job', 'numbers', 'mark', 'luke', 'john', 'acts of the apostles', 'james', 'song of solomon',
])
const BARE_CHAPTER_BOOKS = bibleBooks
  .map(book => book.toLowerCase())
  .filter(book => !BARE_CHAPTER_EXCLUDED.has(book))
  .sort((a, b) => b.length - a.length)
  .map(book => book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  .join('|')
// The number has to end the phrase: a stop, the end of the piece, or a plain
// function word. A number, verse or colon after it makes it something else.
const BARE_CHAPTER_END = String.raw`(?=\s*(?:[.,;?!]|$)|\s+(?:and|the|we|he|she|it|you|i|let|so|then|says|said|where|which|that|there|is|was|god|jesus|paul)\b)(?!\s*[:\-,.;]?\s*(?:verses?\b|\d))`

// Each entry is [regex, chapterGroup, verseStartGroup, verseEndGroup, bookGroup?].
// For patterns without an explicit chapter (single-chapter books), chapterGroup is 0 (= use 1).
const PATTERNS: [RegExp, number, number, number, number?][] = [
  // Standard format: "John 3:16" or "1 John 3:16-18" or "Second Corinthians 3:16"
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?/gi, 3, 4, 5],

  // Verse first: "verse 24 of Genesis chapter 2" / "verses 22 to 23 in Ephesians 5".
  // The book is group 3 here, so this entry names its book group.
  [/verses?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?\s+(?:of|in|from)\s+(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(?:chapters?\s+)?(\d+)\b/gi, 5, 1, 2, 3],

  // Verbose format: "John chapter 3 verse 16" or "Second Corinthians chapter 5 verse 17"
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+chapter\s+(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?/gi, 3, 4, 5],

  // Mixed format: "John 3 verse 16" or "John 3 verse 16 to 18"
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(?:chapters?\s+)?(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?/gi, 3, 4, 5],

  // Spoken format with filler words: "1 Timothy 6 from verse 3 to 12"
  // Tolerates up to 4 filler/connector words between chapter and verse keyword
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(?:chapters?\s+)?(\d+)(?:\s+(?!verses?\b|from\b)\w+){0,4}\s+(?:from\s+)?verses?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?/gi, 3, 4, 5],

  // Chapter and verse with the word "verse" dropped: "Joshua chapter 14 10"
  [new RegExp(String.raw`(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+chapters?\s+(\d+)\s+(\d+)(?:${RANGE_END})?`, 'gi'), 3, 4, 5],

  // Spoken chapter+verse without colon or "verse" keyword: "1 Corinthians 15 57",
  // and a range said without the word verse: "Isaiah 42 6 to 7".
  // Must be two consecutive numbers after the book name.
  [new RegExp(String.raw`(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(\d+)\s+(\d+)(?:${RANGE_END})?`, 'gi'), 3, 4, 5],

  // Single-chapter book format: "3 John verse 4" or "Jude verse 3 to 5"
  // No chapter number — verse is treated as chapter 1 verse N
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+(?:from\s+)?verses?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?/gi, 0, 3, 4],

  // Chapter only, last so a verse reference wins any overlap. "Psalm 23" and
  // "Psalms 114" count on their own; "Joshua chapter 14" needs the word chapter.
  // Read as verse 1 of that chapter and flagged `chapterOnly` (verse group -1).
  [/\b(psalms?)\s+(\d+)\b(?!\s*[:,.;]?\s*(?:verses?\b|\d))/gi, 2, -1, -1],
  [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+(?:of\s+the|of|the)\s+[a-z]+)*)\s+chapters?\s+(\d+)\b(?!\s*[:,.;]?\s*(?:verses?\b|\d))/gi, 3, -1, -1],
  // "in Philippians 2." with no word chapter, for books that are not everyday words
  [new RegExp(String.raw`(?<![a-z\d])(${BARE_CHAPTER_BOOKS})\s+(\d+)\b${BARE_CHAPTER_END}`, 'gi'), 2, -1, -1],
]

const BARE_VERSE = /\bverses?\s+(\d+)(?:\s+(?:to|through|-)\s+(?:verses?\s+)?(\d+))?/gi
const MAX_VERSE = 176

interface PassageContext {
  bookIndex: number
  chapter: number
}

interface ParseOptions {
  looseSoundAlike?: boolean
  resolveBareVerses?: boolean
  context?: PassageContext | null
}

/**
 * The shared parser. `context` is the passage the preacher was last reading;
 * with `resolveBareVerses` a lone "verse 26" that no book comes with is read
 * against the nearest passage before it in the text, or `context` when there is
 * none. Those references carry `inferred: true`.
 */
function parseCore(rawText: string, options: ParseOptions = {}): BibleReference[] {
  const { looseSoundAlike = false, resolveBareVerses = false, context = null } = options
  if (!rawText || !rawText.trim()) return []

  const references: BibleReference[] = []

  // Pre-process: convert all spoken/word numbers to digits so every pattern
  // below only needs to handle numeric tokens.
  // e.g. "first Timothy six from verse three to 12" → "1 Timothy 6 from verse 3 to 12"
  const text = normalizeReferenceText(replaceSpokenNumbers(rawText), { looseSoundAlike })
  const indexMap = buildProcessedToRawIndexMap(rawText, text)

  for (const [pattern, chapterGroup, verseStartGroup, verseEndGroup, bookGroup = 1] of PATTERNS) {
    let match: RegExpExecArray | null
    pattern.lastIndex = 0

    while ((match = pattern.exec(text)) !== null) {
      const bookNameRaw = (match[bookGroup] ?? '').trim().toLowerCase()
      // Normalize the book name for lookup (convert "second" to "2", etc.)
      const bookName = normalizeSpokenNumbers(bookNameRaw)

      const chapter = chapterGroup === 0 ? 1 : parseInt(match[chapterGroup] ?? '', 10)
      const chapterOnly = verseStartGroup === -1
      const verseStart = chapterOnly ? 1 : parseInt(match[verseStartGroup] ?? '', 10)
      const verseEnd = verseEndGroup > 0 && match[verseEndGroup] ? parseInt(match[verseEndGroup]!, 10) : null

      const bookIndex = findBookIndex(bookName)
      if (!bookIndex || !chapter || !verseStart) continue
      // A chapter the book does not have is a slip or a mishearing, not a reference
      if (chapter > (bibleBookChapters[bookIndex - 1] ?? 0)) continue

      const verseLabel = verseEnd ? `${verseStart}-${verseEnd}` : verseStart.toString()
      const shortLabel = `${bookIndex}:${chapter}:${verseLabel}`
      const displayLabel = chapterOnly
        ? `${bibleBooks[bookIndex - 1]} ${chapter}`
        : `${bibleBooks[bookIndex - 1]} ${chapter}:${verseLabel}`

      // The match indices are positions in the pre-processed `text`; map them
      // back to `rawText` so the transcript can highlight the original span.
      const rawStartIndex = mapIndexToRaw(indexMap, text, match.index)
      const rawEndIndex = mapIndexToRaw(indexMap, text, match.index + match[0].length)
      const rawMatchedText = rawText.slice(rawStartIndex, rawEndIndex)

      // Skip a reference already captured, or overlapping one an earlier, more
      // specific pattern matched.
      const isDuplicate = references.some(
        ref => (ref.shortLabel === shortLabel && Math.abs(ref.startIndex - rawStartIndex) < 5)
          || (rawStartIndex < ref.endIndex && rawEndIndex > ref.startIndex),
      )
      if (isDuplicate) continue

      references.push({
        text: rawMatchedText,
        shortLabel,
        displayLabel,
        startIndex: rawStartIndex,
        endIndex: rawEndIndex,
        ...(chapterOnly ? { chapterOnly: true } : {}),
      })
    }
  }

  // A chapter-only mention adds nothing when a verse of that same chapter was found too
  for (let i = references.length - 1; i >= 0; i--) {
    if (!references[i]!.chapterOnly) continue
    const [book, chapter] = references[i]!.shortLabel.split(':')
    if (references.some(other => !other.chapterOnly && other.shortLabel.startsWith(`${book}:${chapter}:`))) {
      references.splice(i, 1)
    }
  }

  references.sort((a, b) => a.startIndex - b.startIndex)

  if (resolveBareVerses) {
    const explicit = [...references]
    BARE_VERSE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = BARE_VERSE.exec(text)) !== null) {
      const startIndex = mapIndexToRaw(indexMap, text, match.index)
      const endIndex = mapIndexToRaw(indexMap, text, match.index + match[0].length)
      if (explicit.some(ref => startIndex < ref.endIndex && endIndex > ref.startIndex)) continue

      // The passage this verse belongs to: the nearest one said before it here,
      // else the one carried over from earlier speech.
      const before = explicit.filter(ref => ref.endIndex <= startIndex).pop()
      let bookIndex: number
      let chapter: number
      if (before) {
        [bookIndex, chapter] = before.shortLabel.split(':').map(Number) as [number, number]
      } else if (context) {
        ({ bookIndex, chapter } = context)
      } else {
        continue
      }

      // "...and chapter 6 verse 3 to 21": the preacher named a new chapter of
      // the same book, with no book of their own.
      const named = /chapters?\s+(\d+)\s+(?:from\s+)?$/i.exec(text.slice(Math.max(0, match.index - 24), match.index))
      if (named) {
        const namedChapter = parseInt(named[1]!, 10)
        if (namedChapter > 0 && namedChapter <= (bibleBookChapters[bookIndex - 1] ?? 0)) chapter = namedChapter
      }

      const verseStart = parseInt(match[1]!, 10)
      let verseEnd = match[2] ? parseInt(match[2], 10) : null
      if (!verseStart || verseStart > MAX_VERSE) continue
      if (verseEnd && (verseEnd <= verseStart || verseEnd > MAX_VERSE)) verseEnd = null

      const verseLabel = verseEnd ? `${verseStart}-${verseEnd}` : String(verseStart)
      const shortLabel = `${bookIndex}:${chapter}:${verseLabel}`
      if (references.some(ref => ref.shortLabel === shortLabel)) continue
      references.push({
        text: rawText.slice(startIndex, endIndex),
        shortLabel,
        displayLabel: `${bibleBooks[bookIndex - 1]} ${chapter}:${verseLabel}`,
        startIndex,
        endIndex,
        inferred: true,
      })
    }
    references.sort((a, b) => a.startIndex - b.startIndex)
  }

  return references
}

/**
 * Parse Bible references from transcribed text
 * Handles various formats:
 * - "John 3:16"
 * - "John chapter 3 verse 16"
 * - "John 3 verse 16"
 * - "the book of John chapter 3 verse 16"
 * - "Matthew 3:20-22" (verse ranges)
 * - "second corinthians 5:17" (spoken numbers)
 * - "third john verse 4" (spoken numbers)
 * - "1st Corinthians 7 um from verse 17 to 24" (filler words between chapter and verse)
 * - "verse 24 of Genesis chapter 2", "Isaiah 42 6 to 7", "in Philippians 2."
 */
const useBibleReferenceParser = (rawText: string): BibleReference[] => parseCore(rawText)

// A lone "verse 26" belongs to the passage read this recently. The longest gap
// seen in real Sunday sermons between a passage and its next bare verse was
// 88 seconds, so two minutes covers that with a little to spare.
export const CONTEXT_TTL_MS = 2 * 60 * 1000
// The previous final piece is joined on only while it is this fresh: a reference
// split across two pieces is never more than a few seconds apart.
export const TAIL_TTL_MS = 20 * 1000
const TAIL_WORDS = 15

const TAIL_CHAPTER = /(?:^|\s)((?:(?:\d|first|second|third|1st|2nd|3rd)\s+)?[a-z]+)\s+(?:chapters?\s+)?(\d+)\s*,?\s*$/i
const HEAD_RANGE = /^\s*\d+\s*(?:to|through|-)\s*\d+\b/i

const endsWithChapter = (text: string): boolean => {
  const match = TAIL_CHAPTER.exec(text)
  if (!match) return false
  const bookIndex = bookNameVariations[normalizeSpokenNumbers(match[1]!.toLowerCase()).trim()]
  return !!bookIndex && parseInt(match[2]!, 10) <= (bibleBookChapters[bookIndex - 1] ?? 0)
}

export interface ReferenceTracker {
  parse: (rawText: string, options?: { now?: number, isFinal?: boolean }) => BibleReference[]
}

/**
 * Follows one transcription session. Speech arrives in pieces, and a reference
 * often straddles two ("verse 24," then "of Genesis chapter 2"), or its verse
 * comes a sentence later ("Isaiah chapter 43" ... "verse 18"). The tracker joins
 * the end of the previous final piece onto each new one, and remembers the last
 * passage so a bare "verse N" can be placed.
 *
 * `parse(text, {now, isFinal})` returns only references that end in `text`, with
 * indices relative to `text`. References placed from memory, or read across a
 * piece boundary with no word "verse" to anchor them, carry `inferred: true`;
 * the app never puts those live on its own. Keep in step with the API's tracker.
 */
export const createReferenceTracker = (): ReferenceTracker => {
  let context: (PassageContext & { at: number }) | null = null
  let tail = ''
  let tailAt = 0

  return {
    parse(rawText, { now = Date.now(), isFinal = false } = {}) {
      if (!rawText || !rawText.trim()) return []

      const useTail = !!tail && now - tailAt <= TAIL_TTL_MS
      // "Isaiah 35," then "4 to 6": a book and chapter at the end of the last piece
      // and a verse range opening this one. The comma is only the piece boundary.
      const bridged = useTail && endsWithChapter(tail) && HEAD_RANGE.test(rawText)
      const prefix = useTail ? `${bridged ? tail.replace(/\s*,\s*$/, '') : tail} ` : ''
      const joined = `${prefix}${rawText}`
      const contextFresh = !!context && now - context.at <= CONTEXT_TTL_MS

      const found = parseCore(joined, {
        looseSoundAlike: contextFresh,
        resolveBareVerses: true,
        context: contextFresh ? context : null,
      })

      const references = found
        .filter(ref => ref.endIndex > prefix.length)
        .map(ref => ({
          ...ref,
          startIndex: Math.max(0, ref.startIndex - prefix.length),
          endIndex: ref.endIndex - prefix.length,
          // Read across the piece boundary with no word verse to anchor it
          ...(bridged && ref.startIndex < prefix.length ? { inferred: true } : {}),
        }))

      // Only a final piece moves the memory. Interim text is revised on the next
      // result, so a passage read from it might not stand.
      if (isFinal) {
        const last = [...references].reverse().find(ref => !ref.inferred)
        const refreshed = references.some(ref => ref.inferred)
        if (last) {
          const [bookIndex, chapter] = last.shortLabel.split(':').map(Number) as [number, number]
          context = { bookIndex, chapter, at: now }
        } else if (refreshed && context) {
          context = { ...context, at: now }
        }
        tail = joined.split(/\s+/).slice(-TAIL_WORDS).join(' ')
        tailAt = now
      }

      return references
    },
  }
}

/**
 * Find the book index from a book name or its variations
 */
function findBookIndex(bookName: string): number | null {
  // Normalize the input
  const normalized = bookName.toLowerCase()?.trim()

  // Direct match
  if (bookNameVariations[normalized]) {
    return bookNameVariations[normalized]
  }

  // Try matching with common prefixes removed
  const withoutPrefix = normalized.replace(/^(the\s+book\s+of\s+)/, '')
  if (bookNameVariations[withoutPrefix]) {
    return bookNameVariations[withoutPrefix]
  }

  // Try partial match — only if the variation appears as a whole word
  // (bounded by start/end of string or whitespace) to avoid matching
  // e.g. "rom" inside "from"
  for (const [variation, index] of Object.entries(bookNameVariations)) {
    const wordBoundary = new RegExp(`(?:^|\\s)${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`)
    if (wordBoundary.test(normalized) || wordBoundary.test(withoutPrefix)) {
      return index
    }
  }

  return null
}

export default useBibleReferenceParser
