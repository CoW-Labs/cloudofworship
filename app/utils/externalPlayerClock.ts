import { safePostMessage } from "~/utils/browserSafety"

/**
 * Reads a YouTube or Vimeo player's length and position over postMessage, so
 * the seek track can draw a bar for them as it does for a file.
 *
 * Neither player says anything until asked. YouTube starts sending
 * `infoDelivery` (position, length, state) once it hears `listening`; Vimeo
 * sends `timeupdate` once a listener is added, and answers `getDuration`.
 * Both are asked again a few times, because a message sent before the player
 * has loaded is dropped. Only messages from this iframe's own window count.
 */

export type ExternalPlayerTime = {
  /** Seconds, or null before the player has said. */
  time: number | null
  duration: number | null
  playing: boolean
  /** Wall-clock ms when `time` was read. */
  at: number
}

const parse = (data: unknown) => {
  if (typeof data !== "string") return data as Record<string, any> | null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null

export const listenToExternalPlayer = (
  iframe: HTMLIFrameElement,
  type: "youtube" | "vimeo",
  onChange: (state: ExternalPlayerTime) => void
) => {
  const state: ExternalPlayerTime = {
    time: null,
    duration: null,
    playing: false,
    at: Date.now(),
  }
  let heard = false

  const hello = () => {
    const target = iframe.contentWindow
    if (type === "youtube") {
      safePostMessage(target, JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")
      return
    }
    for (const value of ["timeupdate", "play", "pause", "ended", "seeked"])
      safePostMessage(target, JSON.stringify({ method: "addEventListener", value }), "*")
    safePostMessage(target, JSON.stringify({ method: "getDuration" }), "*")
    safePostMessage(target, JSON.stringify({ method: "getCurrentTime" }), "*")
    safePostMessage(target, JSON.stringify({ method: "getPaused" }), "*")
  }

  const update = (patch: Partial<ExternalPlayerTime>) => {
    let changed = false
    for (const key of Object.keys(patch) as (keyof ExternalPlayerTime)[]) {
      const value = patch[key]
      if (value === undefined || value === null || state[key] === value) continue
      ;(state as any)[key] = value
      changed = true
    }
    if (patch.time != null) state.at = Date.now()
    if (changed) onChange({ ...state })
  }

  const onMessage = (event: MessageEvent) => {
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return
    const msg = parse(event.data)
    if (!msg) return
    heard = true
    if (type === "youtube") {
      const info = msg.info
      if (!info || typeof info !== "object") return
      update({
        time: finite(info.currentTime),
        duration: finite(info.duration) || null,
        // 1 playing, 3 buffering counts as moving on; 2 paused, 0 ended.
        playing:
          typeof info.playerState === "number"
            ? info.playerState === 1
            : undefined,
      })
      return
    }
    if (msg.event === "timeupdate" && msg.data) {
      update({
        time: finite(msg.data.seconds),
        duration: finite(msg.data.duration) || null,
        playing: true,
      })
    } else if (msg.event === "play") update({ playing: true })
    else if (msg.event === "pause" || msg.event === "ended")
      update({ playing: false })
    else if (msg.method === "getDuration") update({ duration: finite(msg.value) || null })
    else if (msg.method === "getCurrentTime") update({ time: finite(msg.value) })
    else if (msg.method === "getPaused" && typeof msg.value === "boolean")
      update({ playing: !msg.value })
  }

  window.addEventListener("message", onMessage)
  iframe.addEventListener("load", hello)
  hello()
  // Asked again until the player answers, for at most ten seconds.
  let tries = 0
  const retry = setInterval(() => {
    if (heard || ++tries > 10) clearInterval(retry)
    else hello()
  }, 1000)

  return {
    /** Vimeo only answers position on request between its timeupdates. */
    refresh: () => {
      if (type === "vimeo") hello()
    },
    stop: () => {
      clearInterval(retry)
      window.removeEventListener("message", onMessage)
      iframe.removeEventListener("load", hello)
    },
  }
}

// Each slide's last known length, so the bar can show before a player has
// loaded again (a closed preview, a slide that went off and back on). Small
// and capped; lengths never change.
const durations = new Map<string, number>()

export const rememberExternalDuration = (slideId: string, seconds: number) => {
  if (!(seconds > 0)) return
  durations.delete(slideId)
  durations.set(slideId, seconds)
  if (durations.size > 64) durations.delete(durations.keys().next().value!)
}

export const knownExternalDuration = (slideId?: string) =>
  (slideId && durations.get(slideId)) || 0
