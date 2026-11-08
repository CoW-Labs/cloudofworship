import type { Socket } from "socket.io-client"
import { shallowReactive, watch, type Ref } from "vue"
import type { CameraSlideData } from "~/types"
import useCameraStream, {
  cameraCaptureIsExclusive,
  type CameraHandle,
  type CameraSettingsInput,
} from "~/composables/useCameraStream"
import useCameraOnAir from "~/composables/useCameraOnAir"
import { useLocalOutputPresence } from "~/composables/useLiveOutputControl"
import {
  CAMERA_SHARE_ANNOUNCE_MS,
  CAMERA_SHARE_CONNECT_TIMEOUT_MS,
  CAMERA_SHARE_HOST_TIMEOUT_MS,
  CAMERA_SHARE_ICE_SERVERS,
  CAMERA_SHARE_MAX_VIEWERS,
  cameraShareEncoding,
  findCameraHost,
  type CameraHost,
  type CameraHostMatch,
  type RemoteCameraState,
} from "~/utils/cameraShare"

/**
 * Camera sharing between operator computers on the same schedule.
 *
 * Every operator window says which cameras are plugged into its computer
 * (`camera-share-announce`). A teammate's CameraFeed that cannot show a slide's
 * camera itself asks the computer that has it, and that computer sends the
 * camera straight to it over WebRTC. The socket only carries the handshake
 * (`camera-share-signal`, addressed to one socket by the API), so the video
 * never touches our servers.
 *
 * Both sides live at module scope, like useLiveOutputControl: `start()` runs
 * once per operator page (useOperatorSession), while every CameraFeed calls
 * `acquireRemote`. A viewer opens one connection per camera however many
 * feeds show it, and a computer serves at most CAMERA_SHARE_MAX_VIEWERS.
 *
 * The feed sent is the plain camera; the viewer draws mirror, fit and effects
 * itself, as it would for a camera of its own.
 */

type SignalType =
  | "request"
  | "offer"
  | "answer"
  | "ice"
  | "close"
  | "busy"
  | "paused"
  | "missing"

type Signal = {
  type: SignalType
  sessionId: string
  from: string
  fromName?: string
  sdp?: string
  candidate?: RTCIceCandidateInit
  deviceId?: string
  deviceLabel?: string
}

type Announcement = Omit<CameraHost, "seenAt"> & { wantReplies?: boolean }

export class RemoteCameraError extends Error {
  constructor(public state: RemoteCameraState) {
    super(`Teammate camera unavailable: ${state}`)
    this.name = "RemoteCameraError"
  }
}

export interface RemoteCameraHandle {
  stream: MediaStream
  userName: string
  /** Called once if the feed stops (the computer left, the network dropped). */
  onEnded: (callback: () => void) => void
  release: () => void
}

const hosts = shallowReactive(new Map<string, CameraHost>())

// The socket is provided by the first connection, which a page opened offline
// or with no schedule has not made yet, so it is looked up on every use.
let nuxtApp: ReturnType<typeof useNuxtApp> | null = null
const getSocket = () => (nuxtApp?.$socketio as Socket | undefined) ?? null
let started = false
let heartbeat: ReturnType<typeof setInterval> | null = null
let stopWatchers: Array<() => void> = []
let lastAnnouncedCameras = 0

// Read from setup context in start(); module code only reads the refs.
let outputPresent: Ref<boolean> | null = null
let cameraOnAir: Ref<boolean> | null = null

const selfId = () => getSocket()?.id || null

const send = (to: string, type: SignalType, sessionId: string, extra: object = {}) => {
  const socket = getSocket()
  if (!socket?.connected) return
  socket.emit("camera-share-signal", { to, type, sessionId, ...extra })
}

const canConnect = () => typeof RTCPeerConnection !== "undefined"

