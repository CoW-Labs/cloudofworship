import type { Ref } from "vue"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"
import useBroadcastMessage, {
  broadcastNoticeKind,
} from "~/composables/useBroadcastMessage"
import { safePauseMedia, safePlayMedia } from "~/utils/browserSafety"

/**
 * Mirrors a projected video's playback onto the operator's Live Output preview.
 *
 * The preview has its own muted <video> that does not play by itself: it plays
 * only while the projector (/live, or a pair member on it) is actually playing,
 * and pauses, seeks and stops with it. A projector that never manages to start
 * (autoplay refused, no output window open) leaves the preview still, which is
 * the truth.
 *
 * Messages ride the live channel (BroadcastChannel + the Tauri event bus), the
 * same transport as the stage timer. They are sent on media events, plus a
 * light heartbeat while playing so drift and late-opened previews correct.
 */

export type MediaPlaybackBroadcast = {
  kind: "media-playback"
  slideId: string
  playing: boolean
  /** Position in seconds at `at`. */
  time: number
  /** Wall-clock ms when `time` was read. */
  at: number
  rate: number
}

export type MediaPlaybackRequestBroadcast = {
  kind: "media-playback-request"
  slideId: string
}

const HEARTBEAT_MS = 5000
/** Below this the preview is left alone; seeking a video is not free. */
const DRIFT_TOLERANCE_S = 0.75

// The live channel also carries every live slide in full, sent on each edit of
// the live slide, and several of these listeners run in each window. Only our
// own notices are parsed.
const readPayload = (data: unknown) => {
  const kind = broadcastNoticeKind(data)
  if (kind !== undefined && kind !== "media-playback" && kind !== "media-playback-request") {
    return null
  }
  try {
    const envelope = typeof data === "string" ? JSON.parse(data) : data
    return typeof envelope?.payload === "string"
      ? JSON.parse(envelope.payload)
      : envelope?.payload
  } catch {
    return null
  }
}

const isPlayback = (p: any): p is MediaPlaybackBroadcast =>
  p?.kind === "media-playback" && typeof p.slideId === "string"

const isPlaybackRequest = (p: any): p is MediaPlaybackRequestBroadcast =>
  p?.kind === "media-playback-request" && typeof p.slideId === "string"

/** Projector side: report what `el` is doing for the slide `slideId`. */
export const useReportMediaPlayback = (
  el: Ref<HTMLMediaElement | null>,
  slideId: () => string | undefined,
  enabled: () => boolean
) => {
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const report = () => {
    const media = el.value
    const id = slideId()
    if (!media || !id || !enabled() || !media.currentSrc) return
    postCrossWindowNotification<MediaPlaybackBroadcast>({
      kind: "media-playback",
      slideId: id,
      playing: !media.paused && !media.ended,
      time: media.currentTime,
      at: Date.now(),
      rate: media.playbackRate || 1,
    })
  }

  const syncHeartbeat = () => {
    const media = el.value
    const playing = !!media && !media.paused && !media.ended
    if (playing && !heartbeat) heartbeat = setInterval(report, HEARTBEAT_MS)
    if (!playing && heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }

  const onEvent = () => {
    report()
    syncHeartbeat()
  }

  // `waiting` reports a stall, `playing` the recovery, so a buffering
  // projector does not leave the preview running ahead of it.
  const events = [
    "playing",
    "pause",
    "seeked",
    "ended",
    "ratechange",
    "waiting",
  ] as const

  watch(
    el,
    (current, previous) => {
      events.forEach((name) => previous?.removeEventListener(name, onEvent))
      events.forEach((name) => current?.addEventListener(name, onEvent))
      syncHeartbeat()
    },
    { immediate: true }
  )

  const stopListening = useBroadcastMessage((data) => {
    if (!enabled()) return
    const payload = readPayload(data)
    if (isPlaybackRequest(payload) && payload.slideId === slideId()) report()
  })

  onBeforeUnmount(() => {
    events.forEach((name) => el.value?.removeEventListener(name, onEvent))
    if (heartbeat) clearInterval(heartbeat)
    stopListening()
  })
}

/**
 * Operator side: whether the projector is playing `slideId`'s video or audio
 * right now, or null before it has said (not live, no output window, or a
 * YouTube/Vimeo player, which does not report). The stored `isMediaPlaying` is
 * only the last command, and a video starts on its own when it goes live, so
 * play/pause controls read this first.
 */
export const useProjectorPlayback = (slideId: () => string | undefined) => {
  const playing = ref<boolean | null>(null)

  const stopListening = useBroadcastMessage((data) => {
    const payload = readPayload(data)
    if (!isPlayback(payload) || payload.slideId !== slideId()) return
    playing.value = payload.playing
  })

  watch(
    slideId,
    (id) => {
      playing.value = null
      if (!id) return
      postCrossWindowNotification<MediaPlaybackRequestBroadcast>({
        kind: "media-playback-request",
        slideId: id,
      })
    },
    { immediate: true }
  )

  onBeforeUnmount(stopListening)
  return playing
}

/** Preview side: make `el` follow the projector's playback of `slideId`. */
export const useFollowMediaPlayback = (
  el: Ref<HTMLMediaElement | null>,
  slideId: () => string | undefined,
  enabled: () => boolean
) => {
  let latest: MediaPlaybackBroadcast | null = null
  // One deferred seek at most: a heartbeat landing while the file is still
  // loading replaces the waiting one rather than stacking another seek on it.
  let pendingSeek: { media: HTMLMediaElement; run: () => void } | null = null
  const clearPendingSeek = () => {
    pendingSeek?.media.removeEventListener("loadedmetadata", pendingSeek.run)
    pendingSeek = null
  }

  const apply = () => {
    const media = el.value
    const state = latest
    if (!media || !state || state.slideId !== slideId()) return

    const seek = () => {
      // Worked out when it runs, so a seek deferred to `loadedmetadata`
      // lands where the projector is then, not where it was.
      const elapsed = state.playing ? ((Date.now() - state.at) / 1000) * state.rate : 0
      let target = state.time + elapsed
      if (media.loop && media.duration > 0) target %= media.duration
      if (Math.abs(media.currentTime - target) > DRIFT_TOLERANCE_S) {
        try {
          media.currentTime = target
        } catch {
          // Not seekable yet; the next report retries.
        }
      }
    }
    clearPendingSeek()
    if (media.readyState >= 1) {
      seek()
    } else {
      const run = () => {
        pendingSeek = null
        seek()
      }
      pendingSeek = { media, run }
      media.addEventListener("loadedmetadata", run, { once: true })
    }

    if (media.playbackRate !== state.rate) media.playbackRate = state.rate
    if (state.playing) safePlayMedia(media)
    else safePauseMedia(media)
  }

  const stopListening = useBroadcastMessage((data) => {
    if (!enabled()) return
    const payload = readPayload(data)
    if (!isPlayback(payload) || payload.slideId !== slideId()) return
    latest = payload
    apply()
  })

  // A new slide, or the preview element appearing, starts paused and asks the
  // projector where it is, so a preview opened mid-clip catches up.
  watch(
    [slideId, el] as const,
    ([id, media], previous) => {
      if (!enabled() || !id || !media) return
      if (previous?.[0] !== id) latest = null
      safePauseMedia(media)
      postCrossWindowNotification<MediaPlaybackRequestBroadcast>({
        kind: "media-playback-request",
        slideId: id,
      })
    },
    { immediate: true, flush: "post" }
  )

  onBeforeUnmount(() => {
    clearPendingSeek()
    stopListening()
  })
}
