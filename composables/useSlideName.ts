import { useAppStore } from "~/store/app"
import type { Slide } from "~/types/index"
import { backgroundTypes, slideLayoutTypes, slideTypes } from "~/utils/constants"

const useSlideName = (slide: Slide) => {
  const appStore = useAppStore()

  switch (slide?.type) {
    case slideTypes.media:
      return slide?.data?.name
    case slideTypes.song:
      return slide?.data?.title
    case slideTypes.text:
      if (slideLayoutTypes.heading_sub === slide.layout) {
        return slide.contents?.[0]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0] || (slide?.name?.startsWith('Untitled ') ? slide?.name : `Untitled ${appStore.currentState.activeSlides.length}`)
      }
      return slide.contents?.[1]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0] || (slide?.name?.startsWith('Untitled ') ? slide?.name : `Untitled ${appStore.currentState.activeSlides.length}`)
    case slideTypes.hymn:
      return `Hymn ${slide?.songId}`
    case slideTypes.countdown:
      return slide?.data?.time?.replace('00:', '')
    default:
      return `${slide?.title}`
  }
  return ''
}

export default useSlideName