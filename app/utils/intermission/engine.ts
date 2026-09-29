/**
 * Intermission slide engine.
 *
 * Every frame is a pure function of time T (seconds since the slide mounted):
 * a 2.4s intro that plays once, then an 8s loop at 120 BPM whose second half
 * swaps to the variant's drop palette behind a circular wipe. Ambient motion
 * uses `u`, which is periodic in LOOP, so rotations use whole turns (or the
 * symbol's own symmetry) and the loop has no visible seam.
 *
 * Lives under utils/intermission/ (not utils/) on purpose: Nuxt auto-imports
 * top-level utils, and helpers like `clamp` would collide app-wide.
 */

export const INTRO = 2.4
export const LOOP = 8
export const WIPE = 0.5
/** A settled, representative moment for thumbnails and reduced motion. */
export const STATIC_FRAME_T = INTRO + 1.2

/** Text enter/exit timing. Enter is a blur + zoom in, exit a blur + zoom out. */
export const TEXT_MOTION = {
  inAt: 0.5,
  inDur: 1.1,
  subLag: 0.35,
  outDur: 0.7,
  zoomIn: 1.45,
  zoomOut: 0.72,
  /** Max blur as a fraction of the stage width. */
  blur: 0.028,
}

const TAU = Math.PI * 2
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const eOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const eOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const eInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2
const eInOutQuart = (x: number) =>
  x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2
const hexA = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export interface IntermissionPalette {
  name: string
  bg: string
  c: string[]
  ink: string
  plate: string
  chipBg: string
  chipInk: string
  glow?: string
  blend?: GlobalCompositeOperation
}

export interface FrameState {
  T: number
  u: number
  w: number
  h: number
  cx: number
  cy: number
  m: number
  D: number
  kick: number
  enter: (delay: number, dur: number, ease?: (x: number) => number) => number
  osc: (k: number, phase?: number) => number
  spin: (k: number) => number
}

export interface WipeState {
  base: 0 | 1
  top: 0 | 1
  /** Wipe progress 0..1; 0 means no wipe in progress. */
  wp: number
  /** Seconds since the last palette drop, Infinity before the first. */
  since: number
}

export interface IntermissionVariant {
  id: string
  name: string
  symbol: string
  best: string
  /** Whether the heading sits on a solid block by default. */
  textBackground: boolean
  /**
   * Canvas resolution relative to the output, for artwork soft enough that
   * drawing it smaller and scaling up looks the same. Defaults to 1.
   */
  renderScale?: number
  palettes: [IntermissionPalette, IntermissionPalette]
  draw: (c: CanvasRenderingContext2D, S: FrameState, P: IntermissionPalette) => void
}

export function frameState(T: number, w: number, h: number): FrameState {
  const u = T < INTRO ? T - INTRO : (T - INTRO) % LOOP
  return {
    T,
    u,
    w,
    h,
    cx: w / 2,
    cy: h / 2,
    m: Math.min(w, h),
    D: Math.hypot(w, h),
    kick: T < INTRO ? 0 : Math.exp(-(u % 2) * 5),
    enter: (d, dur, ease = eOutExpo) => ease(clamp((T - d) / dur)),
    osc: (k, p = 0) => Math.sin(TAU * ((k * u) / LOOP + p)),
    spin: (k) => (TAU * k * u) / LOOP,
  }
}

export function wipeState(T: number): WipeState {
  if (T < INTRO) return { base: 0, top: 0, wp: 0, since: Infinity }
  const x = T - INTRO
  const iter = Math.floor(x / LOOP)
  const lt = x - iter * LOOP
  const half = LOOP / 2
  if (lt < half) {
    if (iter > 0 && lt < WIPE)
      return { base: 1, top: 0, wp: eInOutQuart(lt / WIPE), since: lt }
    return { base: 0, top: 0, wp: 0, since: iter > 0 ? lt : Infinity }
  }
  const since = lt - half
  if (since < WIPE)
    return { base: 0, top: 1, wp: eInOutQuart(since / WIPE), since }
  return { base: 1, top: 1, wp: 0, since }
}

