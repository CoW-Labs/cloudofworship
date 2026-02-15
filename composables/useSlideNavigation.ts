import { useAppStore } from "~/store/app"
import type { Slide, Hymn, Song, Scripture } from "~/types"

/**
 * Composable for navigating between verses in Bible, Hymn, and Song slides
 */
export default function useSlideNavigation() {
  const appStore = useAppStore()

  /**
   * Navigate to a specific verse/chapter based on slide type
   */
  const gotoVerse = async (
    slide: Slide,
    title: string,
    version: string = "KJV"
  ): Promise<Slide | null> => {
    // Normalize title format
    title = title
      .replaceAll("  ", " ")
      .replaceAll(" :", ":")
      .replaceAll(": ", ":")
      .replaceAll(" : ", ":")

    useGlobalEmit(appWideActions.gotoVerse, title)

    switch (slide?.type) {
      case slideTypes.bible:
        return await gotoScripture(slide, title, version)
      case slideTypes.hymn:
        return await gotoHymnVerse(slide, title)
      case slideTypes.song:
        return await gotoSongVerse(slide, title)
      default:
        return null
    }
  }

  /**
   * Navigate to a specific scripture reference
   */
  const gotoScripture = async (
    slide: Slide,
    title: string,
    version: string
  ): Promise<Slide | null> => {
    // Check whether title format uses colon or not as delimiter, and replace if not
    const regex = /\b\d+\s*:\s*\d+\b|\b\d+\s\d+\b/g
    const match = title.match(regex)?.[0]?.replaceAll(" ", ":")
    if (match) {
      title = title.replace(regex, match)
    }

    // Check that [title] is not abbreviated or in short form
    // If it is, replace to long/unabbreviated form
    let bibleBook = title.substring(0, title?.lastIndexOf(" "))
    if (!bibleBooks.includes(bibleBook)) {
      bibleBook =
        bibleBooks.find((book) =>
          book.toLowerCase().startsWith(bibleBook.toLowerCase())
        ) || ""
      title = `${bibleBook} ${title.substring(title?.lastIndexOf(" ")).trim()}`
    }

    const tempSlide = { ...slide }
    const scriptureSplitted = useScriptureLabel(title || "1:1:1")?.split(":")

    // added || 1 to make sure that if no verse is specified, it defaults to first chapter or first verse
    const scriptureLabel = `${title?.slice(0, title.lastIndexOf(" "))} ${scriptureSplitted?.[1] || 1
      }:${scriptureSplitted?.[2] || 1}`
    const scriptureShortLabel = `${scriptureSplitted?.[0]}:${scriptureSplitted?.[1] || 1
      }:${scriptureSplitted?.[2] || 1}`

    const scripture = await useScripture(scriptureShortLabel, version)
    appStore.setRecentBibleSearches(scriptureShortLabel)

    if (scripture) {
      // Calculate font-size of scripture content
      tempSlide.title = scriptureLabel
      tempSlide.data = scripture
      let fontSize = useScreenFontSize(scripture?.content as string)
      tempSlide.slideStyle = {
        ...tempSlide.slideStyle,
        fontSize: Number(fontSize),
      }

      tempSlide.contents = useSlideContent(tempSlide, scripture)
      tempSlide.name = useSlideName(tempSlide)

      usePosthogCapture("GOTO_SCRIPTURE_TOOLBAR_USED")
      return tempSlide
    }

    return null
  }

  /**
   * Navigate to a specific hymn verse or chorus
   */
  const gotoHymnVerse = async (
    slide: Slide,
    title: string
  ): Promise<Slide | null> => {
    const tempSlide = { ...slide }
    const hymn = await useHymn(tempSlide.songId as string)

    if (hymn) {
      // Handle chorus navigation (supports "Chorus" or "Chorus:N" format)
      if (title.startsWith("Chorus")) {
        const chorus = hymn?.chorus as string
        if (chorus) {
          tempSlide.title = "Chorus"
          // Check if hymnVerseIndex is specified (for backward navigation)
          const parts = title.split(":")
          if (parts.length > 1) {
            tempSlide.hymnVerseIndex = Number(parts[1])
          }
          // Otherwise hymnVerseIndex stays the same - it tracks the last verse shown
          let fontSize = useScreenFontSize(chorus)
          tempSlide.slideStyle = {
            ...tempSlide.slideStyle,
            fontSize: Number(fontSize),
          }
          tempSlide.contents = useSlideContent(tempSlide, hymn, chorus)

          usePosthogCapture("GOTO_CHORUS_TOOLBAR_USED")
          return tempSlide
        }
        return null
      }

      // Handle verse navigation
      const verseIndex = Number(title?.split(" ")?.[1]) - 1
      const nextVerse = hymn?.verses?.[verseIndex]?.trim()

      if (nextVerse) {
        tempSlide.title = title
        tempSlide.hymnVerseIndex = verseIndex
        // Calculate font-size of content
        let fontSize = useScreenFontSize(nextVerse)
        tempSlide.slideStyle = {
          ...tempSlide.slideStyle,
          fontSize: Number(fontSize),
        }
        tempSlide.contents = useSlideContent(tempSlide, hymn, nextVerse)

        usePosthogCapture("GOTO_HYMN_TOOLBAR_USED")
        return tempSlide
      }
    }

    return null
  }

  /**
   * Navigate to a specific song verse
   */
  const gotoSongVerse = async (
    slide: Slide,
    title: string
  ): Promise<Slide | null> => {
    const tempSlide = { ...slide }
    const song = await useSong(
      (slide?.data as Song) || slide?.songId
    )

    if (song) {
      const verseIndex = Number(title?.split(" ")?.[1]) - 1
      const nextVerse = song?.verses?.[verseIndex]?.trim()

      if (nextVerse) {
        tempSlide.title = title
        // Calculate font-size of content
        let fontSize = useScreenFontSize(nextVerse)
        tempSlide.slideStyle = {
          ...tempSlide.slideStyle,
          fontSize: Number(fontSize),
        }
        tempSlide.data = song
        tempSlide.contents = useSlideContent(tempSlide, song, nextVerse)

        usePosthogCapture("GOTO_SONG_TOOLBAR_USED")
        return tempSlide
      }
    }

    return null
  }

  return {
    gotoVerse,
    gotoScripture,
    gotoHymnVerse,
    gotoSongVerse,
  }
}
