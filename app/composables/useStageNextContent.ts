import type { Ref } from "vue"
import { useAppStore } from "~/store/app"
import type { Hymn, Scripture, Slide, Song, SongSetlistData } from "~/types"
import { splitVerseByLines } from "~/composables/useHymn"
import { getChapterVerseCount } from "~/composables/useScripture"
import { computeNextVerseLabel } from "~/utils/verseNavigation"
import { slideToPlainText } from "~/utils/slideText"

export interface StageNextContent {
  /** Plain text of whatever comes next. */
  text: string
  /** Reference/verse label, e.g. "Genesis 1:2", "Verse 3", "Chorus". */
  label: string
  /** Name of the slide the text belongs to. */
  slideName: string
  /** `verse` = still inside the live slide, `slide` = the next slide in the schedule. */
  source: "verse" | "slide"
}

/**
 * Resolves what the operator will most likely put on screen next, for the
 * stage display's NEXT panel.
 *
 * The answer is the same one `EditLiveContent` acts on when the operator hits
 * next: step forward inside the live slide (next verse, next hymn chunk, next
 * song in a setlist) and, once that slide is exhausted, fall through to the
 * following slide in the schedule.
 *
 * Everything here is read-only by design — the stage display is a passive
 * observer, so this never writes to the store, never records recent searches
 * and never fires analytics.
 */
