import { Slide } from "~/types";

const useShortSlideName = (slide: Slide, options?: { longer: boolean }) => {
  switch (slide.type) {
    case slideTypes.bible:
      if (slide?.name?.length <= 12) {
        return slide.name
      }
      const lastWhitespaceCharacter = slide.name.lastIndexOf(' ')
      if (isNaN(Number(slide.name[0]))) {
        return `${slide?.name?.slice(0, 4)} ${slide?.name?.slice(lastWhitespaceCharacter)}`
      }
      return `${slide?.name?.slice(0, 6)} ${slide?.name?.slice(lastWhitespaceCharacter)}`
    case slideTypes.text:
      if (slide?.name?.length <= 15) {
        return slide.name
      } else {
        return `${slide?.name?.slice(0, 12)}...`
      }
    case slideTypes.song:
      if (slide?.name?.length <= 15) {
        return slide.name
      } else {
        return `${slide?.name?.slice(0, options?.longer ? 20 : 10)}...`
      }
    case slideTypes.media:
      if (slide?.name?.length <= 12) {
        return slide.name
      } else {
        return `${slide?.name?.slice(0, 6).trim()}..${slide.name?.substring(slide.name.lastIndexOf('.'))}`
      }
    default:
      return slide.name
  }
}

export default useShortSlideName;