/** Radius of the palette wipe for a given progress. */
export const wipeRadius = (wp: number, S: FrameState) => wp * S.D * 0.56

/**
 * Opacity, scale and blur (0..1 of the max) for a text element.
 * `textIn` / `textOut` are times on the same clock as `t`; `lag` delays the
 * sub text behind the heading.
 */
export function textMotion(
  t: number,
  textIn: number,
  textOut: number | null,
  lag: number
) {
  const M = TEXT_MOTION
  let o = 1
  let s = 1
  let b = 0
  const pin = clamp((t - textIn - M.inAt - lag) / M.inDur)
  if (pin < 1) {
    const e = eOutExpo(pin)
    o = clamp(pin * 2.2)
    s = lerp(M.zoomIn, 1, e)
    b = 1 - e
  }
  if (textOut !== null) {
    // The sub text leaves a beat before the heading.
    const q = eInOutQuart(
      clamp((t - textOut - (M.subLag - lag) * 0.25) / M.outDur)
    )
    o *= 1 - q
    s *= lerp(1, M.zoomOut, q)
    b = Math.max(b, q)
  }
  return { o, s, b }
}

/** Centre scrim strength: eases in just ahead of the text and out with it. */
export function scrimAmount(t: number, textIn: number, textOut: number | null) {
  const a = eInOutSine(clamp((t - textIn - TEXT_MOTION.inAt + 0.2) / 1.2))
  const b = textOut === null ? 0 : eInOutSine(clamp((t - textOut) / 0.9))
  return a * (1 - b)
}

/** Heading bump on each palette drop, plus a slow bob once the loop starts. */
export function textPulse(S: FrameState, wipe: WipeState) {
  return {
    punch: wipe.since < 1.2 ? 0.06 * Math.exp(-wipe.since * 7) : 0,
    bob: S.T < INTRO ? 0 : 0.35 * S.osc(2),
  }
}

function renderScene(
  c: CanvasRenderingContext2D,
  S: FrameState,
  P: IntermissionPalette,
  v: IntermissionVariant,
  scrim: number
) {
  c.fillStyle = P.bg
  c.fillRect(0, 0, S.w, S.h)
  c.save()
  v.draw(c, S, P)
  c.restore()
  if (scrim > 0.001) {
    const g = c.createRadialGradient(S.cx, S.cy, 0, S.cx, S.cy, S.m * 0.8)
    g.addColorStop(0, hexA(P.bg, 0.7 * scrim))
    g.addColorStop(1, hexA(P.bg, 0))
    c.fillStyle = g
    c.fillRect(0, 0, S.w, S.h)
  }
}

