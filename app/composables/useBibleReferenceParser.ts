import type { BibleReference } from '~/types/transcript'
import { bibleBooks } from '~/utils/constants'

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
  } else if (book === 'Ecclesiastes') {
    bookNameVariations['eccl'] = bookIndex
    bookNameVariations['ecc'] = bookIndex
  } else if (book === 'Song of Solomon') {
    bookNameVariations['song'] = bookIndex
    bookNameVariations['songs'] = bookIndex
    bookNameVariations['sos'] = bookIndex
    bookNameVariations['song of songs'] = bookIndex
  } else if (book === 'Isaiah') {
    bookNameVariations['isa'] = bookIndex
  } else if (book === 'Jeremiah') {
    bookNameVariations['jer'] = bookIndex
  } else if (book === 'Lamentations') {
    bookNameVariations['lam'] = bookIndex
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
 */
/**
 * Map a character index in the pre-processed (number-words-replaced) string back
 * to the corresponding index in the original raw string.
 *
 * Strategy: walk through both strings character-by-character. Wherever a substitution
 * was made (a number word was replaced by its digit equivalent) the processed string is
 * shorter; we advance the raw pointer by the length of the original word while the
 * processed pointer advances by the length of the digit token.
 *
 * Rather than re-implementing the full substitution logic, we regenerate a character-level
 * index map by comparing `rawText` and `processedText` at each aligned position.
 */
function mapIndexToRaw(rawText: string, processedText: string, processedIndex: number): number {
  let r = 0 // cursor in rawText
  let p = 0 // cursor in processedText

  while (p < processedIndex && r < rawText.length) {
    if (rawText[r] === processedText[p]) {
      r++
      p++
    } else {
      // A substitution happened here. Try to match the digit token in processedText
      // against the number word in rawText.
      // Walk rawText forward until the next char matches processedText[p] again.
      let rNext = r + 1
      while (rNext < rawText.length && rawText[rNext] !== processedText[p]) {
        rNext++
      }
      // Also advance processedText past the digit token
      let pNext = p + 1
      while (pNext < processedText.length && processedText[pNext] !== (rawText[rNext] ?? '') && /\d/.test(processedText[pNext] ?? '')) {
        pNext++
      }
      r = rNext
      p = pNext
    }
  }

  return r
}

const useBibleReferenceParser = (rawText: string): BibleReference[] => {
  const references: BibleReference[] = []

  // Pre-process: convert all spoken/word numbers to digits so every pattern
  // below only needs to handle numeric tokens.
  // e.g. "first Timothy six from verse three to 12" → "1 Timothy 6 from verse 3 to 12"
  const text = replaceSpokenNumbers(rawText)

  // Pattern for various Bible reference formats
  // Updated patterns to match spoken ordinals directly

  // Each pattern entry is [regex, chapterGroup, verseStartGroup, verseEndGroup]
  // For patterns without an explicit chapter (single-chapter books), chapterGroup is 0 (= use 1).
  const patterns: [RegExp, number, number, number][] = [
    // Standard format: "John 3:16" or "1 John 3:16-18" or "Second Corinthians 3:16"
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?/gi, 3, 4, 5],

    // Verbose format: "John chapter 3 verse 16" or "Second Corinthians chapter 5 verse 17"
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+chapter\s+(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi, 3, 4, 5],

    // Mixed format: "John 3 verse 16" or "John 3 verse 16 to 18"
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi, 3, 4, 5],

    // Spoken format with filler words: "1 Timothy 6 from verse 3 to 12"
    // Tolerates up to 4 filler/connector words between chapter and verse keyword
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)(?:\s+(?!verses?\b|from\b)\w+){0,4}\s+(?:from\s+)?verses?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi, 3, 4, 5],

    // Spoken chapter+verse without colon or "verse" keyword: "1 Corinthians 15 57"
    // (produced by pre-processing "first Corinthians fifteen fifty seven")
    // Must be two consecutive numbers after the book name.
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)\s+(\d+)(?:\s*-\s*(\d+))?/gi, 3, 4, 5],

    // Single-chapter book format: "3 John verse 4" or "Jude verse 3 to 5"
    // No chapter number — verse is treated as chapter 1 verse N
    [/(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(?:from\s+)?verses?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi, 0, 3, 4],
  ]

  for (const [pattern, chapterGroup, verseStartGroup, verseEndGroup] of patterns) {
    let match: RegExpExecArray | null

    // Reset lastIndex for global regex
    pattern.lastIndex = 0

    // Run regex on pre-processed text to detect references
    while ((match = pattern.exec(text)) !== null) {
      const bookNameRaw = match[1]?.trim().toLowerCase() ?? ''
      // Normalize the book name for lookup (convert "second" to "2", etc.)
      const bookName = normalizeSpokenNumbers(bookNameRaw)

      // Groups:
      // match[1] = full book name (including prefix like "second")
      // match[2] = the prefix only (first/second/third/1st/2nd/3rd/digit) - optional
      // chapterGroup  = chapter (0 means no chapter — use 1 for single-chapter books)
      // verseStartGroup = verse start
      // verseEndGroup   = verse end (optional)
      const chapter = chapterGroup === 0 ? 1 : parseInt(match[chapterGroup] ?? '', 10)
      const verseStart = parseInt(match[verseStartGroup] ?? '', 10)
      const verseEnd = match[verseEndGroup] ? parseInt(match[verseEndGroup]!, 10) : null

      // Find the book index using normalized book name
      const bookIndex = findBookIndex(bookName)

      if (bookIndex && chapter && verseStart) {
        const verseLabel = verseEnd ? `${verseStart}-${verseEnd}` : verseStart.toString()
        const shortLabel = `${bookIndex}:${chapter}:${verseLabel}`
        const displayLabel = `${bibleBooks[bookIndex - 1]} ${chapter}:${verseLabel}`

        // The match indices are positions in the pre-processed `text`.
        // We need to map them back to positions in `rawText` so that
        // TranscriptText.vue can highlight the correct original span.
        const rawStartIndex = mapIndexToRaw(rawText, text, match.index)
        const rawEndIndex = mapIndexToRaw(rawText, text, match.index + match[0].length)
        const rawMatchedText = rawText.slice(rawStartIndex, rawEndIndex)

        // Check if this reference is already captured (avoid duplicates and overlaps).
        // An earlier, more specific pattern may have already matched a region that
        // overlaps with this match — skip if so.
        const isDuplicate = references.some(
          ref => (ref.shortLabel === shortLabel &&
            Math.abs(ref.startIndex - rawStartIndex) < 5) ||
            // Overlapping range: this match's region intersects an existing one
            (rawStartIndex < ref.endIndex && rawEndIndex > ref.startIndex)
        )

        if (!isDuplicate) {
          references.push({
            text: rawMatchedText,
            shortLabel,
            displayLabel,
            startIndex: rawStartIndex,
            endIndex: rawEndIndex,
          })
        }
      }
    }
  }

  // Sort by startIndex to maintain order
  references.sort((a, b) => a.startIndex - b.startIndex)

  return references
}

/**
 * Find the book index from a book name or its variations
 */
function findBookIndex(bookName: string): number | null {
  // Normalize the input
  const normalized = bookName.toLowerCase().trim()

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
