import type { LightLeakSettings } from "~/types"
import {
  openCameraCanvas,
  SCREEN_VERTEX_SHADER,
  type CameraEffectRenderer,
} from "~/utils/cameraWebgl"

/**
 * The camera slide's "Light leak": a burst of burnt film flashed over the
 * picture, as a film camera's light leaks and frame burns do.
 *
 * A burst replays a film burn measured frame by frame from a reference clip
 * (see BURST): an exposed frame drops in and fills the picture, a dark red one
 * shrinks up and out, the next drops down from the top and brightens, and a
 * black edge with sprocket notches sweeps in from the side. Each burst is
 * mirrored, flipped or reversed at random, so no two in a row look the same.
 *
 * Colour follows exposure, as with heated metal: a shape's "heat" runs from
 * dark red when dim through red and orange to pale yellow when fully exposed,
 * and falls off toward its soft edges, which therefore burn redder. Scratches
 * fixed on the film and specks of dust add or take away heat. The result is
 * screened over the camera, so its black leaves the picture untouched.
 *
 * Drawn, not played from a clip: one shader pass over the camera frame, with
 * nothing to download and no second video to decode.
 */

/** Film frames a second; the burst steps at this rate, as film does. */
const FILM_FPS = 24

/**
 * One film frame's exposed shape, in shares of the picture (x across, y down;
 * past 0 or 1 is off the picture). `heat` is how exposed it is, 0 to 1.
 * `chamfer` cuts the lower near corner (the gate's corner) by that share of
 * the height; `notches` dents its near edge where the sprocket holes are.
 */
interface LeakShape {
  x0: number
  x1: number
  y0: number
  y1: number
  heat: number
  radius?: number
  chamfer?: number
  notches?: boolean
}

interface LeakKeyframe {
  /** Seconds into the burst at normal speed. */
  at: number
  shape: LeakShape | null
  /** A second, dimmer shape some frames carry. */
  extra?: LeakShape
}

// Measured from the reference clip: bounds of the lit area and its colour,
// read back to heat through heatColour below. Held until the next keyframe.
const OFF = -0.08
const PAST = 1.08
const BURST: LeakKeyframe[] = [
  { at: 0, shape: { x0: OFF, x1: 0.75, y0: -0.6, y1: 0.19, heat: 0.36 } },
  { at: 0.01, shape: { x0: OFF, x1: 0.83, y0: OFF, y1: 0.73, heat: 0.84 } },
  { at: 0.05, shape: { x0: OFF, x1: 0.88, y0: OFF, y1: PAST, heat: 0.95 } },
  { at: 0.13, shape: { x0: OFF, x1: 0.89, y0: OFF, y1: PAST, heat: 0.93 } },
  {
    at: 0.19,
    shape: { x0: OFF, x1: 0.8, y0: 0.33, y1: PAST, heat: 0.62, radius: 0.06 },
    extra: { x0: 0.62, x1: PAST, y0: OFF, y1: 0.42, heat: 0.36 },
  },
  { at: 0.225, shape: { x0: 0.59, x1: PAST, y0: OFF, y1: 0.83, heat: 0.43, chamfer: 0.09 } },
  { at: 0.26, shape: { x0: 0.54, x1: PAST, y0: OFF, y1: 0.56, heat: 0.32, chamfer: 0.08 } },
  { at: 0.31, shape: { x0: 0.49, x1: 0.82, y0: OFF, y1: 0.32, heat: 0.23, chamfer: 0.07 } },
  { at: 0.34, shape: { x0: 0.43, x1: 0.92, y0: OFF, y1: 0.18, heat: 0.29, chamfer: 0.06 } },
  { at: 0.38, shape: { x0: 0.43, x1: 0.84, y0: OFF, y1: 0.07, heat: 0.33 } },
  { at: 0.42, shape: { x0: 0.39, x1: 0.84, y0: OFF, y1: 0.04, heat: 0.38 } },
  { at: 0.47, shape: { x0: 0.3, x1: 0.84, y0: OFF, y1: 0.07, heat: 0.5 } },
  { at: 0.5, shape: { x0: 0.21, x1: PAST, y0: OFF, y1: 0.18, heat: 0.57, chamfer: 0.05 } },
  { at: 0.55, shape: { x0: 0.16, x1: PAST, y0: OFF, y1: 0.33, heat: 0.66, chamfer: 0.06 } },
  { at: 0.6, shape: { x0: 0.1, x1: PAST, y0: OFF, y1: 0.56, heat: 0.8, radius: 0.05, notches: true } },
  { at: 0.64, shape: { x0: 0.03, x1: PAST, y0: OFF, y1: 0.9, heat: 0.93, radius: 0.06, notches: true } },
  { at: 0.68, shape: { x0: 0.01, x1: PAST, y0: OFF, y1: PAST, heat: 1, notches: true } },
  { at: 0.71, shape: { x0: -0.01, x1: PAST, y0: OFF, y1: PAST, heat: 0.98, notches: true } },
  { at: 0.76, shape: { x0: 0.02, x1: PAST, y0: OFF, y1: PAST, heat: 0.95, notches: true } },
  { at: 0.79, shape: { x0: 0.09, x1: PAST, y0: OFF, y1: PAST, heat: 0.94, notches: true } },
  { at: 0.83, shape: { x0: 0.17, x1: PAST, y0: OFF, y1: PAST, heat: 0.88, notches: true } },
  { at: 0.875, shape: { x0: 0.26, x1: PAST, y0: 0.12, y1: PAST, heat: 0.68, radius: 0.07 } },
  { at: 0.92, shape: null },
]
/** Seconds a burst lasts at normal speed. */
const BURST_SECONDS = 0.94

