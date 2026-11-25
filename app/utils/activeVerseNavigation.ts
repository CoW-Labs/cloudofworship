import { watch, type Ref } from "vue"
import type { Slide, Song, SongSetlistData } from "~/types"
import { slideTypes } from "~/utils/constants"

export function isVerseSlide(slide: Slide): boolean {
  return slide.type === slideTypes.bible || slide.type === slideTypes.hymn ||
    slide.type === slideTypes.song || slide.type === slideTypes.songSetlist
}

export function matchesSlide(a: Slide, b: Slide): boolean {
  return a.id === b.id && a.scheduleId === b.scheduleId && a.type === b.type
}

export function trackActiveVerseNavigation(activeSlide: Ref<Slide | undefined>) {
  let current: Slide | undefined
  watch(activeSlide, (slide) => {
    if (current && (!slide || !matchesSlide(slide, current) ||
      slide.title !== current.title || slide.contents !== current.contents)) {
      current = undefined
    }
  }, { flush: "sync" })

  return {
    get current() { return current },
    remember() {
      const slide = activeSlide.value
      current = slide && isVerseSlide(slide) ? slide : undefined
    },
    clear() { current = undefined },
  }
}

/** Reuse the payload the operator already rendered. Storage reloads do no verse lookups. */
export function preserveActiveVerse(saved: Slide, current: Slide): Slide {
  if (!matchesSlide(saved, current) ||
    (saved.slideStyle?.linesPerSlide !== undefined &&
      saved.slideStyle.linesPerSlide !== current.slideStyle?.linesPerSlide)) return saved

  let data = current.data
  if (current.type === slideTypes.song) {
    const savedSong = saved.data as Song | undefined
    const currentSong = current.data as Song | undefined
    if (saved.songId !== current.songId ||
      (savedSong?.lyrics !== undefined && savedSong.lyrics !== currentSong?.lyrics)) return saved
    if (savedSong) data = { ...savedSong, verses: currentSong?.verses }
  } else if (current.type === slideTypes.hymn && saved.songId !== current.songId) {
    return saved
  } else if (current.type === slideTypes.bible &&
    saved.slideStyle?.bibleVersion !== undefined &&
    saved.slideStyle.bibleVersion !== current.slideStyle?.bibleVersion) {
    return saved
  } else if (current.type === slideTypes.songSetlist) {
    const savedSetlist = saved.data as SongSetlistData | undefined
    const currentSetlist = current.data as SongSetlistData | undefined
    const active = currentSetlist?.songs?.[currentSetlist.activeSongIndex]
    if (!active || !savedSetlist?.songs) return saved
    const activeSongIndex = savedSetlist.songs.findIndex((item) => item.id === active.id)
    const savedItem = savedSetlist.songs[activeSongIndex]
    if (!savedItem || savedItem.songId !== active.songId ||
      (savedItem.song?.lyrics !== undefined && savedItem.song.lyrics !== active.song?.lyrics)) return saved
    const songs = [...savedSetlist.songs]
    songs[activeSongIndex] = {
      ...savedItem,
      song: savedItem.song ? { ...savedItem.song, verses: active.song?.verses } : active.song,
      verseIndex: active.verseIndex,
    }
    data = { ...savedSetlist, songs, activeSongIndex }
  }

  return {
    ...saved,
    title: current.title,
    ...(current.type === slideTypes.bible && saved.name === saved.title
      ? { name: current.name }
      : {}),
    contents: current.contents,
    layout: current.layout,
    data,
    songId: current.songId,
    hymnVerseIndex: current.hymnVerseIndex,
    hymnSubVerseIndex: current.hymnSubVerseIndex,
    hymnSubVerseTotal: current.hymnSubVerseTotal,
    slideStyle: {
      ...saved.slideStyle,
      fontSize: current.slideStyle?.fontSize,
      ...(current.type === slideTypes.bible
        ? { bibleVersion: current.slideStyle?.bibleVersion }
        : {}),
    },
  }
}
