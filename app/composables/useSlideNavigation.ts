import { useAppStore } from "~/store/app"
import type { Slide, Hymn, Song, Scripture } from "~/types"
import { splitVerseByLines } from "~/composables/useHymn"

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
      case slideTypes.songSetlist:
        return await gotoSongSetlistVerse(slide, title)
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
      title = `${bibleBook} ${title.substring(title?.lastIndexOf(" "))?.trim()}`
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
   * Navigate to a specific hymn verse or chorus.
   *
   * Accepted title formats:
   *   "Verse N"          → verse N, chunk 0
   *   "Verse N:CHUNK"    → verse N, specific 0-based chunk index
   *   "Verse N:LAST"     → verse N, last chunk
   *   "Chorus"           → chorus, chunk 0, keep current hymnVerseIndex
   *   "Chorus:N"         → chorus, chunk 0, set hymnVerseIndex = N
   *   "Chorus:N:CHUNK"   → chorus, chunk CHUNK, set hymnVerseIndex = N
   *   "Chorus:N:LAST"    → chorus, last chunk, set hymnVerseIndex = N
   */
  const gotoHymnVerse = async (
    slide: Slide,
    title: string
  ): Promise<Slide | null> => {
    const tempSlide = { ...slide }
    const hymn = await useHymn(tempSlide.songId as string)
    if (!hymn) return null

    const linesPerSlide = slide.slideStyle?.linesPerSlide
    const getChunks = (text: string) => splitVerseByLines(text, linesPerSlide)

    const resolveChunkIdx = (chunkParam: string | undefined, chunks: string[]): number => {
      if (!chunkParam || chunkParam === '') return 0
      if (chunkParam === 'LAST') return chunks.length - 1
      return Math.min(Math.max(Number(chunkParam) || 0, 0), chunks.length - 1)
    }

    if (title.startsWith("Chorus")) {
      const chorus = hymn?.chorus as string
      if (!chorus) return null

      // "Chorus", "Chorus:N", "Chorus:N:CHUNK", "Chorus:N:LAST"
      const parts = title.split(":")
      tempSlide.title = "Chorus"
      if (parts[1] !== undefined && parts[1] !== '') {
        tempSlide.hymnVerseIndex = Number(parts[1])
      }
      // else hymnVerseIndex stays — it tracks the last verse shown

      const chunks = getChunks(chorus)
      const chunkIdx = resolveChunkIdx(parts[2], chunks)
      const displayVerse = chunks[chunkIdx]

      tempSlide.slideStyle = {
        ...tempSlide.slideStyle,
        fontSize: Number(useScreenFontSize(displayVerse)),
      }
      tempSlide.hymnSubVerseIndex = chunkIdx
      tempSlide.hymnSubVerseTotal = chunks.length
      tempSlide.contents = useSlideContent(tempSlide, hymn, displayVerse)
      tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
        ? slideLayoutTypes.bible
        : slideLayoutTypes.full_text

      usePosthogCapture("GOTO_CHORUS_TOOLBAR_USED")
      return tempSlide
    }

    // "Verse N", "Verse N:CHUNK", "Verse N:LAST"
    const colonIdx = title.indexOf(":")
    const verseSection = colonIdx === -1 ? title : title.slice(0, colonIdx)
    const chunkParam = colonIdx === -1 ? undefined : title.slice(colonIdx + 1)

    const verseIndex = Number(verseSection?.split(" ")?.[1]) - 1
    const rawVerse = hymn?.verses?.[verseIndex]?.trim()
    if (!rawVerse) return null

    const chunks = getChunks(rawVerse)
    const chunkIdx = resolveChunkIdx(chunkParam, chunks)
    const displayVerse = chunks[chunkIdx]

    tempSlide.title = verseSection
    tempSlide.hymnVerseIndex = verseIndex
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(useScreenFontSize(displayVerse)),
    }
    tempSlide.hymnSubVerseIndex = chunkIdx
    tempSlide.hymnSubVerseTotal = chunks.length
    tempSlide.contents = useSlideContent(tempSlide, hymn, displayVerse)
    tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text

    usePosthogCapture("GOTO_HYMN_TOOLBAR_USED")
    return tempSlide
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
        tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
          ? slideLayoutTypes.bible
          : slideLayoutTypes.full_text

        usePosthogCapture("GOTO_SONG_TOOLBAR_USED")
        return tempSlide
      }
    }

    return null
  }

  const gotoSongSetlistVerse = async (
    slide: Slide,
    title: string
  ): Promise<Slide | null> => {
    const { getSetlistData, navigateSongSetlist, refreshSongSetlistSlide } =
      useSongSetlist()

    if (title === "__next-setlist") {
      return await navigateSongSetlist(slide, "next")
    }
    if (title === "__previous-setlist") {
      return await navigateSongSetlist(slide, "previous")
    }

    const data = getSetlistData(slide)
    if (!data.songs.length) return null

    const requestedVerseIndex = Number(title?.split(" ")?.[1]) - 1
    if (!Number.isFinite(requestedVerseIndex) || requestedVerseIndex < 0) {
      return null
    }

    return await refreshSongSetlistSlide(slide, {
      activeSongIndex: data.activeSongIndex,
      verseIndex: requestedVerseIndex,
    })
  }

  return {
    gotoVerse,
    gotoScripture,
    gotoHymnVerse,
    gotoSongVerse,
    gotoSongSetlistVerse,
  }
}