const LIGHT_LEAK_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_frame;
uniform vec4 u_shape;   // x0, x1, y0, y1 in shares of the picture
uniform vec4 u_style;   // heat, radius, chamfer, notches
uniform vec4 u_extra;   // a second shape's bounds
uniform float u_extraHeat;
uniform vec2 u_flip;    // 1 or -1: the burst mirrored across, flipped down
uniform float u_step;   // the film frame, for dust
uniform float u_strength;
uniform float u_aspect;
varying vec2 v_uv;

// A repeatable random number in 0 to 1. No sin(): it is unreliable on some
// GPUs for large arguments.
float hash(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// Measured film colours by heat: dark red, red, orange, light orange, and
// past 1 (scratches on a full frame) pale yellow.
vec3 heatColour(float h) {
  vec3 c = mix(vec3(0.0), vec3(0.42, 0.03, 0.02), clamp(h / 0.25, 0.0, 1.0));
  c = mix(c, vec3(0.9, 0.09, 0.07), clamp((h - 0.25) / 0.25, 0.0, 1.0));
  c = mix(c, vec3(0.96, 0.38, 0.16), clamp((h - 0.5) / 0.25, 0.0, 1.0));
  c = mix(c, vec3(0.99, 0.67, 0.27), clamp((h - 0.75) / 0.25, 0.0, 1.0));
  return mix(c, vec3(1.0, 0.92, 0.55), clamp((h - 1.0) / 0.4, 0.0, 1.0));
}

// How far p is inside a shape, in picture heights; below 0 outside. The
// shape's near (x0) side carries its chamfer and sprocket notches.
float inside(vec2 p, vec4 b, float radius, float chamfer, float notches) {
  vec2 lo = vec2(b.x * u_aspect, b.z);
  vec2 hi = vec2(b.y * u_aspect, b.w);
  vec2 q = abs(p - (lo + hi) * 0.5) - ((hi - lo) * 0.5 - radius);
  float d = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius);
  if (chamfer > 0.0) d = min(d, ((p.x - lo.x) + (hi.y - p.y) - chamfer) * 0.7071);
  if (notches > 0.5) {
    d = min(d, length(p - vec2(lo.x - 0.07, 0.2)) - 0.1);
    d = min(d, length(p - vec2(lo.x - 0.1, 0.57)) - 0.13);
  }
  return d;
}

// Soft edge, burning down toward it: full heat 9% of the height in.
float heatOf(float d, float heat) {
  return heat * smoothstep(-0.045, 0.09, d);
}

// A scratch at x, from y0 to y1, as heat added.
float scratch(vec2 uv, float x, float y0, float y1, float width, float amount) {
  float across = 1.0 - smoothstep(0.0, width, abs(uv.x - x));
  float along = smoothstep(y0 - 0.03, y0, uv.y) * (1.0 - smoothstep(y1, y1 + 0.03, uv.y));
  return across * along * amount;
}

