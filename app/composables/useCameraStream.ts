import type { CameraSlideData } from "~/types"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"

/**
 * Camera streams for camera slides.
 *
 * A stream is a live device handle, so it never goes near Pinia, localStorage
 * or the BroadcastChannel: each window opens its own, and only the slide's
 * settings travel. Within a window, every caller showing the same camera
 * shares one stream from the cache below. The last caller to
 * let go does not stop it at once: it stays open for a grace period, so moving
 * camera → lyrics → camera in a service never cold-starts the device (which
 * takes 0.5–2s and flashes black on the projector).
 *
 * The grace period is also the most the camera light stays on after the
 * camera leaves the screen, so OBS or Zoom can take the device back.
 */

/**
 * Where a feed is shown. Only changes what is drawn over it (the operator's
 * preview explains failures, the projector stays black); every window opens
 * the camera in the same format, see CAPTURE_CONSTRAINTS.
 */
export type CameraQuality = "output" | "preview"

/**
 * How big a feed is drawn. `inset` is a small card (a slide pair's picture in
 * picture), which 720p covers; everything else wants the full 1080p.
 */
export type CameraResolution = "full" | "inset"

export type CameraErrorState =
  | "denied"
  | "in-use"
  | "missing"
  | "unsupported"
  | "error"

/** How the slide's camera was found on this machine. */
export type CameraDeviceMatch = "exact" | "label" | "fallback"

export type CameraSettingsInput = Pick<
  CameraSlideData,
  "deviceId" | "deviceLabel"
>

export interface CameraHandle {
  stream: MediaStream
  deviceId: string
  deviceLabel: string
  match: CameraDeviceMatch
  /** Called once if the camera goes away (unplugged, the OS took it). */
  onEnded: (callback: () => void) => void
  /**
   * Idempotent. Stops the stream after the grace period if nobody else uses
   * it, or straight away with `immediate` (the camera picker: an operator
   * clicking through cameras must not leave each one running).
   */
  release: (options?: { immediate?: boolean }) => void
  /**
   * What this holder needs. The shared stream runs at the most any holder
   * needs, changed in place (no reopen, no black frame on the projector).
   */
  setResolution: (resolution: CameraResolution) => void
}

export class CameraStreamError extends Error {
  constructor(public state: CameraErrorState, cause?: unknown) {
    super(`Camera unavailable: ${state}`)
    this.name = "CameraStreamError"
    if (cause) (this as any).cause = cause
  }
}

export const CAMERA_RELEASE_GRACE_MS = 20_000

// How long the stream opened to read camera names stays available for the
// preview that usually follows it.
const PROBE_REUSE_MS = 3_000

/**
 * One format for every window. A camera runs in one format at a time, and the
 * browser gives later windows whatever the first one asked for: when the
 * operator's preview used to open first at 640x360, the projector got 640x480
 * for the whole service. Measured, a small preview fed this format costs the
 * operator next to nothing more than a 360p one.
 *
 * Frame rate is capped at 30: capture cards often default to 60, which doubles
 * the drawing and NDI work for no visible gain on a projector.
 */
const CAPTURE_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
}

const RESOLUTION_SIZE: Record<CameraResolution, MediaTrackConstraints> = {
  full: { width: { ideal: 1920 }, height: { ideal: 1080 } },
  inset: { width: { ideal: 1280 }, height: { ideal: 720 } },
}

interface CacheEntry {
  key: string
  deviceId: string
  deviceLabel: string
  promise: Promise<MediaStream>
  stream: MediaStream | null
  refs: number
  stopTimer: ReturnType<typeof setTimeout> | null
  endedCallbacks: Set<() => void>
  /** Each holder's need; the stream runs at the largest. */
  needs: Map<symbol, CameraResolution>
  resolution: CameraResolution
}

/** Runs the stream at the most any holder needs. Best effort. */
const applyResolution = (entry: CacheEntry) => {
  const wanted: CameraResolution = [...entry.needs.values()].some(
    (need) => need === "full"
  )
    ? "full"
    : entry.needs.size
    ? "inset"
    : entry.resolution
  if (wanted === entry.resolution) return
  entry.resolution = wanted
  const track = entry.stream?.getVideoTracks()[0]
  if (!track?.applyConstraints) return
  track
    .applyConstraints({ ...track.getConstraints(), ...RESOLUTION_SIZE[wanted] })
    .catch(() => {
      // A camera that cannot switch keeps the size it has.
    })
}

