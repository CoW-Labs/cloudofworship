import type { ExternalVideo } from "~/types"

/**
 * YouTube and Vimeo links: the embed address and the commands their players
 * take over postMessage. Shared by the projector (LiveProjectionOnly) and the
 * editor's preview so both build the same player the same way.
 */

export type ExternalPlayerCommand =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "seek"; seconds: number }
  | { kind: "mute"; muted: boolean }

export const isExternalVideoData = (
  data: unknown
): data is ExternalVideo => {
  const type = (data as ExternalVideo | undefined)?.type
  return type === "youtube" || type === "vimeo"
}

const youtubeId = (url: string) => {
  if (url.includes("youtu.be")) return url.split("youtu.be/")[1]?.split("?")[0] || ""
  if (url.includes("/shorts/")) return url.split("/shorts/")[1]?.split("?")[0] || ""
  return url.split("v=")[1]?.split("&")[0] || ""
}

/** The player's address. Sound changes go through `externalPlayerMessage`. */
export const externalEmbedUrl = (
  data: ExternalVideo,
  options: { muted: boolean; loop: boolean; origin: string }
): string => {
  const { muted, loop, origin } = options
  if (data.type === "youtube") {
    const videoId = youtubeId(data.url)
    const muteParam = muted ? "&mute=1" : "&mute=0"
    const loopParam = loop ? `&loop=1&playlist=${videoId}` : ""
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&enablejsapi=1&origin=${origin}${muteParam}${loopParam}`
  }
  if (data.type === "vimeo") {
    const videoId = data.url.split("vimeo.com/")[1]?.split("?")[0] || ""
    const muteParam = muted ? "&muted=1" : "&muted=0"
    const loopParam = loop ? "&loop=1" : ""
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&api=1${muteParam}${loopParam}`
  }
  return ""
}

/** The postMessage payload for a command, in the player's own dialect. */
export const externalPlayerMessage = (
  type: "youtube" | "vimeo",
  command: ExternalPlayerCommand
): string => {
  if (type === "youtube") {
    const youtube = (func: string, args: unknown[] = []) =>
      JSON.stringify({ event: "command", func, args })
    switch (command.kind) {
      case "play":
        return youtube("playVideo")
      case "pause":
        return youtube("pauseVideo")
      case "seek":
        return youtube("seekTo", [command.seconds, true])
      case "mute":
        return youtube(command.muted ? "mute" : "unMute")
    }
  }
  switch (command.kind) {
    case "play":
      return JSON.stringify({ method: "play" })
    case "pause":
      return JSON.stringify({ method: "pause" })
    case "seek":
      return JSON.stringify({ method: "setCurrentTime", value: command.seconds })
    case "mute":
      return JSON.stringify({ method: "setVolume", value: command.muted ? 0 : 1 })
  }
}
