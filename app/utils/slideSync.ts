import type { Slide } from "~/types"
import { backgroundTypes, slideTypes } from "~/utils/constants"
import { toTransportSafeSlide } from "~/utils/mediaTransport"

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
 * Media (video) slides: the video itself is owned by its own upload flow, so
 * an edit never re-broadcasts it, and saving one sends only its settings (see
 * toSlideUpdatePayload).
 */
export const isMediaVideoSlide = (slide: Slide) =>
  slide.type === slideTypes.media &&
  slide.backgroundType === backgroundTypes.video

/**
 * The API derives these from the route and the stored document, and rejects or
 * mis-stores them when they arrive in the body.
 */
export const toSlideUpdatePayload = async (slide: Slide) => {
  // A video slide's edits are its settings (loop, mute, fill). The API $sets
  // only what it is sent, so leaving the video fields out keeps a save from
  // touching the upload flow's URL and key. Sending nothing at all, as before,
  // let the server copy undo those settings on the next reload.
  if (isMediaVideoSlide(slide)) {
    return { name: slide.name, slideStyle: slide.slideStyle }
  }

  // A rehydrated slide carries this device's playback URLs (blob:, and
  // asset.localhost file paths on desktop). Sent as-is they replaced the CDN
  // URLs on the server, and the media vanished for every other device.
  const payload: Slide | any = await toTransportSafeSlide(slide)
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