void main() {
  vec3 base = texture2D(u_frame, v_uv).rgb;
  // The burst's own coordinates: mirrored or flipped as this burst is.
  vec2 uv = vec2(u_flip.x > 0.0 ? v_uv.x : 1.0 - v_uv.x, u_flip.y > 0.0 ? v_uv.y : 1.0 - v_uv.y);
  vec2 p = vec2(uv.x * u_aspect, uv.y);

  float h = heatOf(inside(p, u_shape, u_style.y, u_style.z, u_style.w), u_style.x);
  if (u_extraHeat > 0.0) {
    h = max(h, heatOf(inside(p, u_extra, 0.04, 0.0, 0.0), u_extraHeat));
  }

  // Scratches, fixed on the film where the reference has them. They let more
  // light through, so they read yellow on orange and bright red on red.
  float lit = smoothstep(0.02, 0.2, h);
  float s = scratch(uv, 0.277, -1.0, 2.0, 0.003, 0.8)
    + scratch(uv, 0.475, -1.0, 2.0, 0.0016, 0.12)
    + scratch(uv, 0.725, -1.0, 0.55, 0.003, 0.8)
    + scratch(uv, 0.725, 0.55, 2.0, 0.0018, 0.2)
    + scratch(uv, 0.768, -1.0, 0.5, 0.0016, 0.15)
    + scratch(uv, 0.792, -1.0, 0.5, 0.0026, 0.6)
    + scratch(uv, 0.81, -1.0, 2.0, 0.0014, 0.08)
    + scratch(uv, 0.435, 0.6, 0.78, 0.0018, 0.2)
    + scratch(uv, 0.445, 0.6, 0.78, 0.0018, 0.2);
  h += s * lit;

  // Dust, new every film frame: sparse pale specks, and rarer dark ones.
  vec2 grid = uv * vec2(240.0, 135.0);
  vec2 cell = floor(grid);
  float n = hash(cell.x * 0.37 + cell.y * 91.3 + u_step * 57.0);
  float speck = 1.0 - smoothstep(0.15, 0.4, length(fract(grid) - 0.5));
  h += step(0.9988, n) * speck * 0.3 * lit;
  h *= 1.0 - step(n, 0.00015) * speck * 0.7;

  vec3 leak = heatColour(h) * u_strength;
  gl_FragColor = vec4(1.0 - (1.0 - base) * (1.0 - leak), 1.0);
}
`

export interface LightLeakDrawOptions {
  settings: LightLeakSettings
}

export type LightLeakRenderer = CameraEffectRenderer<LightLeakDrawOptions>

/** A repeatable random number in 0 to 1 for a burst. */
const burstRandom = (index: number, salt: number) => {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * The film at this moment: the burst's keyframe, how this burst is turned
 * (mirrored, flipped, played backwards), and the film frame for dust. Null
 * between bursts. From the wall clock, so the projector and the operator's
 * previews flash together.
 */
export const lightLeakMoment = (settings: LightLeakSettings, now = Date.now()) => {
  const pace = settings.speed / 100
  const burst = BURST_SECONDS / pace
  const cycle = burst + settings.rest
  const seconds = now / 1000
  const index = Math.floor(seconds / cycle)
  const into = seconds - index * cycle
  if (into >= burst) return null
  // Stepped to whole film frames, as film moves through a gate.
  const filmFrame = Math.floor(into * pace * FILM_FPS)
  const backwards = burstRandom(index, 3) < 0.35
  let at = filmFrame / FILM_FPS
  if (backwards) at = Math.max(0, BURST_SECONDS - 0.02 - at)
  let keyframe = BURST[0]!
  for (const frame of BURST) if (frame.at <= at) keyframe = frame
  return {
    keyframe,
    mirror: burstRandom(index, 1) < 0.5,
    flip: burstRandom(index, 2) < 0.25,
    step: (index * 97 + filmFrame) % 1000,
  }
}

/**
 * Sets the canvas up for the light leak, or returns null where WebGL is not
 * available; the caller then shows the plain feed.
 */
export const createLightLeakRenderer = (
  canvas: HTMLCanvasElement
): LightLeakRenderer | null => {
  const opened = openCameraCanvas(canvas)
  if (!opened) return null
  const { gl, link, uploadFrame, release } = opened
  const program = link(SCREEN_VERTEX_SHADER, LIGHT_LEAK_SHADER)
  if (!program) {
    release()
    return null
  }
  gl.useProgram(program)
  gl.uniform1i(gl.getUniformLocation(program, "u_frame"), 0)
  const uniform = (name: string) => gl.getUniformLocation(program, `u_${name}`)
  const u = {
    shape: uniform("shape"),
    style: uniform("style"),
    extra: uniform("extra"),
    extraHeat: uniform("extraHeat"),
    flip: uniform("flip"),
    step: uniform("step"),
    strength: uniform("strength"),
    aspect: uniform("aspect"),
  }

  const draw = (video: HTMLVideoElement, { settings }: LightLeakDrawOptions) => {
    // Between bursts there is nothing to add, so the frame is not uploaded or
    // drawn and the plain video shows instead: with the default rest, about
    // two thirds of the time.
    const moment = lightLeakMoment(settings)
    const shape = moment?.keyframe.shape
    if (!moment || !shape) return false
    const frame = uploadFrame(video)
    if (!frame) return false
    gl.viewport(0, 0, frame.width, frame.height)
    const { extra } = moment.keyframe
    gl.uniform4f(u.shape, shape.x0, shape.x1, shape.y0, shape.y1)
    gl.uniform4f(
      u.style,
      shape.heat,
      shape.radius ?? 0.03,
      shape.chamfer ?? 0,
      shape.notches ? 1 : 0
    )
    gl.uniform4f(u.extra, extra?.x0 ?? 0, extra?.x1 ?? 0, extra?.y0 ?? 0, extra?.y1 ?? 0)
    gl.uniform1f(u.extraHeat, extra?.heat ?? 0)
    gl.uniform2f(u.flip, moment.mirror ? -1 : 1, moment.flip ? -1 : 1)
    gl.uniform1f(u.step, moment.step)
    gl.uniform1f(u.strength, settings.strength / 100)
    gl.uniform1f(u.aspect, frame.aspect)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  return { draw, dispose: release }
}
