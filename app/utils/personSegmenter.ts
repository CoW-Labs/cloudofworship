import { shallowRef } from "vue"

/**
 * Finds the people in a camera frame, for the "Main character echo" camera
 * effect (see cameraEcho.ts), using BodyPix (MobileNetV1 0.50, 2-byte
 * quantised, output stride 16) through TensorFlow.js.
 *
 * Everything runs on this computer: the model ships in /public/models/bodypix
 * (about 1.2 MB, cached by the service worker for offline services) and no
 * frame leaves the window. TensorFlow.js and the model load only when an echo
 * that copies people is first shown, so nobody else downloads them.
 *
 * One detector serves every feed in a window, one frame at a time. Feeds that
 * show the same camera share a stream (useCameraStream), and so share one
 * outline: the operator's editor preview and Live Output thumbnail cost one
 * detection, not two.
 */

export interface PersonMask {
  /** RGBA, the person probability (0–255) in red, row by row. */
  pixels: Uint8Array
  width: number
  height: number
  /** Changes whenever the outline does, so a renderer uploads only new ones. */
  version: number
}

export type PersonSegmenterState = "idle" | "loading" | "ready" | "failed"

/** Whether detection is available here. Shown in the editor's effect panel. */
export const personSegmenterState = shallowRef<PersonSegmenterState>("idle")

/** Where the model is served from (public/models/bodypix). */
const MODEL_URL = "/models/bodypix/model.json"
/** BodyPix reads the frame on a grid of one cell per 16 pixels... */
const STRIDE = 16
/** ...and wants sizes of 16n + 1, so the grid's corners land on the frame's. */
const INPUT_WIDTH = STRIDE * 30 + 1
/** Share of the last outline kept in each new one, which steadies the edges. */
const SMOOTHING = 0.35
/** Outlines nobody has asked for in this long are dropped. */
const FORGET_AFTER_MS = 30_000

interface Detector {
  detect: (
    source: HTMLVideoElement
  ) => Promise<{ probabilities: Float32Array; width: number; height: number }>
}

interface Entry {
  mask: PersonMask
  probabilities: Float32Array
  /** When the frame was read, from performance.now(). */
  at: number
  /** How long the last detection took, in ms. */
  took: number
  usedAt: number
}

const entries = new Map<string, Entry>()
let detectorPromise: Promise<Detector | null> | null = null
let busy = false
let version = 0

const loadDetector = (): Promise<Detector | null> => {
  detectorPromise ??= (async () => {
    personSegmenterState.value = "loading"
    try {
      const tf = await import("@tensorflow/tfjs-core")
      await import("@tensorflow/tfjs-backend-webgl")
      const { loadGraphModel } = await import("@tensorflow/tfjs-converter")
      // On the CPU backend a frame takes seconds, which would stall the
      // projector, so without WebGL the effect copies the whole picture.
      if (!(await tf.setBackend("webgl"))) throw new Error("WebGL unavailable")
      await tf.ready()
      const model = await loadGraphModel(MODEL_URL)

      const detect: Detector["detect"] = async (source) => {
        const { videoWidth: w, videoHeight: h } = source
        const inputHeight =
          Math.max(1, Math.round(((INPUT_WIDTH - 1) * h) / w / STRIDE)) *
            STRIDE +
          1
        const output = tf.tidy(() => {
          const frame = tf.image.resizeBilinear(tf.browser.fromPixels(source), [
            inputHeight,
            INPUT_WIDTH,
          ])
          // MobileNet takes pixels scaled to -1…1.
          const input = tf.expandDims(
            tf.sub(tf.div(tf.cast(frame, "float32"), 127.5), 1),
            0
          )
          const segments = model.execute(input, "float_segments") as any
          return tf.squeeze(tf.sigmoid(segments)) as any
        })
        const [height, width] = output.shape as [number, number]
        const probabilities = (await output.data()) as Float32Array
        output.dispose()
        return { probabilities, width, height }
      }

      personSegmenterState.value = "ready"
      return { detect }
    } catch (error) {
      console.warn("Person detection unavailable:", error)
      personSegmenterState.value = "failed"
      return null
    }
  })()
  return detectorPromise
}

/** A patch of person cells counts this much more if it was the main person last time. */
const LEAD_STICKINESS = 1.5

/**
 * The outline with only the main person left in it: the largest patch of
 * touching person cells, which is usually whoever is nearest the camera.
 * Everyone else is cleared, soft edges included, so they get no copies and
 * copies may pass over them.
 *
 * `lead` is the last result's, and the patch overlapping it counts half again,
 * so the choice does not flip between two people of a similar size. Returns a
 * new pixel array: feeds of one camera share `mask`.
 */
