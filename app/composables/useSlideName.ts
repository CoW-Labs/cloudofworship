import { useAppStore } from "~/store/app"
import type {
  Countdown,
  ExtendedFileT,
  Slide,
  Song,
  SongSetlistData,
  TimeSlideData,
} from "~/types/index"
import { slideLayoutTypes, slideTypes } from "~/utils/constants"

const useSlideName = (slide: Slide) => {
  const appStore = useAppStore()

  switch (slide?.type) {
    case slideTypes.media:
      return (slide?.data as ExtendedFileT)?.name
    case slideTypes.song:
      return (slide?.data as Song)?.title
    case slideTypes.songSetlist: {
      const setlist = slide?.data as SongSetlistData | undefined
      const setlistsInSchedule = appStore.activeSlides
        .filter(
          (activeSlide) =>
            activeSlide.type === slideTypes.songSetlist &&
            activeSlide.scheduleId === slide.scheduleId
        )
        ?.sort((a, b) => a.index - b.index)
      const setlistIndex = setlistsInSchedule?.findIndex(
        (activeSlide) => activeSlide.id === slide.id
      )
      const setlistNumber =
        setlistIndex >= 0 ? setlistIndex + 1 : setlistsInSchedule.length + 1
      const songCount = setlist?.songs?.length || 0
      return `Song Setlist ${setlistNumber} (${songCount} ${
        songCount === 1 ? "song" : "songs"
      })`
    }
    case slideTypes.text:
      if (slideLayoutTypes.heading_sub === slide.layout) {
        return slide.contents?.[0]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0] || (slide?.name?.startsWith('Untitled ') ? slide?.name : `Untitled ${appStore.activeSlides.length}`)
      }
      return slide.contents?.[1]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0] || (slide?.name?.startsWith('Untitled ') ? slide?.name : `Untitled ${appStore.activeSlides.length}`)
    case slideTypes.hymn:
      return `Hymn ${slide?.songId}`
    case slideTypes.countdown:
      return (slide?.data as Countdown)?.time?.replace('00:', '')
    case slideTypes.time:
      return (slide?.data as TimeSlideData)?.label || "Live Time"
    default:
      return `${slide?.title}`
  }
  return ''
}

export default useSlideName