export default function useStageNextContent(
  liveSlide: Ref<Slide | null | undefined>,
  indexedScheduleSlides: Ref<readonly Slide[]>
) {
  const appStore = useAppStore()
  const { currentState } = storeToRefs(appStore)

  const nextContent = ref<StageNextContent | null>(null)
  const pending = ref(false)

  /**
   * Slides belonging to the schedule the operator has open.
   *
   * `activeSlides` is not one schedule — it accumulates slides across every
   * schedule that has been loaded this session, and the operator's own
   * schedule list filters it the same way (see PreviewContent). Without this
   * the NEXT panel happily rolls off the end of today's service and into
   * whatever schedule happens to sit beside it in the array.
   *
   * Filtered once here and shared with the page, so the per-broadcast lookups
   * scan the smaller array instead of paying for a filter of their own.
   */
  const scheduleSlides = computed(() => indexedScheduleSlides.value)

  const bibleVersionFor = (slide: Slide) =>
    slide.slideStyle?.bibleVersion ||
    currentState.value.settings.defaultBibleVersion ||
    "KJV"

  /**
   * Chapter length, needed to know whether "next" rolls into a new chapter.
   *
   * Read from the session-cached verse index rather than `useScriptureChapter`,
   * which pulls the whole translation (~6MB) out of IndexedDB and filters it
   * linearly on every call. The index is built once per version per window —
   * and `useScripture` below needs it anyway to fetch the verse text.
   *
   * Deliberately version-less, matching the operator toolbar: it resolves
   * chapter length against the app's default translation.
   */
  const chapterLengthFor = async (slide: Slide): Promise<number> => {
    const label = slide.title || ""
    if (!label.includes(":")) return 0

    const parts = useScriptureLabel(label)?.split(":")
    const book = Number(parts?.[0])
    const chapter = Number(parts?.[1])
    if (!book || !chapter) return 0

    return await getChapterVerseCount(book, chapter)
  }

  const nextScripture = async (
    slide: Slide
  ): Promise<StageNextContent | null> => {
    const currentLabel = slide.title || ""
    if (!currentLabel) return null

    const verseCount = await chapterLengthFor(slide)
    const label = computeNextVerseLabel(slide, currentLabel, verseCount)
    // Already at the very end of the Bible
    if (!label || label === currentLabel) return null

    const parts = useScriptureLabel(label)?.split(":")
    const shortLabel = `${parts?.[0]}:${parts?.[1] || 1}:${parts?.[2] || 1}`
    const scripture = (await useScripture(
      shortLabel,
      bibleVersionFor(slide)
    )) as Scripture | null
    if (!scripture?.content) return null

    return {
      text: String(scripture.content),
      label: scripture.label,
      slideName: slide.name,
      source: "verse",
    }
  }

  const nextHymnSection = async (
    slide: Slide
  ): Promise<StageNextContent | null> => {
    const hymn = (await useHymn(slide.songId as string)) as Hymn | null
    if (!hymn) return null

    const label = computeNextVerseLabel(slide, slide.title || "")
    const chunksOf = (text?: string) =>
      splitVerseByLines(text || "", slide.slideStyle?.linesPerSlide)

    let chunks: string[] = []
    let chunkIndex = 0

    if (label.startsWith("Chorus")) {
      if (!hymn.chorus) return null
      chunks = chunksOf(hymn.chorus as string)
      chunkIndex = Number(label.split(":")?.[2] || 0)
    } else {
      const colonIdx = label.indexOf(":")
      const verseSection = colonIdx === -1 ? label : label.slice(0, colonIdx)
      const verseIndex = Number(verseSection?.split(" ")?.[1]) - 1
      const rawVerse = hymn.verses?.[verseIndex]?.trim()
      // Past the last verse — the hymn is done
      if (!rawVerse) return null
      chunks = chunksOf(rawVerse)
      chunkIndex = colonIdx === -1 ? 0 : Number(label.slice(colonIdx + 1) || 0)
    }

    const text = chunks[Math.min(Math.max(chunkIndex, 0), chunks.length - 1)]
    if (!text?.trim()) return null

    return {
      text: text.replaceAll("[Refrain]", "").trim(),
      label: label.split(":")[0] || label,
      slideName: slide.name,
      source: "verse",
    }
  }

  /**
   * Splits a song into verses without ever reaching the network.
   *
   * `useSong` falls back to `GET /church/:id/songs/:id` for ObjectId-style
   * ids, and a 401 there signs the user out globally — not something a passive
   * display should be able to trigger. Embedded song data and local library
   * ids (which carry a hyphen) cover the real cases; anything else resolves to
   * null and the panel falls through to the next slide in the schedule.
   */
  const loadSongLocally = async (
    source: Song | string | undefined
  ): Promise<Song | null> => {
    if (!source) return null
    if (typeof source === "string" && !source.includes("-")) return null
    // `useSong` assigns the split verses back onto the object it is handed, so
    // hand it a copy — the live slide can be the store's own slide object.
    const input = typeof source === "string" ? source : { ...source }
    return (await useSong(input as Song | string)) as Song | null
  }

  const nextSongVerse = async (
    slide: Slide
  ): Promise<StageNextContent | null> => {
    const song = await loadSongLocally(
      (slide.data as Song | undefined) || slide.songId
    )
    if (!song) return null

    const label = computeNextVerseLabel(slide, slide.title || "")
    const verseIndex = Number(label?.split(" ")?.[1]) - 1
    const verse = song.verses?.[verseIndex]?.trim()
    if (!verse) return null

    return {
      text: verse,
      label,
      slideName: slide.name,
      source: "verse",
    }
  }

  const nextSetlistVerse = async (
    slide: Slide
  ): Promise<StageNextContent | null> => {
    const data = slide.data as SongSetlistData | undefined
    const songs = Array.isArray(data?.songs) ? data.songs : []
    if (!songs.length) return null

    const activeSongIndex = Math.min(
      Math.max(Number(data?.activeSongIndex) || 0, 0),
      songs.length - 1
    )
    const activeItem = songs[activeSongIndex]
    const activeSong = await loadSongLocally(
      activeItem?.song || (activeItem?.songId as string)
    )

    const verseIndex = Math.max(Number(activeItem?.verseIndex) || 0, 0)
    const nextVerse = activeSong?.verses?.[verseIndex + 1]?.trim()
    if (nextVerse) {
      return {
        text: nextVerse,
        label: `Verse ${verseIndex + 2}`,
        slideName: activeSong?.title || slide.name,
        source: "verse",
      }
    }

    // Current song is finished — roll into the first verse of the next one
    const upcomingItem = songs[activeSongIndex + 1]
    if (!upcomingItem) return null
    const upcomingSong = await loadSongLocally(
      upcomingItem.song || upcomingItem.songId
    )
    const firstVerse = upcomingSong?.verses?.[0]?.trim()
    if (!firstVerse) return null

    return {
      text: firstVerse,
      label: "Verse 1",
      slideName: upcomingSong?.title || slide.name,
      source: "verse",
    }
  }

  /**
   * The next slide in the schedule, used once the live slide runs out.
   *
   * A live slide that isn't in the open schedule (the operator went live from
   * one service and then opened another to prepare) finds no index here, so
   * NEXT stays empty rather than pointing at an unrelated slide.
   */
  const nextScheduleSlide = (slide: Slide): StageNextContent | null => {
    const slides = scheduleSlides.value
    const index = slides.findIndex((item) => item.id === slide.id)
    const upcoming = index === -1 ? null : slides[index + 1]
    if (!upcoming) return null

    return {
      text: slideToPlainText(upcoming),
      label: upcoming.title || "",
      slideName: upcoming.name,
      source: "slide",
    }
  }

  const resolveNextWithinSlide = async (
    slide: Slide
  ): Promise<StageNextContent | null> => {
    switch (slide.type) {
      case slideTypes.bible:
        return await nextScripture(slide)
      case slideTypes.hymn:
        return await nextHymnSection(slide)
      case slideTypes.song:
        return await nextSongVerse(slide)
      case slideTypes.songSetlist:
        return await nextSetlistVerse(slide)
      case slideTypes.presentation: {
        const pages = slide.presentationObjects || []
        const nextIndex = (slide.presentationPageIndex ?? 0) + 1
        if (!pages[nextIndex]) return null
        return {
          text: "",
          label: `Page ${nextIndex + 1} of ${pages.length}`,
          slideName: slide.name,
          source: "verse",
        }
      }
      default:
        return null
    }
  }

  /**
   * Re-resolve only when the projected content actually moves. The live slide
   * object is replaced on every broadcast — including once a second while a
   * countdown ticks — and none of those need a fresh lookup.
   */
  const signature = computed(() => {
    const slide = liveSlide.value
    if (!slide) return ""
    return [
      slide.id,
      slide.title,
      slide.hymnVerseIndex,
      slide.hymnSubVerseIndex,
      slide.presentationPageIndex,
      (slide.data as SongSetlistData)?.activeSongIndex,
      currentState.value.activeSchedule?._id,
      scheduleSlides.value.length,
    ].join("|")
  })

  let requestToken = 0

  const resolve = async () => {
    const token = ++requestToken
    const slide = liveSlide.value

    if (!slide) {
      nextContent.value = null
      return
    }

    pending.value = true
    try {
      const withinSlide = await resolveNextWithinSlide(slide)
      const resolved = withinSlide || nextScheduleSlide(slide)
      // A newer slide landed while this lookup was in flight
      if (token !== requestToken) return
      nextContent.value = resolved
    } catch (error) {
      console.warn("Stage display could not resolve next content:", error)
      if (token === requestToken) nextContent.value = nextScheduleSlide(slide)
    } finally {
      if (token === requestToken) pending.value = false
    }
  }

  watch(signature, resolve, { immediate: true })

  return { nextContent, pending, scheduleSlides }
}
