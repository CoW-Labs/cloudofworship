import type { Slide } from "~/types"
import { backgroundTypes, slideTypes } from "~/utils/constants"

/**
 * Shared shape of a slide update sent to the API.
 *
 * Both the live edit path (`persistSlideOnline` in PreviewContent.vue) and the
 * pending-slide resync post the same endpoint. Keeping the payload and the URL
 * here means a change to either cannot silently apply to only one of them —
 * a resync that sent a subtly different body would write different data than
 * the edit it is replaying.
 */

/**
 * Media (video) slides are never re-synced — their heavy video payload is
 * handled by its own upload flow and must not be re-broadcast/re-persisted.
 */
export const isMediaVideoSlide = (slide: Slide) =>
  slide.type === slideTypes.media &&
  slide.backgroundType === backgroundTypes.video

/**
 * The API derives these from the route and the stored document, and rejects or
 * mis-stores them when they arrive in the body.
 */
export const toSlideUpdatePayload = (slide: Slide) => {
  const payload: Slide | any = { ...slide }
  delete payload._id
  delete payload.id
  delete payload.churchId
  delete payload.type

  if (payload.backgroundType !== backgroundTypes.video) {
    payload.backgroundVideoKey = null
  }
  return payload
}

export const slideUpdatePath = (
  churchId: string,
  scheduleId: string,
  serverId: string
) => `/church/${churchId}/schedules/${scheduleId}/slides/${serverId}`
