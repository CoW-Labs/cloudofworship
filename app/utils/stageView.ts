import type { Slide } from "~/types"
import type { StageNextContent } from "~/composables/useStageNextContent"
import { slideTypes } from "~/utils/constants"
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
}

export const stageNowView = (slide?: Slide | null): StagePanelView => {
  const view: StagePanelView = {
    label: slideToPlainLabel(slide),
    text: slideToPlainText(slide),
    placeholder: slide?.name || "Nothing is live yet",
    icon: "i-bx-tv",
  }

  if (!slide) return { ...view, placeholder: "Nothing is live yet" }

  if (slide.type === slideTypes.media) {
    return { ...view, placeholder: "Media is playing", icon: "i-bx-play-circle" }
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
