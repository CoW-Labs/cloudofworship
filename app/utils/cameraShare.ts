import type { CameraSlideData } from "~/types"

/**
 * Camera sharing: a camera slide shown on a teammate's computer when the
 * camera is plugged into another one. Video goes straight between the two
 * computers over WebRTC; the API's socket only passes the handshake along.
 * The pure rules live here; the connections live in useCameraShare.
 */

/**
 * STUN only tells a computer its public address, so two computers on
 * different networks can reach each other. It never carries video. There is
 * no TURN relay yet: the few networks that block a direct connection see a
 * "can't connect" message instead.
 */
export const CAMERA_SHARE_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
]

/** One computer sends a camera to at most this many others. */
export const CAMERA_SHARE_MAX_VIEWERS = 3

/** Previews only: about 540p at 15fps, under 1 Mbps. */
export const CAMERA_SHARE_HEIGHT = 540
export const CAMERA_SHARE_MAX_FPS = 15
export const CAMERA_SHARE_MAX_BITRATE = 900_000

export const CAMERA_SHARE_ANNOUNCE_MS = 15_000
/** A computer heard from this recently is still announcing (one beat and a half). */
export const CAMERA_SHARE_FRESH_MS = CAMERA_SHARE_ANNOUNCE_MS * 1.5
/** A computer unheard from for this long is gone (two missed beats). */
export const CAMERA_SHARE_HOST_TIMEOUT_MS = 40_000
/** How long a viewer waits for video before saying it can't connect. */
export const CAMERA_SHARE_CONNECT_TIMEOUT_MS = 15_000

export type SharedCamera = { deviceId: string; label: string }

/** A teammate's computer and the cameras plugged into it. */
export type CameraHost = {
  socketId: string
  userId: string
  userName: string
  cameras: SharedCamera[]
  /** Not sending right now (see useCameraShare's `isPaused`). */
  paused: boolean
  /** Has the live window open, so its camera is what the congregation sees. */
  projecting: boolean
  /** Its latest announcement. */
  seenAt: number
  /** Its first announcement on this socket; keeps the choice of computer steady. */
  firstSeenAt: number
}

export type CameraHostMatch = {
  host: CameraHost
  /** `exact` is the computer the slide was made on; `label` a same-named camera. */
  match: "exact" | "label"
  camera: SharedCamera
}

/**
 * The teammate's computer that has the slide's camera. The slide's device id
 * only exists on the computer it was made on, so an id match is that computer.
 * Names repeat ("FaceTime HD Camera" is on every MacBook), so among name
 * matches the computer with the live window wins.
 *
 * The choice must not move while nothing changes: every announcement updates
 * `seenAt`, so ranking by it would hop between two computers that both have
 * the camera (two operator tabs on one computer) every few seconds, opening a
 * new connection each time. Computers still announcing come first, then the
 * one heard from earliest. A computer that reconnected leaves its old socket
 * behind, which stops announcing and so drops back.
 */
export const findCameraHost = (
  hosts: Iterable<CameraHost>,
  data: Pick<CameraSlideData, "deviceId" | "deviceLabel"> | null | undefined,
  selfSocketId?: string | null,
  now = Date.now()
): CameraHostMatch | null => {
  if (!data) return null
  const fresh = (host: CameraHost) => now - host.seenAt <= CAMERA_SHARE_FRESH_MS
  const steady = (a: CameraHost, b: CameraHost) =>
    Number(fresh(b)) - Number(fresh(a)) ||
    a.firstSeenAt - b.firstSeenAt ||
    a.socketId.localeCompare(b.socketId)
  const others = [...hosts]
    .filter((host) => host.socketId !== selfSocketId && host.cameras.length)
    .sort(steady)
  if (data.deviceId) {
    for (const host of others) {
      const camera = host.cameras.find((c) => c.deviceId === data.deviceId)
      if (camera) return { host, match: "exact", camera }
    }
  }
  const label = data.deviceLabel?.trim()
  if (!label) return null
  const named = others
    .map((host) => ({
      host,
      camera: host.cameras.find((c) => c.label.trim() === label),
    }))
    .filter((entry): entry is { host: CameraHost; camera: SharedCamera } => !!entry.camera)
    .sort(
      (a, b) =>
        Number(b.host.projecting) - Number(a.host.projecting) || steady(a.host, b.host)
    )
  const best = named[0]
  return best ? { host: best.host, match: "label", camera: best.camera } : null
}

