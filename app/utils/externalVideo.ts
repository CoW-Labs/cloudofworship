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

// The address the desktop app's own pages come from (tauri://localhost) is not
// one YouTube accepts as an embedder: the player answers "Error 153, video
// player configuration error". So YouTube is shown through a small relay page
// on a real web address (public/embed/youtube.html) that hosts the player and
// passes messages both ways. A browser, or a dev server, already has a web
// address and uses its own copy of the page.
const WEB_APP_ORIGIN = "https://app.cloudofworship.com"
const embedHost = (origin: string) => {
  try {
    const { protocol, hostname } = new URL(origin)
    // Windows serves the desktop app from http://tauri.localhost: still not an
    // address YouTube accepts.
    const isWeb = (protocol === "https:" || protocol === "http:") && hostname !== "tauri.localhost"
    return isWeb ? origin : WEB_APP_ORIGIN
  } catch {
    return WEB_APP_ORIGIN
  }
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
    const loopParam = loop ? "&loop=1" : ""
    return `${embedHost(origin)}/embed/youtube.html?v=${encodeURIComponent(videoId)}${muteParam}${loopParam}`
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

/**
 * The payload "new-media" takes for a saved media slide. YouTube and Vimeo
 * slides keep their link in `data.url`; `background` is only a placeholder
 * image, so it must not replace the link, and the slide has to be flagged
 * external so no upload is attempted.
 */
export const savedMediaPayload = (slide: {
  data?: unknown
  background?: string
}) =>
  isExternalVideoData(slide.data)
    ? { ...slide.data, isExternal: true }
    : { ...(slide.data as object), url: slide.background }