const cache = new Map<string, CacheEntry>()

export const cameraErrorState = (error: unknown): CameraErrorState => {
  if (error instanceof CameraStreamError) return error.state
  switch ((error as DOMException | undefined)?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied"
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in-use"
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "missing"
    default:
      return "error"
  }
}

export const cameraErrorMessage = (state: CameraErrorState) => {
  switch (state) {
    case "denied":
      return "Camera permission denied"
    case "in-use":
      return "Camera is in use by another app"
    case "missing":
      return "Camera not found"
    case "unsupported":
      return "Cameras are not supported here"
    default:
      return "Camera unavailable"
  }
}

const mediaDevices = () =>
  typeof navigator === "undefined" ? undefined : navigator.mediaDevices

const stopStream = (stream: MediaStream | null | undefined) => {
  stream?.getTracks().forEach((track) => {
    track.onended = null
    track.stop()
  })
}

const evict = (entry: CacheEntry) => {
  if (cache.get(entry.key) === entry) cache.delete(entry.key)
  if (entry.stopTimer) clearTimeout(entry.stopTimer)
  entry.stopTimer = null
  if (entry.stream) stopStream(entry.stream)
  else entry.promise.then(stopStream).catch(() => {})
}

const scheduleStop = (entry: CacheEntry, delayMs: number) => {
  if (entry.stopTimer) clearTimeout(entry.stopTimer)
  entry.stopTimer = setTimeout(() => {
    entry.stopTimer = null
    if (entry.refs === 0) evict(entry)
  }, delayMs)
}

// Unplugged, the laptop slept, or the OS handed the device to someone else.
// The stream is dead either way: drop it so the next acquire opens a fresh
// one, and tell whoever is showing it.
const watchEnded = (entry: CacheEntry, stream: MediaStream) => {
  stream.getVideoTracks().forEach((track) => {
    track.onended = () => {
      evict(entry)
      const callbacks = [...entry.endedCallbacks]
      entry.endedCallbacks.clear()
      callbacks.forEach((callback) => callback())
    }
  })
}

const cacheKey = (deviceId: string) => deviceId || "default"

/**
 * Safari's engine, which the macOS desktop app also runs on, lets one page use
 * the camera at a time: a second page opening it mutes the first. Chromium
 * (Chrome, Edge, the Windows desktop app) shares the camera between pages.
 */
export const cameraCaptureIsExclusive = () => {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR/.test(ua)
}

const enumerateCameras = async () => {
  const devices = mediaDevices()
  if (!devices?.enumerateDevices) throw new CameraStreamError("unsupported")
  const all = await devices.enumerateDevices()
  return all.filter((device) => device.kind === "videoinput")
}

/**
 * Keeps a stream that was opened for another reason (reading camera names) in
 * the cache for a short while, so a preview of that camera right after reuses
 * it instead of starting the camera a second time.
 */
const adoptStream = (stream: MediaStream, keepMs: number) => {
  const track = stream.getVideoTracks()[0]
  const deviceId = track?.getSettings().deviceId || ""
  const key = cacheKey(deviceId)
  if (!track || cache.has(key)) {
    stopStream(stream)
    return
  }
  const entry: CacheEntry = {
    key,
    deviceId,
    deviceLabel: track.label,
    promise: Promise.resolve(stream),
    stream,
    refs: 0,
    stopTimer: null,
    endedCallbacks: new Set(),
    needs: new Map(),
    resolution: "full",
  }
  cache.set(key, entry)
  watchEnded(entry, stream)
  scheduleStop(entry, keepMs)
}

/**
 * Every camera on this machine, with labels. Browsers hide labels (and often
 * the devices themselves) until the page has camera permission, so by default
 * the first call opens the camera once to be granted, then lists again. Pass
 * `probe: false` where opening the camera would do harm (see
 * cameraCaptureIsExclusive); the list may then be empty or unnamed.
 */
