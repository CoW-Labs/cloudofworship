import type { Slide } from "~/types"
import type { StageNextContent } from "~/composables/useStageNextContent"
import { backgroundTypes, slideTypes } from "~/utils/constants"
import { slideToPlainLabel, slideToPlainText } from "~/utils/slideText"

/**
 * What one of the stage display's two big panels (NOW, NEXT) shows: a header
 * label, the words themselves, and what to say instead when there are none.
 *
 * Worked out once here so the local stage window, the operator console feeding
 * `/stagestream`, and that page itself all describe a slide the same way. The
 * stream sends these finished strings rather than slides, which is what keeps
 * the rest of the schedule off a link that is nothing more than a schedule id.
 */
export interface StagePanelView {
  label: string
  text: string
  placeholder: string
  icon: string
  /**
   * `/stagestream` only: a cloud URL for a slide with a picture instead of
   * words (a presentation page, an image). The local window draws the slide
   * itself from `stageVisualSlide` instead.
   */
  image?: string
}

/**
 * An uploaded image. Audio slides also carry `backgroundType: image` (a stock
 * photo behind the player), so the file's own type has to agree.
 */
const isImageMediaSlide = (slide: Slide) =>
  slide.type === slideTypes.media &&
  slide.backgroundType === backgroundTypes.image &&
  (slide.data as { type?: string } | undefined)?.type === "image"

/**
 * Slides the stage draws as a picture, because they have no words to show:
 * presentation pages and images. Video is left as a placeholder, since the
 * preview would be a black box without playing it a second time.
 */
export const isStageVisualSlide = (slide?: Slide | null): slide is Slide =>
  !!slide &&
  (slide.type === slideTypes.presentation || isImageMediaSlide(slide))

/** A presentation turned to `pageIndex`, with the background that page uses. */
const atPresentationPage = (slide: Slide, pageIndex: number): Slide => ({
  ...slide,
  presentationPageIndex: pageIndex,
  background:
    slide.presentationObjects?.[pageIndex]?.imageUrl || slide.background,
})

/** What NOW should draw, when the live slide has no words. */
export const stageNowVisualSlide = (live?: Slide | null) =>
  isStageVisualSlide(live) ? live : null

/**
 * What NEXT should draw: the next page of the presentation on screen, or the
 * next slide in the schedule when that is media or a presentation (which opens
 * on its first page, whichever one it was left on).
 */
export const stageNextVisualSlide = (
  live: Slide | null | undefined,
  next: StageNextContent | null | undefined,
  scheduleSlides: readonly Slide[]
): Slide | null => {
  if (!live || !next) return null

  if (next.source === "verse") {
    return live.type === slideTypes.presentation
      ? atPresentationPage(live, (live.presentationPageIndex ?? 0) + 1)
      : null
  }

  const index = scheduleSlides.findIndex((slide) => slide.id === live.id)
  const upcoming = index === -1 ? null : scheduleSlides[index + 1]
  if (!isStageVisualSlide(upcoming)) return null
  return upcoming.type === slideTypes.presentation
    ? atPresentationPage(upcoming, 0)
    : upcoming
}

const isCloudUrl = (url: unknown): url is string =>
  typeof url === "string" && /^https:\/\//i.test(url)

/**
 * The picture a stage viewer elsewhere can load for a slide: a presentation
 * page or an image. Pass a transport-safe slide, whose URLs have already been
 * swapped for cloud ones. Anything only on the operator's computer gets no
 * picture and keeps its placeholder.
 */
export const stageSlideImageUrl = (slide?: Slide | null) => {
  if (!slide) return ""
  if (slide.type === slideTypes.presentation) {
    const page =
      slide.presentationObjects?.[slide.presentationPageIndex ?? 0]?.imageUrl
    return isCloudUrl(page) ? page : ""
  }
  if (!isImageMediaSlide(slide)) return ""

  const data = slide.data as { url?: string } | undefined
  if (isCloudUrl(data?.url)) return data.url
  if (isCloudUrl(slide.background)) return slide.background
  return ""
}

export const stageNowView = (slide?: Slide | null): StagePanelView => {
  const view: StagePanelView = {
    label: slideToPlainLabel(slide),
    text: slideToPlainText(slide),
    placeholder: slide?.name || "Nothing is live yet",
    icon: "i-bx-tv",
  }

  if (!slide) return { ...view, placeholder: "Nothing is live yet" }

  if (isImageMediaSlide(slide)) {
    return { ...view, placeholder: slide.name || "Image", icon: "i-bx-image" }
  }

  if (slide.type === slideTypes.media) {
    return { ...view, placeholder: "Media is playing", icon: "i-bx-play-circle" }
  }

  // The feed only exists on the projector machine; stage screens may be on
  // another device entirely, so they say so rather than open a camera.
  if (slide.type === slideTypes.camera) {
    return { ...view, placeholder: "Camera is live", icon: "i-bx-video" }
  }

  if (slide.type === slideTypes.presentation) {
    const pages = slide.presentationObjects?.length || 0
    const page = (slide.presentationPageIndex ?? 0) + 1
    return {
      ...view,
      placeholder: pages
        ? `Presentation — page ${page} of ${pages}`
        : "Presentation",
      icon: "i-bx-slideshow",
    }
  }

  return view
}

export const stageNextView = (
  liveSlide?: Slide | null,
  next?: StageNextContent | null
): StagePanelView => {
  // A new slide is a bigger jump than the next verse of what is already up, so
  // name it — "Up next: Hymn 24" reads very differently to "Verse 3".
  const label = !next
    ? ""
    : next.source === "slide"
    ? `Up next • ${next.slideName}`
    : [next.slideName, next.label].filter(Boolean).join(" • ")

  // Slides with no words of their own — media, presentation pages — still have
  // something worth naming, so fall back to their label rather than claiming
  // the schedule has ended.
  const placeholder = !liveSlide
    ? "Waiting for the operator"
    : !next
    ? "End of schedule"
    : next.label || next.slideName || "End of schedule"

  return {
    label,
    text: next?.text || "",
    placeholder,
    icon: next ? "i-bx-slideshow" : "i-bx-check-circle",
  }
}