const newSessionId = () =>
  crypto.randomUUID?.() || `cam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const makePeer = (
  sessionId: string,
  to: string,
  onFailed: () => void
) => {
  const pc = new RTCPeerConnection({ iceServers: CAMERA_SHARE_ICE_SERVERS })
  pc.onicecandidate = (event) => {
    if (event.candidate) send(to, "ice", sessionId, { candidate: event.candidate.toJSON() })
  }
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") onFailed()
  }
  return pc
}

/** ICE that arrives before the other side's description waits for it. */
const addIce = (pc: RTCPeerConnection | null, queue: RTCIceCandidateInit[], candidate?: RTCIceCandidateInit) => {
  if (!candidate) return
  if (!pc || !pc.remoteDescription) {
    queue.push(candidate)
    return
  }
  pc.addIceCandidate(candidate).catch(() => {})
}

const flushIce = (pc: RTCPeerConnection, queue: RTCIceCandidateInit[]) => {
  queue.splice(0).forEach((candidate) => pc.addIceCandidate(candidate).catch(() => {}))
}

// ── Sending: this computer's cameras to teammates ──────────────────────────

type ServedSession = {
  viewer: string
  /** Which camera, so one viewer can take two (a pair of two cameras). */
  camera: string
  pc: RTCPeerConnection
  handle: CameraHandle
  ice: RTCIceCandidateInit[]
  connectTimer: ReturnType<typeof setTimeout> | null
}
const served = new Map<string, ServedSession>()

/**
 * Requests still opening the camera. They count towards the limit, and a
 * viewer that gives up meanwhile (it scrolled past the slide) marks its
 * ticket, so the camera is not left open for a connection nobody will answer.
 */
const pending = new Map<string, { viewer: string; cancelled: boolean }>()

/**
 * On engines where one page holds the camera at a time (Safari, the macOS
 * app), opening it here would black out the projector. While this computer
 * projects a camera, it stops sending.
 */
const isPaused = () =>
  cameraCaptureIsExclusive() && !!outputPresent?.value && !!cameraOnAir?.value

const endServed = (sessionId: string, notify: boolean) => {
  const session = served.get(sessionId)
  if (!session) return
  served.delete(sessionId)
  if (session.connectTimer) clearTimeout(session.connectTimer)
  if (notify) send(session.viewer, "close", sessionId)
  session.pc.onconnectionstatechange = null
  session.pc.close()
  session.handle.release()
}

const cancelPending = (match: (ticket: { viewer: string }, id: string) => boolean) => {
  pending.forEach((ticket, id) => {
    if (match(ticket, id)) ticket.cancelled = true
  })
}

/**
 * Caps what one viewer is sent. Engines that ignore `sendEncodings` have no
 * encoding to cap until the connection is negotiated, so this runs again then.
 */
const capSender = (sender: RTCRtpSender, encoding: RTCRtpEncodingParameters) => {
  const parameters = sender.getParameters()
  const current = parameters.encodings?.[0]
  if (!current || current.maxBitrate === encoding.maxBitrate) return
  Object.assign(current, encoding)
  sender.setParameters(parameters).catch(() => {})
}

const serve = async (signal: Signal) => {
  const { from, sessionId } = signal
  if (served.has(sessionId) || pending.has(sessionId)) return
  if (!canConnect()) return send(from, "missing", sessionId)
  const data: CameraSettingsInput = {
    deviceId: signal.deviceId || "",
    deviceLabel: signal.deviceLabel || "",
  }
  const camera = data.deviceId || data.deviceLabel
  // The same viewer asking for the same camera again replaces its old session.
  ;[...served].forEach(([id, session]) => {
    if (session.viewer === from && session.camera === camera) endServed(id, false)
  })
  if (isPaused()) return send(from, "paused", sessionId)
  if (served.size + pending.size >= CAMERA_SHARE_MAX_VIEWERS) {
    return send(from, "busy", sessionId)
  }

  const ticket = { viewer: from, cancelled: false }
  pending.set(sessionId, ticket)
  let handle: CameraHandle | null = null
  try {
    const { acquire, localCameraMatch } = useCameraStream()
    const local = await localCameraMatch(data)
    if (local !== "exact" && local !== "label") return send(from, "missing", sessionId)
    try {
      handle = await acquire(data, { assignedOnly: true })
    } catch {
      return send(from, "missing", sessionId)
    }
    if (ticket.cancelled) return
    if (isPaused()) return send(from, "paused", sessionId)
    const track = handle.stream.getVideoTracks()[0]
    if (!track) return send(from, "missing", sessionId)

    const pc = makePeer(sessionId, from, () => endServed(sessionId, false))
    const session: ServedSession = {
      viewer: from,
      camera,
      pc,
      handle,
      ice: [],
      // A viewer that never answers must not hold a place or the camera.
      connectTimer: setTimeout(() => {
        if (pc.connectionState !== "connected") endServed(sessionId, true)
      }, CAMERA_SHARE_CONNECT_TIMEOUT_MS + 5_000),
    }
    // The session owns the camera from here, and releases it when it ends.
    handle = null
    served.set(sessionId, session)
    session.handle.onEnded(() => endServed(sessionId, true))

    const encoding = cameraShareEncoding(track.getSettings().height)
    let sender: RTCRtpSender
    try {
      sender = pc.addTransceiver(track, {
        direction: "sendonly",
        streams: [session.handle.stream],
        sendEncodings: [encoding],
      }).sender
    } catch {
      sender = pc.addTrack(track, session.handle.stream)
    }
    capSender(sender, encoding)
    // Previews are about motion, not detail: keep the frame rate under load.
    if ("contentHint" in track) track.contentHint = "motion"

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    if (!served.has(sessionId)) return
    send(from, "offer", sessionId, { sdp: pc.localDescription?.sdp })
  } catch {
    if (served.has(sessionId)) endServed(sessionId, true)
    else send(from, "missing", sessionId)
  } finally {
    pending.delete(sessionId)
    handle?.release()
  }
}

const onServedSignal = (signal: Signal) => {
  const session = served.get(signal.sessionId)
  if (!session || session.viewer !== signal.from) return
  if (signal.type === "answer" && signal.sdp) {
    session.pc
      .setRemoteDescription({ type: "answer", sdp: signal.sdp })
      .then(() => {
        flushIce(session.pc, session.ice)
        const sender = session.pc.getSenders()[0]
        if (sender) capSender(sender, cameraShareEncoding(sender.track?.getSettings().height))
      })
      .catch(() => endServed(signal.sessionId, true))
  } else if (signal.type === "ice") {
    addIce(session.pc, session.ice, signal.candidate)
  } else if (signal.type === "close") {
    endServed(signal.sessionId, false)
  }
}

const pauseServing = () => {
  ;[...served.keys()].forEach((id) => {
    const session = served.get(id)
    if (session) send(session.viewer, "paused", id)
    endServed(id, false)
  })
}

const announce = async ({ wantReplies = false }: { wantReplies?: boolean } = {}) => {
  if (!getSocket()?.connected) return
  let cameras: { deviceId: string; label: string }[] = []
  try {
    // Never probe: listing must not open a camera or ask for permission.
    const listed = await useCameraStream().listCameras({ probe: false })
    cameras = listed.map((camera) => ({ deviceId: camera.deviceId, label: camera.label }))
  } catch {
    cameras = []
  }
  // An engine without WebRTC cannot send what it has.
  if (!canConnect()) cameras = []
  // A computer with no cameras has nothing to say, unless it is taking back
  // ones it announced before, or asking teammates to say theirs.
  if (!cameras.length && !lastAnnouncedCameras && !wantReplies) return
  lastAnnouncedCameras = cameras.length
  const socket = getSocket()
  if (!socket?.connected) return
  socket.emit("camera-share-announce", {
    cameras,
    paused: isPaused(),
    projecting: !!outputPresent?.value,
    wantReplies,
  })
}

// ── Viewing: a teammate's camera on this computer ──────────────────────────

type RemoteEntry = {
  key: string
  sessionId: string
  host: string
  userName: string
  pc: RTCPeerConnection | null
  ice: RTCIceCandidateInit[]
  stream: MediaStream | null
  promise: Promise<MediaStream>
  resolve: (stream: MediaStream) => void
  reject: (error: RemoteCameraError) => void
  settled: boolean
  refs: number
  timeout: ReturnType<typeof setTimeout> | null
  stopTimer: ReturnType<typeof setTimeout> | null
  endedCallbacks: Set<() => void>
}

const remotes = new Map<string, RemoteEntry>()
const remoteBySession = new Map<string, RemoteEntry>()

// Moving camera → lyrics → camera keeps the connection, as for a local camera.
const REMOTE_RELEASE_GRACE_MS = 8_000

const remoteKey = (host: string, camera: CameraHostMatch["camera"]) =>
  `${host}|${camera.deviceId || camera.label}`

const endRemote = (entry: RemoteEntry, { notify, error }: { notify: boolean; error?: RemoteCameraState }) => {
  if (remotes.get(entry.key) === entry) remotes.delete(entry.key)
  remoteBySession.delete(entry.sessionId)
  if (entry.timeout) clearTimeout(entry.timeout)
  if (entry.stopTimer) clearTimeout(entry.stopTimer)
  if (notify) send(entry.host, "close", entry.sessionId)
  if (entry.pc) {
    entry.pc.onconnectionstatechange = null
    entry.pc.close()
  }
  if (!entry.settled) {
    entry.settled = true
    entry.reject(new RemoteCameraError(error || "unreachable"))
  } else {
    const callbacks = [...entry.endedCallbacks]
    entry.endedCallbacks.clear()
    callbacks.forEach((callback) => callback())
  }
}

const settle = (entry: RemoteEntry) => {
  if (entry.settled || !entry.stream || entry.pc?.connectionState !== "connected") return
  entry.settled = true
  if (entry.timeout) clearTimeout(entry.timeout)
  entry.timeout = null
  entry.resolve(entry.stream)
}

const onOffer = async (entry: RemoteEntry, sdp: string) => {
  if (entry.pc) return
  const pc = makePeer(entry.sessionId, entry.host, () =>
    endRemote(entry, { notify: false })
  )
  entry.pc = pc
  pc.ontrack = (event) => {
    entry.stream = event.streams[0] || new MediaStream([event.track])
    settle(entry)
  }
  pc.addEventListener("connectionstatechange", () => settle(entry))
  try {
    await pc.setRemoteDescription({ type: "offer", sdp })
    flushIce(pc, entry.ice)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    send(entry.host, "answer", entry.sessionId, { sdp: pc.localDescription?.sdp })
  } catch {
    endRemote(entry, { notify: true })
  }
}

const onViewerSignal = (signal: Signal) => {
  const entry = remoteBySession.get(signal.sessionId)
  if (!entry || entry.host !== signal.from) return
  switch (signal.type) {
    case "offer":
      if (signal.sdp) onOffer(entry, signal.sdp)
      break
    case "ice":
      addIce(entry.pc, entry.ice, signal.candidate)
      break
    case "busy":
    case "paused":
    case "missing":
      endRemote(entry, { notify: false, error: signal.type })
      break
    case "close":
      endRemote(entry, { notify: false })
      break
  }
}

/**
 * Opens (or shares) a connection to a teammate's camera. Rejects with a
 * RemoteCameraError when it cannot be shown.
 */
const acquireRemote = async (found: CameraHostMatch): Promise<RemoteCameraHandle> => {
  if (!canConnect() || !getSocket()?.connected) throw new RemoteCameraError("unreachable")
  const key = remoteKey(found.host.socketId, found.camera)

  let entry = remotes.get(key)
  if (!entry) {
    let resolve!: (stream: MediaStream) => void
    let reject!: (error: RemoteCameraError) => void
    const promise = new Promise<MediaStream>((res, rej) => {
      resolve = res
      reject = rej
    })
    promise.catch(() => {})
    const created: RemoteEntry = {
      key,
      sessionId: newSessionId(),
      host: found.host.socketId,
      userName: found.host.userName,
      pc: null,
      ice: [],
      stream: null,
      promise,
      resolve,
      reject,
      settled: false,
      refs: 0,
      timeout: null,
      stopTimer: null,
      endedCallbacks: new Set(),
    }
    entry = created
    remotes.set(key, created)
    remoteBySession.set(created.sessionId, created)
    created.timeout = setTimeout(
      () => endRemote(created, { notify: true }),
      CAMERA_SHARE_CONNECT_TIMEOUT_MS
    )
    send(created.host, "request", created.sessionId, {
      deviceId: found.camera.deviceId,
      deviceLabel: found.camera.label,
    })
  }

  const current = entry
  current.refs += 1
  if (current.stopTimer) {
    clearTimeout(current.stopTimer)
    current.stopTimer = null
  }

  let released = false
  const callbacks = new Set<() => void>()
  const release = () => {
    if (released) return
    released = true
    callbacks.forEach((callback) => current.endedCallbacks.delete(callback))
    current.refs = Math.max(0, current.refs - 1)
    if (current.refs > 0 || remotes.get(current.key) !== current) return
    if (!current.settled) {
      endRemote(current, { notify: true })
      return
    }
    current.stopTimer = setTimeout(() => {
      if (current.refs === 0) endRemote(current, { notify: true })
    }, REMOTE_RELEASE_GRACE_MS)
  }

  let stream: MediaStream
  try {
    stream = await current.promise
  } catch (error) {
    release()
    throw error
  }
  return {
    stream,
    userName: current.userName,
    onEnded: (callback) => {
      if (released) return
      callbacks.add(callback)
      current.endedCallbacks.add(callback)
    },
    release,
  }
}

// ── Plumbing ───────────────────────────────────────────────────────────────

const hostLeft = (socketId: string) => {
  hosts.delete(socketId)
  ;[...remotes.values()]
    .filter((entry) => entry.host === socketId)
    .forEach((entry) => endRemote(entry, { notify: false }))
  ;[...served].forEach(([id, session]) => {
    if (session.viewer === socketId) endServed(id, false)
  })
  cancelPending((ticket) => ticket.viewer === socketId)
}

const sweepHosts = () => {
  const now = Date.now()
  ;[...hosts.values()].forEach((host) => {
    if (now - host.seenAt > CAMERA_SHARE_HOST_TIMEOUT_MS) hosts.delete(host.socketId)
  })
}

/** Routes this feature's socket events. True when the event was one of them. */
const handleMessage = (event: string, data: any): boolean => {
  if (event === "camera-share-announce") {
    const announcement = data as Announcement | undefined
    if (!announcement?.socketId || announcement.socketId === selfId()) return true
    hosts.set(announcement.socketId, {
      socketId: announcement.socketId,
      userId: announcement.userId,
      userName: announcement.userName,
      cameras: Array.isArray(announcement.cameras) ? announcement.cameras : [],
      paused: !!announcement.paused,
      projecting: !!announcement.projecting,
      seenAt: Date.now(),
    })
    if (announcement.wantReplies) announce()
    return true
  }
  if (event === "camera-share-left") {
    if (data?.socketId) hostLeft(data.socketId)
    return true
  }
  if (event === "camera-share-signal") {
    const signal = data as Signal | undefined
    if (!signal?.from || !signal.sessionId) return true
    if (signal.type === "request") serve(signal)
    else if (served.has(signal.sessionId)) onServedSignal(signal)
    else if (pending.has(signal.sessionId)) {
      if (signal.type === "close") {
        cancelPending((ticket, id) => id === signal.sessionId && ticket.viewer === signal.from)
      }
    }
    else onViewerSignal(signal)
    return true
  }
  return false
}

/** Every connection closed and every teammate forgotten (schedule change, stop). */
const reset = () => {
  ;[...served.keys()].forEach((id) => endServed(id, true))
  cancelPending(() => true)
  ;[...remotes.values()].forEach((entry) => endRemote(entry, { notify: true }))
  hosts.clear()
  lastAnnouncedCameras = 0
}

/** Once per operator page, from useOperatorSession's setup. */
const start = () => {
  if (started) return
  started = true
  nuxtApp = useNuxtApp()
  outputPresent = useLocalOutputPresence()
  cameraOnAir = useCameraOnAir()
  heartbeat = setInterval(() => {
    sweepHosts()
    announce()
  }, CAMERA_SHARE_ANNOUNCE_MS)
  const stopDevices = useCameraStream().onCameraDevicesChange(() => announce())
  const stopPause = watch(
    () => isPaused(),
    (paused) => {
      if (paused) pauseServing()
      announce()
    }
  )
  const stopProjecting = watch(() => outputPresent?.value, () => announce())
  stopWatchers = [stopDevices, stopPause, stopProjecting]
}

const stop = () => {
  if (!started) return
  started = false
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  stopWatchers.forEach((stopWatcher) => stopWatcher())
  stopWatchers = []
  reset()
}

/** On every connect: say ours and ask teammates for theirs. */
const onConnected = () => {
  // The old socket's sessions and teammates' old socket ids are gone.
  reset()
  announce({ wantReplies: true })
}

/** The teammate's computer showing this camera, if any (reactive). */
const hostFor = (data: Pick<CameraSlideData, "deviceId" | "deviceLabel"> | null | undefined) =>
  findCameraHost(hosts.values(), data, selfId())

const useCameraShare = () => ({
  hostFor,
  acquireRemote,
  handleMessage,
  onConnected,
  reset,
  start,
  stop,
})

export default useCameraShare
