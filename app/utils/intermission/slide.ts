import type { IntermissionSlideData, Slide } from "~/types"
import useSlideContent from "~/composables/useSlideContent"
import { backgroundTypes } from "~/utils/constants"
import { DEFAULT_INTERMISSION_VARIANT, getIntermissionVariant } from "./engine"

export const defaultIntermissionData = (): Omit<IntermissionSlideData, "id"> => ({
  variant: DEFAULT_INTERMISSION_VARIANT,
  heading: "Welcome Home",
  subtitle: "We'll begin shortly",
  textBackground: "auto",
})

/**
 * Returns the slide with its intermission data applied, keeping the fields
 * derived from it (name, plain-text contents, background) in step. The canvas
 * paints the whole frame, so the background is only the variant's base colour:
 * it shows for the instant before the first frame and in anything that does
 * not render the canvas. A slide background video would play unseen, so it is
 * cleared.
 */
export const withIntermissionData = (
  slide: Slide,
  data: IntermissionSlideData
): Slide => {
  const variant = getIntermissionVariant(data.variant)
  const next: Slide = {
    ...slide,
    data,
    name: data.heading.trim() || "Intermission",
    backgroundType: backgroundTypes.solid,
    background: variant.palettes[0].bg,
    backgroundVideoKey: null,
    backgroundImageKey: null,
  }
  next.contents = useSlideContent(next, data)
  return next
}
