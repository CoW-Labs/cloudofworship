import type {
  ExtendedFileT,
  LivePayload,
  Slide,
  SlidePair,
  SlidePairBackground,
  SlidePairLayout,
} from "~/types"
import { backgroundTypes, slideTypes } from "~/utils/constants"

/**
 * How many slides a pair holds. The model and the live payload are arrays, so
 * pairs of three only need this raised and a layout that places them.
 */
export const MAX_PAIR_SIZE = 2

export const SLIDE_PAIR_LAYOUTS: {
  value: SlidePairLayout
  label: string
  hint: string
}[] = [
  {
    value: "side-by-side",
    label: "Side by side",
    hint: "The picture in a card beside the words, on the pair background",
  },
  {
    value: "picture-in-picture",
    label: "Picture in picture",
    hint: "The words full screen, the picture in a small card",
  },
  {
    value: "caption",
    label: "Caption",
    hint: "The picture full screen, the words across the bottom",
  },
  {
    value: "lower-third",
    label: "Lower third",
    hint: "The picture full screen, the words in a box across the bottom",
  },
]

/**
 * What a pair shows behind the side-by-side layout when it has no background
 * of its own: the light grey of the design.
 */
export const DEFAULT_PAIR_BACKGROUND: Required<SlidePairBackground> = {
  background: "#D9D9D9",
  backgroundType: backgroundTypes.solid,
  backgroundImageKey: null,
  backgroundVideoKey: null,
}

/** The pair's background, or the default. Never read from a member slide. */
export const pairBackgroundOf = (
  source: SlidePairBackground | null | undefined
): Required<SlidePairBackground> =>
  source?.background && source?.backgroundType
    ? {
        background: source.background,
        backgroundType: source.backgroundType,
        backgroundImageKey: source.backgroundImageKey ?? null,
        backgroundVideoKey: source.backgroundVideoKey ?? null,
      }
    : DEFAULT_PAIR_BACKGROUND

export type PairRole = "frame" | "text"

type PairBox = { top: number; left: number; width: number; height: number }
type PairCard = { border: number; lip: number; radius: number }

const FULL_SCREEN: PairBox = { top: 0, left: 0, width: 100, height: 100 }

/**
 * Where each role sits in each layout, measured off the 1920×1080 designs.
 * Boxes are % of the screen; a card's border, lip and radius are cqw of the
 * screen's width; `z` stacks the roles. Every card's border and lip are
 * PAIR_CARD_COLOUR.
 */
export const PAIR_LAYOUT_GEOMETRY: Record<
  SlidePairLayout,
  Record<PairRole, { box: PairBox; card?: PairCard; z: number }>
> = {
  // The words full screen, the picture in a small card bottom-left.
  "picture-in-picture": {
    text: { box: FULL_SCREEN, z: 0 },
    frame: {
      box: { top: 64.2, left: 4.5, width: 14.95, height: 26.1 },
      card: { border: 0.2, lip: 0.95, radius: 1.2 },
      z: 10,
    },
  },
  // A portrait picture card beside a panel of words, on the pair background.
  "side-by-side": {
    frame: {
      box: { top: 17.2, left: 4.15, width: 24.2, height: 65 },
      card: { border: 0.3, lip: 1.5, radius: 2.1 },
      z: 1,
    },
    text: {
      box: { top: 14.6, left: 31.5, width: 64.2, height: 70.9 },
      card: { border: 0, lip: 0, radius: 3.1 },
      z: 1,
    },
  },
  // The picture full screen, the words straight over its foot.
  caption: {
    frame: { box: FULL_SCREEN, z: 0 },
    text: { box: { top: 72.2, left: 12.65, width: 74.7, height: 21 }, z: 10 },
  },
  // As caption, with the words in a box (the text slide's own background)
  // carrying a black border and lip.
  "lower-third": {
    frame: { box: FULL_SCREEN, z: 0 },
    text: {
      box: { top: 72.2, left: 12.65, width: 74.7, height: 21 },
      card: { border: 0.2, lip: 1.35, radius: 1.9 },
      z: 10,
    },
  },
}

/**
 * Folds slide pairs into one entry each, at the place of whichever member
 * comes first in `slides`. Pair order is not schedule order (Swap reorders a
 * pair), so the card stays where it is in the schedule when the roles flip.
 */
export const foldPairs = <T extends Slide>(
  slides: readonly T[],
  pairForSlide: (slideId: string) => SlidePair | undefined
): T[] => {
  const seen = new Set<string>()
  return slides.filter((slide) => {
    const pair = pairForSlide(slide.id)
    if (!pair) return true
    if (seen.has(pair.id)) return false
    seen.add(pair.id)
    return true
  })
}

