import type { InterludeSlideData, Slide } from "~/types"
import useSlideContent from "~/composables/useSlideContent"
import { backgroundTypes } from "~/utils/constants"
import { DEFAULT_INTERLUDE_VARIANT, getInterludeVariant } from "./engine"

export const defaultInterludeData = (): Omit<InterludeSlideData, "id"> => ({
  variant: DEFAULT_INTERLUDE_VARIANT,
  heading: "Welcome Home",
  subtitle: "We'll begin shortly",
  textBackground: "auto",
})

/**
 * Returns the slide with its interlude data applied, keeping the fields
 * derived from it (name, plain-text contents, background) in step. The canvas
 * paints the whole frame, so the background is only the variant's base colour:
 * it shows for the instant before the first frame and in anything that does
 * not render the canvas. A slide background video would play unseen, so it is
 * cleared.
 */
export const withInterludeData = (
  slide: Slide,
  data: InterludeSlideData
): Slide => {
  const variant = getInterludeVariant(data.variant)
  const next: Slide = {
    ...slide,
    data,
    name: data.heading.trim() || "Interlude",
    backgroundType: backgroundTypes.solid,
    background: variant.palettes[0].bg,
    backgroundVideoKey: null,
    backgroundImageKey: null,
  }
  next.contents = useSlideContent(next, data)
  return next
}