/**
 * How the slide's camera shows up on this computer, read without opening any
 * camera. `unknown` is a list without names: no camera permission yet.
 */
export type LocalCameraMatch = "exact" | "label" | "none" | "unknown"

/**
 * Whether to show this computer's own camera or a teammate's. This computer's
 * own copy of the camera wins; a teammate's beats a same-named camera here
 * only when it is the computer the slide was made on. Without camera
 * permission here, a teammate's feed is used rather than asking for it.
 */
export const chooseCameraSource = (
  local: LocalCameraMatch,
  remote: CameraHostMatch | null
): "local" | "remote" => {
  if (!remote) return "local"
  if (local === "exact") return "local"
  if (local === "label") return remote.match === "exact" ? "remote" : "local"
  return "remote"
}

/** Why a teammate's camera is not showing. */
export type RemoteCameraState =
  | "busy"
  | "paused"
  | "missing"
  | "unreachable"
  | "offline"
  | "teams"

export const remoteCameraMessage = (state: RemoteCameraState, userName?: string) => {
  const who = userName ? `${userName}'s computer` : "the camera's computer"
  switch (state) {
    case "busy":
      return `Camera is already showing on ${CAMERA_SHARE_MAX_VIEWERS} computers`
    case "paused":
      return "Preview paused while the camera is on the projector"
    case "missing":
      return userName ? `Camera not found on ${who}` : "Camera not found"
    case "offline":
      return `${userName ? who : "The camera's computer"} is offline`
    case "teams":
      return "Seeing a teammate's camera is a Teams feature"
    default:
      return `Can't connect to ${who} from this network`
  }
}

/** The encoder settings for one shared feed: scaled down, capped. */
export const cameraShareEncoding = (sourceHeight?: number): RTCRtpEncodingParameters => ({
  maxBitrate: CAMERA_SHARE_MAX_BITRATE,
  maxFramerate: CAMERA_SHARE_MAX_FPS,
  scaleResolutionDownBy: Math.max(1, (sourceHeight || 1080) / CAMERA_SHARE_HEIGHT),
})

/** Where the sender's bandwidth estimate starts, in kbps: close to the cap. */
export const CAMERA_SHARE_START_KBPS = 800

/**
 * Starts the bandwidth estimate near the cap. WebRTC otherwise starts low and
 * ramps up over about 15 seconds, so a teammate opening a camera slide saw it
 * at 320x180 for that long. Chromium reads `x-google-start-bitrate` from the
 * description the sender applies; other engines ignore it.
 */
export const withStartBitrate = (sdp: string, kbps = CAMERA_SHARE_START_KBPS) => {
  const lines = sdp.split("\r\n")
  let inVideo = false
  const videoPayloads = new Set<string>()
  lines.forEach((line) => {
    if (line.startsWith("m=")) inVideo = line.startsWith("m=video")
    const rtpmap = inVideo && /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(line)
    if (rtpmap) videoPayloads.add(rtpmap[1]!)
  })
  const param = `x-google-start-bitrate=${kbps}`
  const withFmtp = new Set<string>()
  const out = lines.map((line) => {
    const fmtp = /^a=fmtp:(\d+) (.*)$/.exec(line)
    if (!fmtp || !videoPayloads.has(fmtp[1]!)) return line
    withFmtp.add(fmtp[1]!)
    return fmtp[2]!.includes("x-google-start-bitrate") ? line : `${line};${param}`
  })
  // A codec with no parameters (VP8 usually) gets an fmtp line of its own.
  return out
    .flatMap((line) => {
      const rtpmap = /^a=rtpmap:(\d+) /.exec(line)
      const pt = rtpmap?.[1]
      return pt && videoPayloads.has(pt) && !withFmtp.has(pt)
        ? [line, `a=fmtp:${pt} ${param}`]
        : [line]
    })
    .join("\r\n")
}
