export interface BibleReference {
  text: string // The original text that was detected (e.g., "John Chapter 3 verse 16")
  shortLabel: string // The normalized short label (e.g., "43:3:16")
  displayLabel: string // The human-readable label (e.g., "John 3:16")
  startIndex: number // Start position in the transcript text
  endIndex: number // End position in the transcript text
  // Only a chapter was said ("Joshua chapter 14"). It points at verse 1 and is
  // listed for a click, but never goes live on its own.
  chapterOnly?: boolean
}

export interface TranscriptSegment {
  id: string
  text: string
  timestamp: number
  bibleReferences: BibleReference[]
}

