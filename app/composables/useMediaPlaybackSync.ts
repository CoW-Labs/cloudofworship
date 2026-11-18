import type { Ref } from "vue"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"
import useBroadcastMessage, {
  broadcastNoticeKind,
} from "~/composables/useBroadcastMessage"
import { safePauseMedia, safePlayMedia } from "~/utils/browserSafety"
import {
  listenToExternalPlayer,
  rememberExternalDuration,
  type ExternalPlayerTime,
} from "~/utils/externalPlayerClock"

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
  /** Length in seconds, when known. YouTube and Vimeo report it this way. */
  duration?: number
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
 * Projector side, for a YouTube or Vimeo player: the same reports as a file
 * video sends, plus the length, read from the player over postMessage. Sent
 * when it starts, stops or jumps, and on the heartbeat while it plays, never on
 * each of the player's own frequent time updates.
 */
export const useReportExternalPlayback = (
  iframe: Ref<HTMLIFrameElement | null>,
  type: () => "youtube" | "vimeo" | undefined,
  slideId: () => string | undefined,
  enabled: () => boolean
) => {
  let player: ReturnType<typeof listenToExternalPlayer> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let last: ExternalPlayerTime | null = null
  let sent: MediaPlaybackBroadcast | null = null

  const report = () => {
    const id = slideId()
    if (!id || !last || last.time === null || !enabled()) return
    sent = {
      kind: "media-playback",
      slideId: id,
      playing: last.playing,
      time: last.time,
      at: last.at,
      rate: 1,
      ...(last.duration ? { duration: last.duration } : {}),
    }
    postCrossWindowNotification<MediaPlaybackBroadcast>(sent)
  }

  const syncHeartbeat = () => {
    const playing = !!last?.playing
    if (playing && !heartbeat) heartbeat = setInterval(report, HEARTBEAT_MS)
    if (!playing && heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }

  const onChange = (state: ExternalPlayerTime) => {
    last = state
    const expected = sent
      ? sent.time + (sent.playing ? (state.at - sent.at) / 1000 : 0)
      : null
    const jumped =
      expected === null || state.time === null || Math.abs(state.time - expected) > 1.5
    if (
      !sent ||
      sent.playing !== state.playing ||
      (state.duration && sent.duration !== state.duration) ||
      jumped
    )
      report()
    syncHeartbeat()
  }

  const stop = () => {
    player?.stop()
    player = null
    last = sent = null
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
  }

  watch(
    () => [iframe.value, type(), enabled()] as const,
    ([el, kind, on]) => {
      stop()
      if (el && kind && on) player = listenToExternalPlayer(el, kind, onChange)
    },
    { immediate: true }
  )

  const stopListening = useBroadcastMessage((data) => {
    if (!enabled()) return
    const payload = readPayload(data)
    if (isPlaybackRequest(payload) && payload.slideId === slideId()) {
      player?.refresh()
      report()
    }
  })

  onBeforeUnmount(() => {
    stop()
    stopListening()
  })
}

/** Operator side: ask the projector to report `slideId` now. */
export const requestProjectorPlayback = (slideId: string) =>
  postCrossWindowNotification<MediaPlaybackRequestBroadcast>({
    kind: "media-playback-request",
    slideId,
  })

// The projector's last report for each slide, so the seek track can say where
// a file with no element in this window (audio) has got to.
const lastReports = new Map<string, MediaPlaybackBroadcast>()

/**
 * Where the projector's copy of `slideId` is now, in seconds: its last report,
 * moved on by the time since if it was playing. Null before it has reported.
 */
export const projectorPosition = (slideId?: string): number | null => {
  const report = slideId ? lastReports.get(slideId) : undefined
  if (!report) return null
  const elapsed = report.playing ? ((Date.now() - report.at) / 1000) * report.rate : 0
  return Math.max(0, report.time + elapsed)
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
    // One entry per slide played; a long service plays many, so keep the
    // newest few.
    lastReports.delete(payload.slideId)
    lastReports.set(payload.slideId, payload)
    if (payload.duration) rememberExternalDuration(payload.slideId, payload.duration)
    if (lastReports.size > 32) lastReports.delete(lastReports.keys().next().value!)
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

/**
 * What the Live Output preview's own video is doing. The preview plays by
 * itself (see useFollowMediaPlayback), so with no projector reporting, the
 * play/pause control reads this instead of a stored value that only holds the
 * last button press. Module-level: the preview and the editor toolbar live in
 * the same window.
 */
const previewPlayback = reactive<{ slideId: string | null; playing: boolean }>({
  slideId: null,
  playing: false,
})

/** Whether the Live Output preview is playing `slideId`'s video, or null. */
export const useLiveOutputPreviewPlaying = (slideId: () => string | undefined) =>
  computed(() => {
    const id = slideId()
    return id && previewPlayback.slideId === id ? previewPlayback.playing : null
  })

const PREVIEW_EVENTS = ["playing", "pause", "ended"] as const

/**
 * Preview side: `el` plays by itself, muted, like the projector's video does,
 * so the Live Output moves with no projector window open. When the projector
 * does report, `el` is corrected to match it: where it is, whether it is
 * playing, and its speed.
 */
export const useFollowMediaPlayback = (
  el: Ref<HTMLMediaElement | null>,
  slideId: () => string | undefined,
  enabled: () => boolean
) => {
  let latest: MediaPlaybackBroadcast | null = null

  const publish = () => {
    const media = el.value
    const id = slideId()
    if (!media || !id || !enabled()) return
    previewPlayback.slideId = id
    previewPlayback.playing = !media.paused && !media.ended
  }
  watch(
    el,
    (current, previous) => {
      PREVIEW_EVENTS.forEach((name) => previous?.removeEventListener(name, publish))
      PREVIEW_EVENTS.forEach((name) => current?.addEventListener(name, publish))
      if (!current && previewPlayback.slideId === slideId()) {
        previewPlayback.slideId = null
      }
    },
    { immediate: true }
  )
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

  // A new slide, or the preview element appearing, asks the projector where it
  // is, so a preview opened mid-clip catches up. The preview keeps playing on
  // its own until the projector answers.
  watch(
    [slideId, el] as const,
    ([id, media], previous) => {
      if (!enabled() || !id || !media) return
      if (previous?.[0] !== id) latest = null
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
    PREVIEW_EVENTS.forEach((name) => el.value?.removeEventListener(name, publish))
    if (previewPlayback.slideId === slideId()) previewPlayback.slideId = null
  })
}