export const keepMainPerson = (
  mask: PersonMask,
  lead: Uint8Array | null
): { pixels: Uint8Array; lead: Uint8Array | null } => {
  const { width: w, height: h } = mask
  const n = w * h
  const pixels = mask.pixels.slice()
  const isPerson = (i: number) => pixels[i * 4]! >= 128
  const label = new Int32Array(n).fill(-1)
  const stack: number[] = []
  let best = -1
  let bestScore = 0
  let patches = 0

  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || !isPerson(start)) continue
    const id = patches++
    let area = 0
    let wasLead = false
    label[start] = id
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      area++
      if (lead?.[i]) wasLead = true
      const x = i % w
      if (x > 0 && label[i - 1] === -1 && isPerson(i - 1)) {
        label[i - 1] = id
        stack.push(i - 1)
      }
      if (x < w - 1 && label[i + 1] === -1 && isPerson(i + 1)) {
        label[i + 1] = id
        stack.push(i + 1)
      }
      if (i >= w && label[i - w] === -1 && isPerson(i - w)) {
        label[i - w] = id
        stack.push(i - w)
      }
      if (i + w < n && label[i + w] === -1 && isPerson(i + w)) {
        label[i + w] = id
        stack.push(i + w)
      }
    }
    const score = wasLead ? area * LEAD_STICKINESS : area
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  // Nobody in shot: keep the last choice for when they are back.
  if (best < 0) return { pixels, lead }

  const nextLead = new Uint8Array(n)
  const neighbours = (i: number) => {
    const x = i % w
    return [
      x > 0 ? label[i - 1]! : -1,
      x < w - 1 ? label[i + 1]! : -1,
      i >= w ? label[i - w]! : -1,
      i + w < n ? label[i + w]! : -1,
    ]
  }
  for (let i = 0; i < n; i++) {
    const id = label[i]!
    if (id === best) {
      nextLead[i] = 1
      continue
    }
    if (id >= 0) {
      pixels[i * 4] = 0
      continue
    }
    // The soft edge of someone else, unless it also borders the main person.
    const around = neighbours(i)
    if (around.some((other) => other >= 0 && other !== best) && !around.includes(best)) {
      pixels[i * 4] = 0
    }
  }
  return { pixels, lead: nextLead }
}

/** The newest outline for `key` (a camera stream's id), or null. */
export const latestPersonMask = (key: string): PersonMask | null => {
  const entry = entries.get(key)
  if (!entry) return null
  entry.usedAt = performance.now()
  return entry.mask
}

/**
 * Reads a fresh outline for `key` from `source`, unless this window is busy
 * with another detection or the last one is newer than `minIntervalMs`. The
 * interval also stretches to twice the last detection's time, so a slow
 * computer spends at most half its time on detection. Never throws; call it as
 * often as frames arrive and read the result with latestPersonMask.
 */
export const refreshPersonMask = async (
  source: HTMLVideoElement,
  key: string,
  minIntervalMs: number
): Promise<void> => {
  if (busy || personSegmenterState.value === "failed") return
  const now = performance.now()
  const entry = entries.get(key)
  if (entry && now - entry.at < Math.max(minIntervalMs, entry.took * 2)) return
  if (!source.videoWidth || !source.videoHeight) return

  busy = true
  try {
    const detector = await loadDetector()
    if (!detector) return
    const started = performance.now()
    const { probabilities, width, height } = await detector.detect(source)
    const took = performance.now() - started

    const previous = entries.get(key)
    const keep =
      previous && previous.probabilities.length === probabilities.length
        ? previous.probabilities
        : null
    const pixels = new Uint8Array(width * height * 4)
    for (let i = 0; i < probabilities.length; i++) {
      const value = keep
        ? keep[i]! * SMOOTHING + probabilities[i]! * (1 - SMOOTHING)
        : probabilities[i]!
      probabilities[i] = value
      pixels[i * 4] = Math.round(value * 255)
    }
    version += 1
    entries.set(key, {
      mask: { pixels, width, height, version },
      probabilities,
      at: started,
      took,
      usedAt: performance.now(),
    })

    for (const [other, stale] of entries) {
      if (performance.now() - stale.usedAt > FORGET_AFTER_MS) entries.delete(other)
    }
  } catch (error) {
    // A frame the camera dropped mid-read; the next one tries again.
    console.warn("Person detection skipped a frame:", error)
  } finally {
    busy = false
  }
}
