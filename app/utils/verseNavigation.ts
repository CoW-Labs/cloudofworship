import type { Slide } from "~/types"
import { bibleBookChapters, bibleBooks, slideTypes } from "~/utils/constants"

/**
 * Pure label arithmetic for "what comes after / before the verse on screen".
 *
 * The operator toolbar (EditLiveContent) and the stage display both need this
 * answer — the toolbar to navigate, the stage display to preview NEXT — so it
 * lives here instead of being duplicated. These functions only produce a
 * *label*; resolving it into slide contents stays with `useSlideNavigation`.
 *
 * `verse` is the slide title as shown in the verse input, e.g. "Genesis 1:1",
 * "Verse 2", "Chorus". `chapterVerseCount` is the number of verses in the
 * current Bible chapter (0 when unknown — chapter roll-over is then skipped).
 */
export const computeNextVerseLabel = (
  slide: Slide | null | undefined,
  verse: string,
  chapterVerseCount: number = 0
): string => {
  if (slide?.type === slideTypes.bible) {
    const bookName = verse?.split(":")?.[0]
    const currentVerse = verse?.split(":")?.[1]?.includes("-")
      ? Number(verse?.split(":")?.[1]?.split("-")?.[1])
      : Number(verse?.split(":")?.[1])
    const currentChapter = Number(bookName?.split(" ")?.pop())
    const bookNameOnly = bookName?.substring(0, bookName?.lastIndexOf(" "))
    const bookIndex = bibleBooks.findIndex(
      (b) => b.toLowerCase() === bookNameOnly?.toLowerCase()
    )

    // If at the last verse of the chapter, go to next chapter verse 1
    if (chapterVerseCount > 0 && currentVerse >= chapterVerseCount) {
      const maxChapters = bibleBookChapters[bookIndex] || 999

      if (currentChapter < maxChapters) {
        // Next chapter in the same book
        return `${bookNameOnly} ${currentChapter + 1}:1`
      } else if (bookIndex < bibleBooks.length - 1) {
        // First chapter of the next book
        return `${bibleBooks[bookIndex + 1]} 1:1`
      }
      // Already at the very end of the Bible
      return verse
    }

    return `${bookName}:${currentVerse + 1}`
  }
  if (slide?.type === slideTypes.hymn) {
    const subIdx = slide?.hymnSubVerseIndex ?? 0
    const subTotal = slide?.hymnSubVerseTotal ?? 1
    const hymnVerseIdx = slide?.hymnVerseIndex ?? 0

    if (subTotal > 1 && subIdx < subTotal - 1) {
      // More chunks remain in the current verse/chorus — step forward within it
      if (verse === "Chorus") return `Chorus:${hymnVerseIdx}:${subIdx + 1}`
      const currentVerseNum = Number(verse?.split(" ")?.[1])
      return `Verse ${currentVerseNum}:${subIdx + 1}`
    }

    // At the last chunk — advance to the next semantic section
    if (slide?.hasChorus) {
      if (verse === "Chorus") return `Verse ${hymnVerseIdx + 2}`
      return "Chorus"
    }
    // No chorus — next verse, chunk 0
    return `Verse ${Number(verse?.split(" ")?.[1]) + 1}`
  }
  if (slide?.type === slideTypes.songSetlist) {
    return "__next-setlist"
  }
  return `Verse ${Number(verse?.split(" ")?.[1]) + 1}`
}

export const computePreviousVerseLabel = (
  slide: Slide | null | undefined,
  verse: string
): string => {
  if (slide?.type === slideTypes.bible) {
    const bookName = verse?.split(":")?.[0]
    const currentVerse = verse?.split(":")?.[1]?.includes("-")
      ? Number(verse?.split(":")?.[1]?.split("-")?.[0])
      : Number(verse?.split(":")?.[1])
    const currentChapter = Number(bookName?.split(" ")?.pop())
    const bookNameOnly = bookName?.substring(0, bookName?.lastIndexOf(" "))
    const bookIndex = bibleBooks.findIndex(
      (b) => b.toLowerCase() === bookNameOnly?.toLowerCase()
    )

    if (currentVerse <= 1) {
      if (currentChapter > 1) {
        // Go to previous chapter - will need to fetch last verse in the handler
        return `${bookNameOnly} ${currentChapter - 1}:LAST`
      } else if (bookIndex > 0) {
        // Go to the last chapter of the previous book - will need to fetch last verse in the handler
        const prevBookMaxChapter = bibleBookChapters[bookIndex - 1] || 1
        return `${bibleBooks[bookIndex - 1]} ${prevBookMaxChapter}:LAST`
      }
      // Already at the very beginning of the Bible
      return verse
    }

    return `${bookName}:${currentVerse - 1}`
  }
  if (slide?.type === slideTypes.hymn) {
    const subIdx = slide?.hymnSubVerseIndex ?? 0
    const subTotal = slide?.hymnSubVerseTotal ?? 1
    const hymnVerseIdx = slide?.hymnVerseIndex ?? 0

    if (subTotal > 1 && subIdx > 0) {
      // More chunks remain going backward — step back within current verse/chorus
      if (verse === "Chorus") return `Chorus:${hymnVerseIdx}:${subIdx - 1}`
      const currentVerseNum = Number(verse?.split(" ")?.[1])
      return `Verse ${currentVerseNum}:${subIdx - 1}`
    }

    // At the first chunk — go back to the last chunk of the previous semantic section
    if (slide?.hasChorus) {
      if (verse === "Chorus") {
        // Back to last chunk of the verse that preceded this chorus
        return `Verse ${hymnVerseIdx + 1}:LAST`
      }
      const currentVerseNum = Number(verse?.split(" ")?.[1])
      if (currentVerseNum <= 1) return "Verse 1"
      // Back to last chunk of the chorus after the previous verse
      return `Chorus:${currentVerseNum - 2}:LAST`
    }
    // No chorus — previous verse, last chunk
    const currentVerseNum = Number(verse?.split(" ")?.[1])
    if (currentVerseNum <= 1) return "Verse 1"
    return `Verse ${currentVerseNum - 1}:LAST`
  }
  if (slide?.type === slideTypes.songSetlist) {
    return "__previous-setlist"
  }
  return `Verse ${Number(verse?.split(" ")?.[1]) - 1}`
}
