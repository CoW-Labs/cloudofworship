import type { Slide } from "~/types/index"
import { backgroundTypes } from "~/utils/constants"

const useSlideBackground = (slide: Slide) => {
  switch (slide?.backgroundType) {
    case backgroundTypes.solid:
      return `background-color: ${slide?.background};`
    case backgroundTypes.gradient:
      return `background-color: ${slide?.background};`
    case backgroundTypes.image:
      return `background-image: url(${slide?.background});`
  }
  return "#000000"
}

export default useSlideBackground