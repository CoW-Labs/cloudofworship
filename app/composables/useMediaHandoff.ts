/**
 * Keeps a slide's video or audio playing where it was when the element that
 * plays it is replaced: a slide that was live alone being taken live as part of
 * a pair (or the other way round), or a pair member taken off the screen and
 * put back. Without this the new element starts the file again from 0.
 *
 * Keyed by slide id and kind, per window. Two cases:
 * - The old element is still mounted (it is fading out in a leave transition)
 *   when the new one arrives: the new one takes its time straight away, and the
 *   old one is paused and muted so the sound does not play twice.
 * - The old element is gone already: its position was kept when it unmounted,
 *   and is used if that was only a moment ago.
 */

type MediaKind = "video" | "audio"
type SavedPosition = {
  time: number
  at: number
  playing: boolean
  /** Taken off the screen on purpose: resumes from here however long it was. */
  held?: boolean
}

/** A handoff later than this is a new showing, not the same one continuing. */
const RESUME_WITHIN_MS = 3000

const mounted = new Map<string, HTMLMediaElement>()
const saved = new Map<string, SavedPosition>()

export const mediaHandoffKey = (slideId: string, kind: MediaKind) =>
  `${slideId}:${kind}`

const seekWhenReady = (el: HTMLMediaElement, time: number) => {
  const apply = () => {
    if (Number.isFinite(el.duration) && time >= el.duration) return
    try {
      el.currentTime = time
    } catch {
      // Not seekable yet: it plays from the start, as it did before.
    }
  }
  if (el.readyState >= 1) apply()
  else el.addEventListener("loadedmetadata", apply, { once: true })
}

/** `el` now plays `key`. Picks up the position from the element before it. */
export const adoptMedia = (key: string, el: HTMLMediaElement) => {
  const previous = mounted.get(key)
  mounted.set(key, el)
  if (previous && previous !== el && previous.isConnected) {
    const time = previous.currentTime
    previous.muted = true
    previous.pause()
    if (time > 0) seekWhenReady(el, time)
    return
  }
  const position = saved.get(key)
  saved.delete(key)
  if (!position) return
  if (position.held) {
    seekWhenReady(el, position.time)
    return
  }
  const age = Date.now() - position.at
  if (age > RESUME_WITHIN_MS) return
  seekWhenReady(el, position.time + (position.playing ? age / 1000 : 0))
}

/**
 * The slide's media was taken off the screen on purpose (a pair member
 * hidden): it picks up from where it stopped when shown again, as if paused.
 * Call after the element has unmounted.
 */
export const holdMediaPosition = (slideId: string) => {
  for (const kind of ["video", "audio"] as const) {
    const key = mediaHandoffKey(slideId, kind)
    const position = saved.get(key)
    if (position) saved.set(key, { ...position, playing: false, held: true })
  }
}

/**
 * `el` stops playing `key`. With `keepPosition` (the element is being
 * unmounted, not moved on to another slide) the position is kept briefly for
 * whichever element takes over.
 */
export const releaseMedia = (
  key: string,
  el: HTMLMediaElement,
  { keepPosition = false }: { keepPosition?: boolean } = {}
) => {
  if (mounted.get(key) !== el) return
  mounted.delete(key)
  if (keepPosition && el.currentTime > 0) {
    saved.set(key, { time: el.currentTime, at: Date.now(), playing: !el.paused })
  }
}