const listCameras = async ({
  probe = true,
}: { probe?: boolean } = {}): Promise<MediaDeviceInfo[]> => {
  let cameras = await enumerateCameras()
  const hidden = !cameras.length || cameras.every((camera) => !camera.label)
  if (hidden && probe) {
    try {
      const stream = await openStream("")
      adoptStream(stream, PROBE_REUSE_MS)
    } catch (error) {
      const state = cameraErrorState(error)
      if (state === "missing") return []
      throw new CameraStreamError(state, error)
    }
    cameras = await enumerateCameras()
  }
  return cameras.filter((camera) => !!camera.deviceId && !!camera.label)
}

/**
 * Finds the slide's camera on this machine. Device IDs differ per origin, per
 * browser profile and between the web app and the desktop app, so a slide made
 * elsewhere usually only matches by label. Failing both, the first camera is
 * better on screen than nothing; the operator is told it is a different one.
 */
const resolveDevice = async (
  data: CameraSettingsInput
): Promise<{ deviceId: string; deviceLabel: string; match: CameraDeviceMatch }> => {
  const cameras = await enumerateCameras()
  // Without permission the list is anonymous. Ask for the stored id (or any
  // camera) and let getUserMedia settle it.
  if (cameras.every((camera) => !camera.deviceId)) {
    return {
      deviceId: data.deviceId || "",
      deviceLabel: data.deviceLabel || "",
      match: data.deviceId ? "exact" : "fallback",
    }
  }
  const usable = cameras.filter((camera) => !!camera.deviceId)
  const exact = data.deviceId
    ? usable.find((camera) => camera.deviceId === data.deviceId)
    : undefined
  if (exact) {
    return { deviceId: exact.deviceId, deviceLabel: exact.label, match: "exact" }
  }
  const label = data.deviceLabel?.trim()
  const byLabel = label
    ? usable.find((camera) => camera.label.trim() === label)
    : undefined
  if (byLabel) {
    return {
      deviceId: byLabel.deviceId,
      deviceLabel: byLabel.label,
      match: "label",
    }
  }
  const first = usable[0]
  if (!first) throw new CameraStreamError("missing")
  return {
    deviceId: first.deviceId,
    deviceLabel: first.label,
    // A slide with no camera chosen yet asked for "any camera".
    match: data.deviceId || label ? "fallback" : "exact",
  }
}

const openStream = async (deviceId: string) => {
  const video = (frameRate: MediaTrackConstraints["frameRate"]) => ({
    ...CAPTURE_CONSTRAINTS,
    frameRate,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  })
  // Never audio: a camera's microphone would loop through the PA.
  try {
    return await mediaDevices()!.getUserMedia({
      audio: false,
      video: video(CAPTURE_CONSTRAINTS.frameRate),
    })
  } catch (error) {
    // Chromium drops frames to meet a frame-rate cap; Safari may refuse a
    // camera that only runs faster. Better uncapped than black.
    if ((error as DOMException)?.name !== "OverconstrainedError") throw error
    return mediaDevices()!.getUserMedia({
      audio: false,
      video: video({ ideal: 30 }),
    })
  }
}

/**
 * `assignedOnly` refuses a stand-in: the slide's own camera or nothing. The
 * editor's preview uses it, so a teammate editing on their own computer never
 * sees their webcam passed off as the church's camera.
 */
