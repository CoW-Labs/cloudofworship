import type { Countdown, Slide, StageTimerState } from "~/types"
import type { StageNextContent } from "~/composables/useStageNextContent"
import useTimeStringToMilli from "~/composables/useTimeStringToMilli"
import { slideTypes } from "~/utils/constants"
import { defaultStageTimerState, normaliseStageTimer } from "~/utils/stageTimer"
import {
  stageNextView,
  stageNowView,
  type StagePanelView,
} from "~/utils/stageView"

/**
 * The stage display, sent over the socket to `/stagestream/:schedule_id`.
 *
 * The console that owns the live output works the stage view out and sends the
 * finished text; the page on the band's phone or TV only draws it. That keeps
 * the viewer free of Bible translations and schedule data, and keeps the link
 * from ever exposing more of the service than NOW and NEXT.
 */

export const STAGE_STREAM_VERSION = 1

export interface StageStreamCountdown {
  /** What the countdown slide says alongside its clock. */
  content: string
  /** Time left as of `sentAt`, in milliseconds. */
  remainingMs: number
  running: boolean
}

export interface StageStreamState {
  version: typeof STAGE_STREAM_VERSION
  /** The sending console's wall clock when this was built. */
  sentAt: number
  /**
   * How long the server held this before delivering it — set on a replay to a
   * viewer that joined late. Measured on the server, so only ever a duration.
   */
  ageMs?: number
  isLive: boolean
  slideName: string
  now: StagePanelView
  next: StagePanelView
  /** 1-based position of the live slide in the schedule; 0 when unknown. */
  position: number
  count: number
  countdown: StageStreamCountdown | null
  timer: StageTimerState
}

/** Everything the timer panel needs to run from a stream instead of this window. */
export interface StageStreamClock {
  timer: StageTimerState
  countdown: StageStreamCountdown | null
  slideName: string
  sentAt: number
  /** Add to this device's `Date.now()` to read the sending console's clock. */
  offsetMs: number
}

/**
 * The live countdown slide, if one is on screen.
 *
 * A running countdown writes a fresh `remainingMs` every second. `observedAt`
 * is when the feed saw that write, so the time that passed before sending can
 * be taken off — otherwise the stage would run up to a second behind the room.
 */
export const stageStreamCountdown = (
  slide: Slide | null | undefined,
  sentAt: number,
  observedAt: number = sentAt
): StageStreamCountdown | null => {
  if (slide?.type !== slideTypes.countdown) return null
  const data = slide.data as Countdown | undefined
  if (!data?.timeLeft) return null

  const running =
    !!slide.slideStyle?.isMediaPlaying && typeof data.remainingMs === "number"

  return {
    content: data.content || "",
    remainingMs: running
      ? Math.max(0, data.remainingMs! - Math.max(0, sentAt - observedAt))
      : useTimeStringToMilli(data.timeLeft),
    running,
  }
}

export const buildStageStreamState = (input: {
  slide: Slide | null | undefined
  next: StageNextContent | null | undefined
  position: number
  count: number
  timer: StageTimerState
  sentAt: number
  countdownObservedAt?: number
}): StageStreamState => ({
  version: STAGE_STREAM_VERSION,
  sentAt: input.sentAt,
  isLive: !!input.slide,
  slideName: input.slide?.name || "",
  now: stageNowView(input.slide),
  next: stageNextView(input.slide, input.next),
  position: input.position,
  count: input.count,
  countdown: stageStreamCountdown(
    input.slide,
    input.sentAt,
    input.countdownObservedAt
  ),
  timer: normaliseStageTimer(input.timer, input.sentAt),
})

/** What a stage viewer shows before the first state arrives. */
export const emptyStageStreamState = (): StageStreamState =>
  buildStageStreamState({
    slide: null,
    next: null,
    position: 0,
    count: 0,
    timer: defaultStageTimerState(),
    sentAt: Date.now(),
  })

/**
 * Whether sending `next` would change anything a viewer can see after `prev`.
 *
 * A running countdown is compared by when it will end, not by what it reads:
 * its reading changes every second while its end time does not, and the viewer
 * ticks it locally. Without this the stream would carry one message a second
 * for the length of every countdown.
 */
export const isSameStageStream = (
  prev: StageStreamState | null,
  next: StageStreamState
) => {
  if (!prev) return false
  const { sentAt: _a, ageMs: _b, countdown: prevCountdown, ...prevRest } = prev
  const { sentAt: _c, ageMs: _d, countdown: nextCountdown, ...nextRest } = next
  if (JSON.stringify(prevRest) !== JSON.stringify(nextRest)) return false

  if (!prevCountdown || !nextCountdown) return prevCountdown === nextCountdown
  if (
    prevCountdown.content !== nextCountdown.content ||
    prevCountdown.running !== nextCountdown.running
  ) {
    return false
  }
  if (!nextCountdown.running) {
    return prevCountdown.remainingMs === nextCountdown.remainingMs
  }

  const prevEndsAt = prev.sentAt + prevCountdown.remainingMs
  const nextEndsAt = next.sentAt + nextCountdown.remainingMs
  return Math.abs(prevEndsAt - nextEndsAt) < 1500
}

export const isStageStreamState = (value: unknown): value is StageStreamState => {
  const state = value as Partial<StageStreamState> | null
  return (
    !!state &&
    typeof state === "object" &&
    state.version === STAGE_STREAM_VERSION &&
    typeof state.sentAt === "number" &&
    !!state.now &&
    typeof state.now === "object" &&
    !!state.next &&
    typeof state.next === "object"
  )
}

/**
 * How far this device's clock is behind the sending console's. The network
 * trip is ignored, which puts the stage a fraction of a second behind at most —
 * far better than trusting two unrelated clocks to agree.
 */
export const stageStreamClockOffset = (
  state: StageStreamState,
  receivedAt: number = Date.now()
) => state.sentAt + Math.max(0, state.ageMs || 0) - receivedAt

/** What is left of a streamed countdown at `consoleNow` (the console's clock). */
export const stageStreamCountdownLeft = (
  countdown: StageStreamCountdown,
  sentAt: number,
  consoleNow: number
) =>
  countdown.running
    ? Math.max(0, countdown.remainingMs - Math.max(0, consoleNow - sentAt))
    : countdown.remainingMs
