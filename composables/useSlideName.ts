import type { Slide } from "~/types/index"
import { backgroundTypes } from "~/utils/constants"

const useSlideName = (slide: Slide) => {
  switch (slide?.type) {
    case slideTypes.media:
      return slide?.data?.name
    case slideTypes.song:
      return slide?.data?.title
    case slideTypes.text:
      if (slideLayoutTypes.heading_sub === slide.layout) {
        return slide.contents?.[0]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0]
      }
      return slide.contents?.[1]?.trim()?.replaceAll('<br>', '\n')?.replaceAll('</h1>', '\n')?.replaceAll('</h2>', '\n')?.replaceAll('</h3>', '\n')?.replace(/<[^>]*>/g, '')?.split('\n')?.[0]
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