/** Draws one frame. The caller sets the device-pixel transform first. */
export function renderIntermissionFrame(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  T: number,
  v: IntermissionVariant,
  scrim: number
) {
  const S = frameState(T, w, h)
  const wipe = wipeState(T)
  renderScene(c, S, v.palettes[wipe.base], v, scrim)
  if (wipe.wp > 0) {
    c.save()
    c.beginPath()
    c.arc(S.cx, S.cy, wipeRadius(wipe.wp, S), 0, TAU)
    c.clip()
    renderScene(c, S, v.palettes[wipe.top], v, scrim)
    c.restore()
  }
  return { S, wipe }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape helpers
// ─────────────────────────────────────────────────────────────────────────────

function star(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  inner: number,
  pts: number,
  ang: number
) {
  c.beginPath()
  for (let j = 0; j < pts * 2; j++) {
    const r = j % 2 ? R * inner : R
    const a = ang + (j * Math.PI) / pts
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (j) c.lineTo(px, py)
    else c.moveTo(px, py)
  }
  c.closePath()
}

function superShape(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  R: number,
  m: number,
  n1: number,
  n2: number,
  n3: number,
  rot: number
) {
  const steps = 160
  const pts: number[] = []
  let max = 0
  for (let j = 0; j < steps; j++) {
    const t = (j / steps) * TAU
    let r = Math.pow(
      Math.pow(Math.abs(Math.cos((m * t) / 4)), n2) +
        Math.pow(Math.abs(Math.sin((m * t) / 4)), n3),
      -1 / n1
    )
    if (!isFinite(r)) r = 0
    pts.push(t, r)
    if (r > max) max = r
  }
  const k = max ? R / max : 0
  c.beginPath()
  for (let j = 0; j < pts.length; j += 2) {
    const a = pts[j]! + rot
    const r = pts[j + 1]! * k
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (j) c.lineTo(px, py)
    else c.moveTo(px, py)
  }
  c.closePath()
}

function flower(
  c: CanvasRenderingContext2D,
  S: FrameState,
  P: IntermissionPalette,
  x: number,
  y: number,
  size: number,
  dir: number,
  delay: number
) {
  const rings = [
    { n: 14, len: 1 },
    { n: 11, len: 0.78 },
    { n: 9, len: 0.56 },
    { n: 7, len: 0.36 },
  ]
  rings.forEach((rg, r) => {
    const e = S.enter(delay + r * 0.12, 1.2, eOutBack)
    if (e <= 0.001) return
    const L = size * rg.len * e * (1 + 0.03 * S.kick)
    const W = L * 0.2 * (1 + 0.12 * S.osc(2, r * 0.2))
    const twist = 0.38 * S.osc(1, 0.1 + r * 0.15)
    const base = dir * (S.spin(1 / rg.n) + (1 - e) * 1.5) + r * 0.21
    // Every petal in a ring shares the same local gradient.
    const g = c.createLinearGradient(0, 0, L, 0)
    g.addColorStop(0, P.c[r % P.c.length]!)
    g.addColorStop(1, P.c[(r + 1) % P.c.length]!)
    for (let j = 0; j < rg.n; j++) {
      c.save()
      c.translate(x, y)
      c.rotate(base + (j * TAU) / rg.n)
      c.translate(L * 0.06, 0)
      c.rotate(twist)
      c.fillStyle = g
      c.beginPath()
      c.ellipse(L * 0.5, 0, L * 0.5, W, 0, 0, TAU)
      c.fill()
      c.restore()
    }
  })
  const e = S.enter(delay + 0.55, 0.8, eOutBack)
  c.fillStyle = P.c[3 % P.c.length]!
  c.beginPath()
  c.arc(x, y, Math.max(0, size * 0.13 * e * (1 + 0.08 * S.kick)), 0, TAU)
  c.fill()
}

// ─────────────────────────────────────────────────────────────────────────────
// Variants, in picker order. CoW Original stays first: it is the default
// for new slides.
// ─────────────────────────────────────────────────────────────────────────────

export const intermissionVariants: IntermissionVariant[] = [
  {
    id: "cow-original",
    name: "CoW Original",
    symbol: "Upright Latin crosses",
    best: "Communion, prayer, any service break",
    textBackground: false,
    palettes: [
      {
        name: "Cloud Purple",
        bg: "#1b0a33",
        c: ["#6b21a8", "#a855f7", "#f3e8ff"],
        glow: "#a855f7",
        ink: "#ffffff",
        plate: "#1b0a33",
        chipBg: "#c084fc",
        chipInk: "#1b0a33",
      },
      {
        name: "Morning Light",
        bg: "#f6f0ff",
        c: ["#dcc3fb", "#c084fc", "#7e22ce"],
        glow: "#ffffff",
        ink: "#2e1065",
        plate: "#f6f0ff",
        chipBg: "#7e22ce",
        chipInk: "#ffffff",
      },
    ],
    draw(c, S, P) {
      // Soft light behind the centre, breathing with the loop.
      const glow = P.glow || P.c[1]!
      const gl = c.createRadialGradient(S.cx, S.cy, 0, S.cx, S.cy, S.m * 0.9)
      gl.addColorStop(
        0,
        hexA(glow, 0.32 * S.enter(0.2, 1.6) * (0.85 + 0.15 * S.osc(1)))
      )
      gl.addColorStop(1, hexA(glow, 0))
      c.fillStyle = gl
      c.fillRect(0, 0, S.w, S.h)

      const cols = 15
      const cw = S.w / cols
      const rh = cw * 1.3
      const rows = Math.ceil(S.h / rh) + 2
      const oy = (S.h - rows * rh) / 2
      const latin = (sz: number, t: number) => {
        // Vertical beam, then the crossbar a third of the way down.
        c.beginPath()
        c.roundRect(-t / 2, -sz / 2, t, sz, t * 0.18)
        c.roundRect(-sz * 0.34, -sz / 2 + sz * 0.27, sz * 0.68, t, t * 0.18)
        c.fill()
      }
      for (let r = 0; r < rows; r++)
        for (let k = -1; k <= cols; k++) {
          const x = (k + 0.5 + (r % 2) * 0.5) * cw
          const y = oy + (r + 0.5) * rh
          const dx = (x - S.cx) / S.w
          const dy = (y - S.cy) / S.h
          const d = Math.hypot(dx * 1.78, dy)
          const e = S.enter(0.1 + d * 0.9, 0.9, eOutBack)
          if (e <= 0.001) continue
          const clear = lerp(
            0.22,
            1,
            smooth(0.75, 1.35, Math.hypot(dx / 0.42, dy / 0.3))
          )
          const crest = Math.pow(0.5 + 0.5 * Math.sin(d * 9 - S.spin(1)), 3)
          const sz =
            rh * 0.74 * clear * (0.78 + 0.22 * crest) * e * (1 + 0.04 * S.kick)
          const t = sz * 0.19
          c.save()
          c.translate(x, y - rh * 0.07 * crest)
          c.fillStyle = (r * 5 + k * 3) % 13 === 0 ? P.c[1]! : P.c[0]!
          latin(sz, t)
          if (crest > 0.02) {
            c.globalAlpha = crest
            c.fillStyle = P.c[2]!
            latin(sz, t)
          }
          c.restore()
        }
    },
  },
  {
    id: "gathering",
    name: "Gathering",
    symbol: "Nested rounded squares",
    best: "Welcome loops, pre-service, series titles",
    textBackground: false,
    // Ten near full-frame gradient fills per frame make this the heaviest
    // variant; its soft gradients hide a 0.6x canvas scaled up.
    renderScale: 0.6,
    palettes: [
      {
        name: "Hot Rose",
        bg: "#12000c",
        c: ["#ff95ec", "#ff00d3", "#ff1f3d", "#0a0006"],
        ink: "#ffffff",
        plate: "#12000c",
        chipBg: "#ffffff",
        chipInk: "#d4009f",
      },
      {
        name: "Deep Tide",
        bg: "#030c1f",
        c: ["#8ff3ff", "#2b6bff", "#2a1bb0", "#02030d"],
        ink: "#ffffff",
        plate: "#030c1f",
        chipBg: "#d4ff4a",
        chipInk: "#030c1f",
      },
    ],
    draw(c, S, P) {
      // Ten bands spread over the same span the original fourteen covered.
      const n = 10
      const span = 13
      const drift = S.spin(1)
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1)
        const e = S.enter(0.05 + k * span * 0.05, 1.3)
        if (e <= 0.001) continue
        const size = S.D * (1.05 - k * 0.92) * e * (1 + 0.03 * S.kick * (1 - k))
        const ang =
          -(1 - e) * Math.PI * 1.25 +
          k * span * (0.075 + 0.045 * S.osc(1)) +
          S.spin(0.25)
        const off = S.m * 0.028 * k * span * e
        const h = size / 2
        c.save()
        c.translate(
          S.cx + Math.cos(drift) * off,
          S.cy + Math.sin(drift) * off * 0.7
        )
        c.rotate(ang)
        const g = c.createLinearGradient(-h, -h, h, h)
        g.addColorStop(0, P.c[0]!)
        g.addColorStop(0.18, P.c[1]!)
        g.addColorStop(0.55, P.c[2]!)
        g.addColorStop(0.97 - k * 0.12, P.c[3]!)
        c.fillStyle = g
        c.beginPath()
        c.roundRect(-h, -h, size, size, size * 0.14)
        c.fill()
        c.restore()
      }
    },
  },
  {
    id: "selah",
    name: "Selah",
    symbol: "Broken rings with orbiting dots",
    best: "Countdowns to service, a pause between segments",
    textBackground: true,
    palettes: [
      {
        name: "Signal",
        bg: "#1739ff",
        c: ["#ff7a1a", "#ffe6c7", "#0a0f3d", "#ff5fb0"],
        ink: "#0a0f3d",
        plate: "#ffe6c7",
        chipBg: "#ff7a1a",
        chipInk: "#0a0f3d",
      },
      {
        name: "Cream Dial",
        bg: "#ffe6c7",
        c: ["#1739ff", "#ff3b1f", "#0a0f3d", "#ff9ecf"],
        ink: "#ffe6c7",
        plate: "#0a0f3d",
        chipBg: "#1739ff",
        chipInk: "#ffe6c7",
      },
    ],
    draw(c, S, P) {
      const spec: [number, number][] = [
        [3, 1],
        [2, -1],
        [4, 2],
        [1, -1],
        [3, 1],
        [2, -2],
        [5, 1],
        [2, -1],
      ]
      c.lineCap = "round"
      spec.forEach(([segs, sp], i) => {
        const e = S.enter(0.05 + i * 0.08, 1.3)
        if (e <= 0.001) return
        const r = S.m * (0.3 + i * 0.105) * (1 + 0.02 * S.kick)
        const lw = S.m * 0.058
        const fill = (0.55 + 0.25 * S.osc(1, i * 0.13)) * e
        const base = S.spin(sp) + i * 0.7 + (1 - e) * sp * 2
        c.strokeStyle = P.c[i % P.c.length]!
        c.lineWidth = lw
        for (let s = 0; s < segs; s++) {
          const a0 = base + (s * TAU) / segs
          c.beginPath()
          c.arc(S.cx, S.cy, r, a0, a0 + (TAU / segs) * fill)
          c.stroke()
        }
        if (i % 2 === 0) {
          const a = -S.spin(sp * 2) + i
          c.fillStyle = P.c[(i + 2) % P.c.length]!
          c.beginPath()
          c.arc(
            S.cx + Math.cos(a) * r,
            S.cy + Math.sin(a) * r,
            lw * 0.78 * e,
            0,
            TAU
          )
          c.fill()
        }
      })
    },
  },
  {
    id: "open-heavens",
    name: "Open Heavens",
    symbol: "Morphing shapes in a tunnel",
    best: "Service start, conferences, youth",
    textBackground: true,
    palettes: [
      {
        name: "Ultraviolet",
        bg: "#12002b",
        c: ["#ff3df2", "#7b2dff", "#20e3ff", "#ffe14d", "#ff5c39"],
        ink: "#ffffff",
        plate: "#12002b",
        chipBg: "#20e3ff",
        chipInk: "#12002b",
      },
      {
        name: "Ember",
        bg: "#ff5c39",
        c: ["#12002b", "#ffe14d", "#ff9be8", "#2d1bff", "#fff4e8"],
        ink: "#fff4e8",
        plate: "#12002b",
        chipBg: "#ffe14d",
        chipInk: "#12002b",
      },
    ],
    draw(c, S, P) {
      const N = 18
      const flow = (S.u / LOOP) * 2
      const open = S.enter(0, 1.8)
      const layers: { i: number; z: number }[] = []
      for (let i = 0; i < N; i++)
        layers.push({ i, z: (((i / N + flow) % 1) + 1) % 1 })
      layers.sort((a, b) => b.z - a.z)
      for (const { i, z } of layers) {
        const R = S.D * 0.9 * Math.pow(z, 2.1) * open * (1 + 0.04 * S.kick * z)
        if (R < 1) continue
        const n1 = lerp(0.35, 6, 0.5 + 0.5 * S.osc(1, z * 0.5))
        // The outermost shape fades out before it wraps back to the centre.
        c.globalAlpha = clamp((1 - z) / 0.12)
        superShape(
          c,
          S.cx,
          S.cy,
          R,
          6,
          n1,
          n1 * 0.9 + 0.3,
          n1 * 0.9 + 0.3,
          z * 2.4 + S.spin(1 / 6)
        )
        c.fillStyle = P.c[i % P.c.length]!
        c.fill()
      }
      c.globalAlpha = 1
    },
  },
  {
    id: "still-waters",
    name: "Still Waters",
    symbol: "Overlapping rolling ribbons",
    best: "Worship set intros, offering, reflection",
    textBackground: true,
    palettes: [
      {
        name: "Lagoon",
        bg: "#0f5c4d",
        c: ["#b8ff5c", "#ff6f91", "#1ec8a5", "#fff3c4", "#0a2e28"],
        ink: "#fff3c4",
        plate: "#0a2e28",
        chipBg: "#b8ff5c",
        chipInk: "#0a2e28",
      },
      {
        name: "Guava",
        bg: "#ff6f91",
        c: ["#3d1d6e", "#ffd166", "#ff9fb6", "#06d6a0", "#fff7ea"],
        ink: "#3d1d6e",
        plate: "#fff7ea",
        chipBg: "#3d1d6e",
        chipInk: "#fff7ea",
      },
    ],
    draw(c, S, P) {
      const n = 10
      const span = S.D * 1.1
      const lw = S.h * 0.16
      const gap = S.h * 0.13
      c.translate(S.cx, S.cy)
      c.rotate(-0.32)
      c.lineCap = "round"
      c.lineJoin = "round"
      for (let i = 0; i < n; i++) {
        const e = S.enter(0.05 + i * 0.06, 1.1)
        if (e <= 0.001) continue
        const y0 = (i - (n - 1) / 2) * gap
        const amp = S.h * (0.07 + 0.03 * S.osc(1, i * 0.1)) * (1 + 0.25 * S.kick)
        const ph = S.spin(1) + i * 0.55
        const x0 = -span / 2
        const x1 = x0 + span * e
        const step = span / 90
        c.beginPath()
        c.moveTo(x0, y0 + Math.sin(ph) * amp)
        for (let x = x0 + step; x <= x1; x += step)
          c.lineTo(x, y0 + Math.sin(((x - x0) / span) * TAU * 1.3 + ph) * amp)
        c.strokeStyle = P.c[i % P.c.length]!
        c.lineWidth = lw
        c.stroke()
      }
    },
  },
  {
    id: "lilies",
    name: "Lilies",
    symbol: "Petal flowers from the corners",
    best: "Easter, Mother's Day, women's fellowship",
    textBackground: false,
    palettes: [
      {
        name: "Blush",
        bg: "#ffe3ec",
        c: ["#ff3d6e", "#ff8a3d", "#ffc3d4", "#7a1150"],
        ink: "#3b0a2a",
        plate: "#ffe3ec",
        chipBg: "#3b0a2a",
        chipInk: "#ffe3ec",
      },
      {
        name: "Night Garden",
        bg: "#2b0f3a",
        c: ["#ffb347", "#ff5e8a", "#f7e8ff", "#8b5cf6"],
        ink: "#fff4e6",
        plate: "#2b0f3a",
        chipBg: "#ffb347",
        chipInk: "#2b0f3a",
      },
    ],
    draw(c, S, P) {
      flower(c, S, P, S.w * 0.12, S.h * 0.94, S.m * 0.98, 1, 0)
      flower(c, S, P, S.w * 0.9, S.h * 0.08, S.m * 0.64, -1, 0.25)
      flower(c, S, P, S.w * 0.86, S.h * 0.9, S.m * 0.28, 1, 0.45)
    },
  },
  {
    id: "jubilee",
    name: "Jubilee",
    symbol: "Stacked twelve-point stars",
    best: "Celebration Sundays, youth nights, thanksgiving",
    textBackground: true,
    palettes: [
      {
        name: "Tangerine",
        bg: "#ff5a1f",
        c: ["#2a0b45", "#ffd84d", "#ff2d87", "#fff1dc"],
        ink: "#fff1dc",
        plate: "#2a0b45",
        chipBg: "#ffd84d",
        chipInk: "#2a0b45",
      },
      {
        name: "Cobalt Candy",
        bg: "#0d1b8c",
        c: ["#ff9ad5", "#12e0b6", "#fff6e0", "#ff4a1c"],
        ink: "#0d1b8c",
        plate: "#fff6e0",
        chipBg: "#ff4a1c",
        chipInk: "#fff6e0",
      },
    ],
    draw(c, S, P) {
      const n = 9
      const pts = 12
      c.lineJoin = "round"
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1)
        const e = S.enter(0.1 + i * 0.07, 1, eOutBack)
        if (e <= 0.001) continue
        const R = S.D * 0.58 * (1 - k * 0.86) * e * (1 + 0.035 * S.kick)
        const dir = i % 2 ? 1 : -1
        star(
          c,
          S.cx,
          S.cy,
          R,
          0.7 + 0.1 * S.osc(2, k * 0.5),
          pts,
          dir * (S.spin(2 / pts) + (1 - e) * 1.4) + i * 0.13
        )
        c.fillStyle = c.strokeStyle = P.c[i % P.c.length]!
        c.lineWidth = R * 0.06
        c.fill()
        c.stroke()
      }
    },
  },
  {
    id: "fellowship",
    name: "Fellowship",
    symbol: "Two-ink dots that merge",
    best: "Announcements, events, fellowship breaks",
    textBackground: true,
    palettes: [
      {
        name: "Riso Paper",
        bg: "#f4efe6",
        c: ["#ff2d55", "#1f4bff"],
        blend: "multiply",
        ink: "#f4efe6",
        plate: "#16121c",
        chipBg: "#ff2d55",
        chipInk: "#f4efe6",
      },
      {
        name: "Neon Screen",
        bg: "#0b0b12",
        c: ["#00e5ff", "#ff3df0"],
        blend: "screen",
        ink: "#0b0b12",
        plate: "#f4efe6",
        chipBg: "#00e5ff",
        chipInk: "#0b0b12",
      },
    ],
    draw(c, S, P) {
      const cols = 40
      const sp = S.w / cols
      const rows = Math.ceil(S.h / sp) + 1
      const oy = (S.h - rows * sp) / 2
      const a1 = S.spin(1)
      const a2 = Math.PI - S.spin(1)
      const p1 = {
        x: S.cx + Math.cos(a1) * S.w * 0.28,
        y: S.cy + Math.sin(a1) * S.h * 0.32,
      }
      const p2 = {
        x: S.cx + Math.cos(a2) * S.w * 0.3,
        y: S.cy + Math.sin(a2 * 2) * S.h * 0.28,
      }
      const layer = (col: string, dx: number, dy: number, ph: number) => {
        c.fillStyle = col
        c.beginPath()
        for (let r = 0; r < rows; r++)
          for (let k = 0; k < cols; k++) {
            const x = (k + 0.5) * sp + dx
            const y = oy + (r + 0.5) * sp + dy
            const d1 = Math.hypot(x - p1.x, y - p1.y) / S.m
            const d2 = Math.hypot(x - p2.x, y - p2.y) / S.m
            const v =
              0.5 +
              0.5 *
                Math.sin(d1 * 18 - S.spin(3) + ph) *
                Math.cos(d2 * 14 + S.spin(2))
            const e = S.enter(
              0.05 + (Math.hypot(x - S.cx, y - S.cy) / S.D) * 1.4,
              0.6
            )
            const rad = sp * 0.64 * v * e * (1 + 0.15 * S.kick)
            if (rad > 0.4) {
              c.moveTo(x + rad, y)
              c.arc(x, y, rad, 0, TAU)
            }
          }
        c.fill()
      }
      layer(P.c[0]!, 0, 0, 0)
      c.globalCompositeOperation = P.blend || "source-over"
      layer(P.c[1]!, sp * 0.28, sp * 0.18, 0.9)
    },
  },
]

export const DEFAULT_INTERMISSION_VARIANT = intermissionVariants[0]!.id

export const getIntermissionVariant = (id?: string): IntermissionVariant =>
  intermissionVariants.find((v) => v.id === id) || intermissionVariants[0]!