/**
 * The dark purple of the pair designs. Every card in every layout (the
 * picture's frame, the lower-third box) takes it for its border and lip,
 * whatever the slides' own colours, so a pair always reads as one piece.
 */
export const PAIR_CARD_COLOUR = "#46215F"

/**
 * Which member takes the camera's place (`frame`: left in side-by-side, the
 * small card in picture-in-picture, full screen under a caption) and which the
 * other's (`text`). The camera always takes the frame, whatever the other
 * slide is. With two cameras, the one that was in the pair first does.
 */
export const pairRoles = <T extends Slide>(
  slides: readonly T[]
): { frame: T | undefined; text: T | undefined } => {
  const [first, second] = slides
  if (!isCameraSlide(first) && isCameraSlide(second)) {
    return { frame: second, text: first }
  }
  return { frame: first, text: second }
}

/**
 * Who is heard in a pair. A media file's own sound plays unless it is muted in
 * its slide settings (the picture before the words). A camera's microphone
 * plays only when the operator turned it on for the pair (`micSlideId`, stored
 * as the pair's `audioSlideId`): a room microphone sent out through speakers
 * in the same room howls, so it is never automatic. A member that is off the
 * screen is never a candidate. Returns the member's id and whether it is the
 * mic that plays.
 */
export const pairAudioOwner = (
  slides: readonly Slide[],
  hiddenSlideId?: string | null,
  micSlideId?: string | null
): { slideId: string; source: "media" | "mic" } | null => {
  const { frame, text } = pairRoles(slides)
  const audible = [frame, text].filter(
    (slide): slide is Slide =>
      !!slide && slide.id !== hiddenSlideId && !slide.slideStyle?.isMediaMuted
  )
  const media = audible.find(
    (slide) =>
      slide.type === slideTypes.media &&
      (slide.data as ExtendedFileT | undefined)?.type !== "image"
  )
  if (media) return { slideId: media.id, source: "media" }
  const camera = micSlideId
    ? audible.find(
        (slide) => slide.id === micSlideId && slide.type === slideTypes.camera
      )
    : undefined
  return camera ? { slideId: camera.id, source: "mic" } : null
}

export const isCameraSlide = (slide: Slide | null | undefined) =>
  slide?.type === slideTypes.camera

/** Every pair holds at least one camera slide. */
export const pairHasCamera = (slides: readonly (Slide | null | undefined)[]) =>
  slides.some(isCameraSlide)

/**
 * Whether a slide can be dropped onto, or start a pair from its menu. Only a
 * camera can: a pair is two cameras, or a camera and one other slide.
 */
export const canBePairTarget = (slide: Slide | null | undefined) =>
  !!slide && isCameraSlide(slide) && slide.slideMode !== "overlay"

/**
 * The member a pair is driven by: the one Up/Down steps through, that media
 * controls answer to, and that the stage display treats as now. That is the
 * slide that is not a camera, since a camera has no verses or playback. With
 * two cameras it is the main one, the first in pair order.
 */
export const drivenMemberId = (
  slideIds: readonly string[],
  slideFor: (slideId: string) => Slide | undefined
): string | undefined => {
  const nonCameras = slideIds.filter((id) => !isCameraSlide(slideFor(id)))
  return nonCameras.length === 1 ? nonCameras[0] : slideIds[0]
}

/**
 * Whether a change to a pair changes what is on screen. Which member is
 * active is per window and not part of it.
 */
export const livePairChanged = (before: SlidePair, after: SlidePair) =>
  before.layout !== after.layout ||
  (before.hiddenSlideId ?? null) !== (after.hiddenSlideId ?? null) ||
  (before.audioSlideId ?? null) !== (after.audioSlideId ?? null) ||
  before.slideIds.join("|") !== after.slideIds.join("|") ||
  (before.background ?? null) !== (after.background ?? null) ||
  (before.backgroundType ?? null) !== (after.backgroundType ?? null) ||
  (before.backgroundImageKey ?? null) !== (after.backgroundImageKey ?? null) ||
  (before.backgroundVideoKey ?? null) !== (after.backgroundVideoKey ?? null)

export const isSlidePairLayout = (value: unknown): value is SlidePairLayout =>
  SLIDE_PAIR_LAYOUTS.some((layout) => layout.value === value)

/** True for a live payload that is a slide pair rather than one slide. */
export const isPairPayload = (payload: LivePayload | unknown): payload is Slide[] =>
  Array.isArray(payload) && payload.length > 0

