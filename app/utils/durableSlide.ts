import type { Slide } from "~/types"
import { toTransportSafeSlide } from "~/utils/mediaTransport"

/** Convert a reactive slide into a session-independent structured-clone value. */
export const cloneDurableSlide = async (slide: Slide): Promise<Slide> => {
  const safe = await toTransportSafeSlide(slide)
  return JSON.parse(JSON.stringify(safe)) as Slide
}

export default cloneDurableSlide

