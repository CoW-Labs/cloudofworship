import { useAppStore } from "~/store/app"
import type { Slide, Song, SongSetlistData, SongSetlistItem } from "~/types"

const getSongId = (song: Song) => song._id || song.id

export default function useSongSetlist() {
  const appStore = useAppStore()

  const isSongSetlistSlide = (slide?: Slide | null) =>
    slide?.type === slideTypes.songSetlist

  /**
   * A setlist chunks its songs at the slide's own `linesPerSlide`, falling back
   * to the app-wide default only for a slide that has never been given one.
   * Every `useSong()` below has to be handed this value explicitly: called
   * without it, `useSong()` silently chunks at the *global* setting, so any
   * other slide that moved the default would re-split the setlist the next time
   * a song was added or a verse advanced.
   */
  const resolveLinesPerSlide = (slide?: Slide | null) =>
    slide?.slideStyle?.linesPerSlide ??
    appStore.currentState.settings.slideStyles.linesPerSlide

  /**
   * `useSong()` writes the re-chunked verses back onto the object it is handed,
   * and a setlist item's `song` is the very object held in the store (the
   * copies on the way in are all shallow). Hand it a detached copy so a refresh
   * cannot re-split the stored slide in place, ahead of the rebuilt one.
   */
  const detachSong = <T,>(song: T): T =>
    song && typeof song === "object" ? ({ ...song } as T) : song

  const getSetlistData = (slide?: Slide | null): SongSetlistData => {
    const data = slide?.data as SongSetlistData | undefined
    return {
      songs: Array.isArray(data?.songs) ? data.songs : [],
      activeSongIndex: Number.isFinite(data?.activeSongIndex)
        ? data?.activeSongIndex || 0
        : 0,
    }
  }

  const createSetlistItem = async (
    song: Song,
    linesPerSlide?: number
  ): Promise<SongSetlistItem | null> => {
    const resolvedSong = await useSong(detachSong(song), linesPerSlide, {
      persistLinesPerSlide: false,
    })
    if (!resolvedSong) return null

    return {
      id: useObjectID(),
      songId: getSongId(resolvedSong),
      song: resolvedSong,
      verseIndex: 0,
    }
  }

  const refreshSongSetlistSlide = async (
    slide: Slide,
    options?: { activeSongIndex?: number; verseIndex?: number }
  ): Promise<Slide> => {
    const tempSlide: Slide = { ...slide }
    const data = getSetlistData(tempSlide)
    const songs = [...data.songs]
    const linesPerSlide = resolveLinesPerSlide(tempSlide)

    if (songs.length === 0) {
      tempSlide.data = { songs, activeSongIndex: 0 }
      tempSlide.songId = undefined
      tempSlide.title = "Song Setlist"
      tempSlide.contents = ["", "<p class=\"song-content\">Add songs to this setlist</p>"]
      tempSlide.name = useSlideName(tempSlide)
      return tempSlide
    }

    const activeSongIndex = Math.min(
      Math.max(options?.activeSongIndex ?? data.activeSongIndex ?? 0, 0),
      songs.length - 1
    )
    const activeItemSource = songs[activeSongIndex]
    if (!activeItemSource) return tempSlide
    const activeItem: SongSetlistItem = { ...activeItemSource }
    const resolvedSong = await useSong(
      detachSong(activeItem.song || activeItem.songId),
      linesPerSlide,
      { persistLinesPerSlide: false }
    )
    if (!resolvedSong) return tempSlide

    const verseIndex = Math.min(
      Math.max(options?.verseIndex ?? activeItem.verseIndex ?? 0, 0),
      Math.max((resolvedSong.verses?.length || 1) - 1, 0)
    )
    const currentVerse = resolvedSong.verses?.[verseIndex]?.trim() || ""

    activeItem.song = resolvedSong
    activeItem.songId = getSongId(resolvedSong)
    activeItem.verseIndex = verseIndex
    songs.splice(activeSongIndex, 1, activeItem)

    tempSlide.data = { songs, activeSongIndex }
    tempSlide.songId = activeItem.songId
    tempSlide.title = `Verse ${verseIndex + 1}`
    tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      // Stamped explicitly: a slide left on the global default would otherwise
      // report one value in the toolbar and be chunked at another.
      ...(linesPerSlide !== undefined && { linesPerSlide }),
      fontSize: Number(useScreenFontSize(currentVerse)),
    }
    tempSlide.contents = useSlideContent(tempSlide, resolvedSong, currentVerse)
    tempSlide.name = useSlideName(tempSlide)

    return tempSlide
  }

  /**
   * Adds a song to a setlist. By default the song lands at the top of the list
   * and becomes the active song, so the newest addition is what the operator
   * sees. Pass `position: "end"` to keep an existing order intact (e.g. when
   * seeding a setlist from a schedule template).
   */
  const appendSongToSetlist = async (
    slide: Slide,
    song: Song,
    options?: { position?: "start" | "end" }
  ): Promise<Slide | null> => {
    const item = await createSetlistItem(song, resolveLinesPerSlide(slide))
    if (!item) return null

    const data = getSetlistData(slide)
    const addToEnd = options?.position === "end"
    const songs = addToEnd ? [...data.songs, item] : [item, ...data.songs]
    const activeSongIndex = addToEnd
      ? Math.min(Math.max(data.activeSongIndex || 0, 0), songs.length - 1)
      : 0

    return await refreshSongSetlistSlide(
      {
        ...slide,
        data: { songs, activeSongIndex },
      },
      { activeSongIndex, verseIndex: addToEnd ? undefined : 0 }
    )
  }

  const removeSongFromSetlist = async (
    slide: Slide,
    itemIndex: number
  ): Promise<Slide | null> => {
    const data = getSetlistData(slide)
    if (itemIndex < 0 || itemIndex >= data.songs.length) return slide

    const songs = data.songs.filter((_, index) => index !== itemIndex)
    const activeSongIndex =
      songs.length === 0
        ? 0
        : Math.min(
            itemIndex <= data.activeSongIndex
              ? data.activeSongIndex - 1
              : data.activeSongIndex,
            songs.length - 1
          )

    return await refreshSongSetlistSlide({
      ...slide,
      data: { songs, activeSongIndex: Math.max(activeSongIndex, 0) },
    })
  }

  const navigateSongSetlist = async (
    slide: Slide,
    direction: "next" | "previous"
  ): Promise<Slide | null> => {
    const data = getSetlistData(slide)
    if (!data.songs.length) return null

    const linesPerSlide = resolveLinesPerSlide(slide)
    const activeSongIndex = Math.min(
      Math.max(data.activeSongIndex || 0, 0),
      data.songs.length - 1
    )
    const activeItem = data.songs[activeSongIndex]
    if (!activeItem) return null
    const activeSong = await useSong(
      detachSong(activeItem.song || activeItem.songId),
      linesPerSlide,
      { persistLinesPerSlide: false }
    )
    if (!activeSong) return null

    const lastVerseIndex = Math.max((activeSong.verses?.length || 1) - 1, 0)
    const currentVerseIndex = Math.min(
      Math.max(activeItem.verseIndex || 0, 0),
      lastVerseIndex
    )

    if (direction === "next") {
      if (currentVerseIndex < lastVerseIndex) {
        return await refreshSongSetlistSlide(slide, {
          activeSongIndex,
          verseIndex: currentVerseIndex + 1,
        })
      }
      if (activeSongIndex < data.songs.length - 1) {
        return await refreshSongSetlistSlide(slide, {
          activeSongIndex: activeSongIndex + 1,
          verseIndex: 0,
        })
      }
      return null
    }

    if (currentVerseIndex > 0) {
      return await refreshSongSetlistSlide(slide, {
        activeSongIndex,
        verseIndex: currentVerseIndex - 1,
      })
    }
    if (activeSongIndex > 0) {
      const previousSongIndex = activeSongIndex - 1
      const previousItem = data.songs[previousSongIndex]
      if (!previousItem) return null
      const previousSong = await useSong(
        detachSong(previousItem.song || previousItem.songId),
        linesPerSlide,
        { persistLinesPerSlide: false }
      )
      return await refreshSongSetlistSlide(slide, {
        activeSongIndex: previousSongIndex,
        verseIndex: Math.max((previousSong?.verses?.length || 1) - 1, 0),
      })
    }

    return null
  }

  return {
    isSongSetlistSlide,
    getSetlistData,
    createSetlistItem,
    refreshSongSetlistSlide,
    appendSongToSetlist,
    removeSongFromSetlist,
    navigateSongSetlist,
  }
}