/**
 * The pair's members, in pair order, each stamped with the pair's layout,
 * microphone, hidden and driven member, so a receiver can render the pair from
 * the payload alone. Returns null when a member is missing, which leaves the
 * caller to project whichever slide it has rather than half a pair.
 *
 * `hiddenSlideId` overrides the pair's own for this projection only, e.g. a
 * member whose media has not reached this device yet.
 */
export const stampPairForLive = (
  pair: SlidePair,
  slidesById: ReadonlyMap<string, Slide>,
  options: { hiddenSlideId?: string | null } = {}
): Slide[] | null => {
  const members = pair.slideIds.map((id) => slidesById.get(id))
  if (members.length < 2 || members.some((slide) => !slide)) return null
  const activeSlideId =
    drivenMemberId(pair.slideIds, (id) => slidesById.get(id)) ||
    pair.slideIds[0]!
  const hiddenSlideId =
    options.hiddenSlideId !== undefined
      ? options.hiddenSlideId
      : pair.hiddenSlideId ?? null
  return (members as Slide[]).map((slide, position) => ({
    ...slide,
    livePair: {
      pairId: pair.id,
      layout: pair.layout,
      audioSlideId: pair.audioSlideId ?? null,
      hiddenSlideId,
      activeSlideId,
      position,
      ...pairBackgroundOf(pair),
    },
  }))
}

/**
 * A pair that was on screen, carried on with only `incoming` showing, when
 * `incoming` is one of its members going live on its own (the pair was
 * unpaired, or its other slide deleted). The member that stays keeps its
 * element, so its video or camera runs on while the other fades out, instead
 * of the whole screen being rebuilt. Null when `incoming` is not a member.
 */
export const continueAsSolo = (
  previous: readonly Slide[] | null | undefined,
  incoming: Slide | null | undefined
): Slide[] | null => {
  if (!previous?.length || !incoming) return null
  const index = previous.findIndex((member) => member.id === incoming.id)
  if (index === -1) return null
  const other = previous.find((member) => member.id !== incoming.id)
  return previous.map((member, position) => {
    const stamp = previous[position]!.livePair!
    const base = position === index ? incoming : member
    return {
      ...base,
      livePair: {
        ...stamp,
        hiddenSlideId: other?.id ?? null,
        activeSlideId: incoming.id,
      },
    }
  })
}

/**
 * The member the operator is driving. Single-slide readers (the stage display,
 * the live slide id) follow this one.
 */
export const activeMemberOf = (slides: readonly Slide[]): Slide | null =>
  slides.find((slide) => slide.id === slide.livePair?.activeSlideId) ||
  slides[0] ||
  null

/** The slide a single-slide reader should treat as live. */
export const primaryLiveSlide = (payload: LivePayload): Slide | null =>
  isPairPayload(payload) ? activeMemberOf(payload) : payload

/** Every slide id on screen. */
export const liveSlideIds = (payload: LivePayload): string[] =>
  (isPairPayload(payload) ? payload : payload ? [payload] : []).map(
    (slide) => slide.id
  )

/**
 * Folds an edit to one slide into a live payload: the matching member of a
 * pair is replaced and keeps its stamp; a single slide is replaced outright.
 * Returns the payload unchanged when the slide is not on screen.
 */
export const patchLivePayload = (
  payload: LivePayload,
  slide: Slide
): LivePayload => {
  if (!payload) return payload
  if (isPairPayload(payload)) {
    const index = payload.findIndex((member) => member.id === slide.id)
    if (index === -1) return payload
    const next = payload.slice()
    next[index] = { ...slide, livePair: slide.livePair ?? payload[index]!.livePair }
    return next
  }
  return payload.id === slide.id ? slide : payload
}

/**
 * Whether two slides may be paired, and why not. Membership is read from the
 * pairs, not from `slide.pairId`, which can lag a pair made on another device.
 */
export const pairRejection = (
  target: Slide | undefined,
  source: Slide | undefined,
  pairForSlide: (slideId: string) => SlidePair | undefined
): string | null => {
  if (!target || !source) return "That slide is no longer in this schedule."
  if (target.id === source.id) return "A slide cannot be paired with itself."
  if (target.slideMode === "overlay" || source.slideMode === "overlay") {
    return "Overlay slides cannot be paired."
  }
  if (!pairHasCamera([target, source])) {
    return "A slide pair needs a camera slide. Drop this onto a camera slide."
  }
  if (pairForSlide(target.id) || pairForSlide(source.id)) {
    return "One of these slides is already in a pair. Unpair it first."
  }
  return null
}
