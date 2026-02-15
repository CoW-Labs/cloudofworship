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
 * Parse Bible references from transcribed text
 * Handles various formats:
 * - "John 3:16"
 * - "John chapter 3 verse 16"
 * - "John 3 verse 16"
 * - "the book of John chapter 3 verse 16"
 * - "Matthew 3:20-22" (verse ranges)
 * - "second corinthians 5:17" (spoken numbers)
 * - "third john verse 4" (spoken numbers)
 */
const useBibleReferenceParser = (text: string): BibleReference[] => {
  const references: BibleReference[] = []
  
  // Pattern for various Bible reference formats
  // Updated patterns to match spoken ordinals directly
  
  const patterns = [
    // Standard format: "John 3:16" or "1 John 3:16-18" or "Second Corinthians 3:16"
    /(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?/gi,
    
    // Verbose format: "John chapter 3 verse 16" or "Second Corinthians chapter 5 verse 17"
    /(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+chapter\s+(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi,
    
    // Mixed format: "John 3 verse 16"
    /(?:the\s+book\s+of\s+)?((first|second|third|1st|2nd|3rd|\d)?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\s+(\d+)\s+verse[s]?\s+(\d+)(?:\s+(?:to|through|-)\s+(\d+))?/gi,
  ]
  
  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    
    // Reset lastIndex for global regex
    pattern.lastIndex = 0
    
    // Run regex on original text to get correct indices
    while ((match = pattern.exec(text)) !== null) {
      const bookNameRaw = match[1].trim().toLowerCase()
      // Normalize the book name for lookup (convert "second" to "2", etc.)
      const bookName = normalizeSpokenNumbers(bookNameRaw)
      
      // Groups:
      // match[1] = full book name (including prefix like "second")
      // match[2] = the prefix only (first/second/third/1st/2nd/3rd/digit) - optional
      // match[3] = chapter
      // match[4] = verse start
      // match[5] = verse end (optional)
      const chapter = parseInt(match[3], 10)
      const verseStart = parseInt(match[4], 10)
      const verseEnd = match[5] ? parseInt(match[5], 10) : null
      
      // Find the book index using normalized book name
      const bookIndex = findBookIndex(bookName)
      
      if (bookIndex && chapter && verseStart) {
        const verseLabel = verseEnd ? `${verseStart}-${verseEnd}` : verseStart.toString()
        const shortLabel = `${bookIndex}:${chapter}:${verseLabel}`
        const displayLabel = `${bibleBooks[bookIndex - 1]} ${chapter}:${verseLabel}`
        
        // Check if this reference is already captured (avoid duplicates)
        const isDuplicate = references.some(
          ref => ref.shortLabel === shortLabel && 
                 Math.abs(ref.startIndex - match!.index) < 5
        )
        
        if (!isDuplicate) {
          references.push({
            text: match[0],
            shortLabel,
            displayLabel,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
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
  
  // Try partial match (for spoken variations)
  for (const [variation, index] of Object.entries(bookNameVariations)) {
    if (normalized.includes(variation) || variation.includes(normalized)) {
      return index
    }
  }
  
  return null
}

export default useBibleReferenceParser