const acquire = async (
  data: CameraSettingsInput,
  { assignedOnly = false }: { assignedOnly?: boolean } = {}
): Promise<CameraHandle> => {
  if (!mediaDevices()?.getUserMedia) throw new CameraStreamError("unsupported")

  const resolved = await resolveDevice(data)
  if (assignedOnly && resolved.match === "fallback") {
    throw new CameraStreamError("missing")
  }
  const key = cacheKey(resolved.deviceId)

  let entry = cache.get(key)
  // On a one-camera-page engine, another page opening the camera mutes this
  // page's stream for good. Reusing it would show black, so open a new one,
  // which takes the camera back.
  if (
    entry &&
    entry.refs === 0 &&
    entry.stream?.getVideoTracks()[0]?.muted &&
    cameraCaptureIsExclusive()
  ) {
    evict(entry)
    entry = undefined
  }
  if (!entry) {
    const created: CacheEntry = {
      key,
      deviceId: resolved.deviceId,
      deviceLabel: resolved.deviceLabel,
      promise: openStream(resolved.deviceId),
      stream: null,
      refs: 0,
      stopTimer: null,
      endedCallbacks: new Set(),
      needs: new Map(),
      resolution: "full",
    }
    entry = created
    cache.set(key, created)
    created.promise.then(
      (stream) => {
        created.stream = stream
        if (cache.get(key) !== created) {
          stopStream(stream)
          return
        }
        watchEnded(created, stream)
      },
      () => {
        if (cache.get(key) === created) cache.delete(key)
      }
    )
  }

  const current = entry
  current.refs += 1
  if (current.stopTimer) {
    clearTimeout(current.stopTimer)
    current.stopTimer = null
  }

  let released = false
  const callbacks = new Set<() => void>()
  const holder = Symbol("camera-holder")
  current.needs.set(holder, "full")
  const release = ({ immediate = false }: { immediate?: boolean } = {}) => {
    if (released) return
    released = true
    callbacks.forEach((callback) => current.endedCallbacks.delete(callback))
    current.needs.delete(holder)
    if (current.needs.size) applyResolution(current)
    if (cache.get(key) !== current) return
    current.refs = Math.max(0, current.refs - 1)
    if (current.refs > 0) return
    if (immediate) evict(current)
    else if (!current.stopTimer) scheduleStop(current, CAMERA_RELEASE_GRACE_MS)
  }

  let stream: MediaStream
  try {
    stream = await current.promise
  } catch (error) {
    release()
    throw new CameraStreamError(cameraErrorState(error), error)
  }

  // The track may have ended while we waited on the promise.
  if (cache.get(key) !== current) {
    release()
    throw new CameraStreamError("missing")
  }

  const settings = stream.getVideoTracks()[0]?.getSettings()
  return {
    stream,
    deviceId: settings?.deviceId || current.deviceId,
    deviceLabel: stream.getVideoTracks()[0]?.label || current.deviceLabel,
    match: resolved.match,
    onEnded: (callback) => {
      if (released) return
      callbacks.add(callback)
      current.endedCallbacks.add(callback)
    },
    release,
    setResolution: (resolution) => {
      if (released) return
      current.needs.set(holder, resolution)
      applyResolution(current)
    },
  }
}

/**
 * Opens the camera ahead of time and lets it sit for one grace period, so a
 * camera slide that is about to go live finds its stream already running.
 */
const prewarm = async (data: CameraSettingsInput) => {
  try {
    const handle = await acquire(data)
    handle.release()
  } catch (error) {
    // The slide itself reports the failure when it goes live.
    console.warn("Camera prewarm failed:", error)
  }
}

export type CameraPrewarmBroadcast = {
  kind: "camera-prewarm"
  data: CameraSettingsInput
}

export const isCameraPrewarmBroadcast = (
  payload: unknown
): payload is CameraPrewarmBroadcast =>
  !!payload &&
  typeof payload === "object" &&
  (payload as CameraPrewarmBroadcast).kind === "camera-prewarm" &&
  !!(payload as CameraPrewarmBroadcast).data

/**
 * Operator side: a camera slide was selected, so it is likely to go live next.
 * The projector window opens the camera now instead of when it goes live.
 * Only the device travels; the stream never leaves the window that opens it.
 */
export const postCameraPrewarm = (data: CameraSettingsInput) =>
  postCrossWindowNotification<CameraPrewarmBroadcast>({
    kind: "camera-prewarm",
    data: { deviceId: data.deviceId, deviceLabel: data.deviceLabel },
  })

/** Stops every camera this window has open, grace period or not. */
const releaseAllCameras = () => {
  ;[...cache.values()].forEach(evict)
}

/** Runs the callback when a camera is plugged in or removed. */
const onCameraDevicesChange = (callback: () => void) => {
  const devices = mediaDevices()
  if (!devices?.addEventListener) return () => {}
  devices.addEventListener("devicechange", callback)
  return () => devices.removeEventListener("devicechange", callback)
}

// Closing or reloading the window must free the device immediately, not after
// the grace period, or the camera light stays on and OBS cannot open it.
// `pagehide` rather than `beforeunload`: the latter also fires when a "leave
// site?" prompt is then cancelled, which would kill a feed that stays on screen.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", releaseAllCameras)
}

const useCameraStream = () => ({
  listCameras,
  resolveDevice,
  acquire,
  prewarm,
  releaseAllCameras,
  onCameraDevicesChange,
})

export default useCameraStream
