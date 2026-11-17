import type { Slide } from "~/types"
import { toSocketSafeSlide } from "~/utils/mediaTransport"

/**
 * Convert a reactive slide into a session-independent structured-clone value.
 * Keeps `pendingUpload`: the durable copy is how another window, or this one
 * after a reload, learns that a slide is still uploading. It is local storage
 * only; nothing here goes to the server.
 */
export const cloneDurableSlide = async (slide: Slide): Promise<Slide> => {
  const safe = await toSocketSafeSlide(slide)
  return JSON.parse(JSON.stringify(safe)) as Slide
}

export default cloneDurableSlide

