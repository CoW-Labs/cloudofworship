import type { CameraEchoSettings } from "~/types"
import { keepMainPerson, type PersonMask } from "~/utils/personSegmenter"
import {
  makeTexture,
  openCameraCanvas,
  SCREEN_VERTEX_SHADER,
  TEXTURE_VERTEX_SHADER,
  type CameraEffectRenderer,
} from "~/utils/cameraWebgl"

/**
 * The camera slide's "Main character echo": the person on screen repeated in
 * fading copies to one or both sides, each with a red/cyan fringe, as seen on
 * concert broadcasts.
 *
 * Each camera frame is uploaded once and drawn in up to three WebGL passes:
 *
 * 1. Cells: one pixel per cell of the person detector's outline (about 31 × 17
 *    for a 16:9 picture), holding the cell's average colour and how much of a
 *    person it holds. A few hundred pixels.
 * 2. Snap: the outline redrawn at a third of the canvas's size, following the
 *    colour edges in the picture. Stretched as it is, the detector's grid
 *    (about 60 px a cell at 1080p) is a soft blob that takes some of the wall
 *    along; here each pixel takes a vote of the 3 × 3 nearest cells, weighted
 *    by how near each is and how alike its colour is to the pixel's (joint
 *    bilateral upsampling), so a pale suit against a blue wall gets a clean
 *    edge. Ten texture reads a pixel, on at most 480 × 270 pixels.
 * 3. Echo: the picture, with each copy sampled at its offset and cut out by
 *    the snapped outline, laid behind the real person.
 *
 * With no outline ("whole picture") only the last pass runs, and a copy only
 * brightens what is under it (lighten blend), so a lit singer echoes across a
 * dark stage while the dark parts of a copy never dim the original. Canvas 2D
 * would need a draw per copy plus offscreen passes for the fringe, which falls
 * to the CPU on laptops whose GPU Chrome has blocklisted.
 */

/** The shader's loop bound; the settings never ask for more copies a side. */
const MAX_COPIES = 4
/** The snapped outline's width bounds; it is a third of the canvas's width. */
const SNAP_MIN_WIDTH = 64
const SNAP_MAX_WIDTH = 480

/** Texture units: the frame, the detector's outline, its cells, the snap. */
const FRAME_UNIT = 0
const MASK_UNIT = 1
const CELL_UNIT = 2
const SNAP_UNIT = 3

// The detector's grid has its corner cells on the picture's corners (BodyPix
// reads sizes of 16n + 1), so cell i sits at i / (cells - 1) of the picture.
const CELL_SHADER = `
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform vec2 u_cells;
varying vec2 v_uv;
void main() {
  vec2 cell = floor(v_uv * u_cells);
  vec2 centre = cell / (u_cells - 1.0);
  vec2 span = 0.25 / (u_cells - 1.0);
  vec3 sum = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      sum += texture2D(u_frame, centre + (vec2(float(i), float(j)) - 1.5) * span).rgb;
    }
  }
  float person = texture2D(u_mask, (cell + 0.5) / u_cells).r;
  gl_FragColor = vec4(sum / 16.0, person);
}
`

const SNAP_SHADER = `
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_cell;
uniform vec2 u_cells;
varying vec2 v_uv;
void main() {
  vec3 here = texture2D(u_frame, v_uv).rgb;
  vec2 g = v_uv * (u_cells - 1.0);
  vec2 near = floor(g + 0.5);
  float sum = 0.0;
  float weights = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = clamp(near + vec2(float(i), float(j)), vec2(0.0), u_cells - 1.0);
      vec4 c = texture2D(u_cell, (cell + 0.5) / u_cells);
      vec3 dc = here - c.rgb;
      vec2 dd = g - cell;
      // Nearness: a cell's own width as the spread. Likeness: colours a sixth
      // of the range apart count for little. The small floor keeps a pixel
      // unlike every cell (a shadow, say) on nearness alone.
      float w = exp(-dot(dd, dd) * 0.5) * (exp(-dot(dc, dc) * 22.0) + 0.001);
      sum += w * c.a;
      weights += w;
    }
  }
  gl_FragColor = vec4(vec3(sum / weights), 1.0);
}
`

const ECHO_SHADER = `
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform float u_gap;
uniform float u_step;
uniform float u_rise;
uniform float u_scale;
uniform float u_fringe;
uniform float u_strength;
uniform float u_falloff;
uniform int u_copies;
uniform int u_people;
uniform int u_both;
varying vec2 v_uv;

// How much of a person is at uv (0 to 1), from the snapped outline. Past the
// frame's sides there is nobody.
float personAt(vec2 uv, float lo, float hi) {
  float inside = step(0.0, uv.x) * step(uv.x, 1.0);
  return smoothstep(lo, hi, texture2D(u_mask, uv).r) * inside;
}

// Where a copy shifted d across reads from. Copies march along a line that
// climbs u_rise (a share of the height per share of the width) as they go out,
// and are enlarged by u_scale about the bottom middle of the picture.
vec2 sourceOf(float d) {
  vec2 q = vec2(v_uv.x - d, v_uv.y + abs(d) * u_rise);
  return vec2((q.x - 0.5) / u_scale + 0.5, 1.0 - (1.0 - q.y) / u_scale);
}

// The picture at q with its red and blue parted. Past the frame's sides there
// is nothing to echo (clamping would smear the edge column across the screen).
vec3 copyAt(vec2 q) {
  float inside = step(0.0, q.x) * step(q.x, 1.0);
  float r = texture2D(u_frame, vec2(q.x + u_fringe, q.y)).r;
  float g = texture2D(u_frame, q).g;
  float b = texture2D(u_frame, vec2(q.x - u_fringe, q.y)).b;
  return vec3(r, g, b) * inside;
}

// Lays one copy, shifted by d, over the colour so far.
vec3 echo(vec3 color, float d, float a) {
  vec2 q = sourceOf(d);
  // A copy that climbs reads below the picture at its foot. It fades out over
  // the last rows instead of smearing the bottom row up the screen.
  a *= 1.0 - smoothstep(0.94, 1.0, q.y);
  if (u_people == 1) {
    // Each channel takes its own shifted outline, which gives the copy its
    // red and cyan edges. Copies read the outline a little tight, so they
    // carry less of the background round a person.
    vec3 cut = vec3(
      personAt(vec2(q.x + u_fringe, q.y), 0.45, 0.75),
      personAt(q, 0.45, 0.75),
      personAt(vec2(q.x - u_fringe, q.y), 0.45, 0.75)
    ) * a;
    // Most of the screen holds no copy. Skipping the picture's three reads
    // there leaves the colour exactly as it is.
    if (cut.r + cut.g + cut.b <= 0.0) return color;
    return mix(color, copyAt(q), cut);
  }
  return mix(color, max(color, copyAt(q)), a);
}

void main() {
  vec3 base = texture2D(u_frame, v_uv).rgb;
  vec3 color = base;
  // Farthest first, so a nearer copy sits over a farther one.
  for (int k = 0; k < ${MAX_COPIES}; k++) {
    int i = ${MAX_COPIES} - k;
    if (i > u_copies) continue;
    float fi = float(i);
    float a = u_strength * pow(u_falloff, fi - 1.0);
    float d = u_gap + u_step * (fi - 1.0);
    color = echo(color, d, a);
    if (u_both == 1) color = echo(color, -d, a);
  }
  // The real person stays in front of their copies, read a little loose so
  // a copy never nicks their edge.
  if (u_people == 1) color = mix(color, base, personAt(v_uv, 0.3, 0.6));
  gl_FragColor = vec4(color, 1.0);
}
`

export interface EchoDrawOptions {
  settings: CameraEchoSettings
  /** The canvas is flipped by CSS, so the copies are drawn the other way. */
  mirrored: boolean
  /**
   * The latest person outline, or null. With `settings.subject` "people" and
   * no outline yet, the plain picture is drawn rather than a whole-picture
   * echo that would then jump to a people-only one.
   */
  mask: PersonMask | null
}

export type EchoRenderer = CameraEffectRenderer<EchoDrawOptions>

/**
 * Sets the canvas up for the echo, or returns null where WebGL is not
 * available; the caller then shows the plain feed.
 */
export const createEchoRenderer = (
  canvas: HTMLCanvasElement
): EchoRenderer | null => {
  const opened = openCameraCanvas(canvas)
  if (!opened) return null
  const { gl, link, uploadFrame, release } = opened
  const echoProgram = link(SCREEN_VERTEX_SHADER, ECHO_SHADER)
  const cellProgram = link(TEXTURE_VERTEX_SHADER, CELL_SHADER)
  const snapProgram = link(TEXTURE_VERTEX_SHADER, SNAP_SHADER)
  if (!echoProgram || !cellProgram || !snapProgram) {
    release()
    return null
  }

  const maskTexture = makeTexture(gl, MASK_UNIT, gl.NEAREST)
  const cellTexture = makeTexture(gl, CELL_UNIT, gl.NEAREST)
  const snapTexture = makeTexture(gl, SNAP_UNIT)

  const framebufferFor = (texture: WebGLTexture | null) => {
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return framebuffer
  }
  const cellFramebuffer = framebufferFor(cellTexture)
  const snapFramebuffer = framebufferFor(snapTexture)

  const uniformsOf = <K extends string>(
    program: WebGLProgram,
    names: readonly K[]
  ) =>
    Object.fromEntries(
      names.map((name) => [name, gl.getUniformLocation(program, `u_${name}`)])
    ) as Record<K, WebGLUniformLocation | null>

  const u = uniformsOf(echoProgram, [
    "gap",
    "step",
    "rise",
    "scale",
    "fringe",
    "strength",
    "falloff",
    "copies",
    "people",
    "both",
  ] as const)
  gl.useProgram(echoProgram)
  gl.uniform1i(gl.getUniformLocation(echoProgram, "u_frame"), FRAME_UNIT)
  gl.uniform1i(gl.getUniformLocation(echoProgram, "u_mask"), SNAP_UNIT)

  const cellCells = gl.getUniformLocation(cellProgram, "u_cells")
  gl.useProgram(cellProgram)
  gl.uniform1i(gl.getUniformLocation(cellProgram, "u_frame"), FRAME_UNIT)
  gl.uniform1i(gl.getUniformLocation(cellProgram, "u_mask"), MASK_UNIT)

  const snapCells = gl.getUniformLocation(snapProgram, "u_cells")
  gl.useProgram(snapProgram)
  gl.uniform1i(gl.getUniformLocation(snapProgram, "u_frame"), FRAME_UNIT)
  gl.uniform1i(gl.getUniformLocation(snapProgram, "u_cell"), CELL_UNIT)

  let maskKey = ""
  let maskWidth = 0
  let maskHeight = 0
  let snapWidth = 0
  let snapHeight = 0
  // The cells the main person covered in the last outline, so the choice
  // holds steady between two people of a similar size.
  let lead: Uint8Array | null = null

  const resize = (unit: number, texture: WebGLTexture | null, w: number, h: number) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.activeTexture(gl.TEXTURE0 + FRAME_UNIT)
  }

  const uploadMask = (mask: PersonMask, focus: CameraEchoSettings["focus"]) => {
    const key = `${mask.version}:${focus}`
    if (key === maskKey) return
    maskKey = key
    if (mask.width !== maskWidth || mask.height !== maskHeight) {
      maskWidth = mask.width
      maskHeight = mask.height
      lead = null
      resize(CELL_UNIT, cellTexture, maskWidth, maskHeight)
    }
    let pixels = mask.pixels
    if (focus === "main") {
      const kept = keepMainPerson(mask, lead)
      pixels = kept.pixels
      lead = kept.lead
    }
    gl.activeTexture(gl.TEXTURE0 + MASK_UNIT)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      mask.width,
      mask.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    )
    gl.activeTexture(gl.TEXTURE0 + FRAME_UNIT)
  }

  // Passes 1 and 2: the outline's cells, then the outline snapped to the
  // picture's edges, ready for the echo pass to read.
  const snapOutline = (width: number, height: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellFramebuffer)
    gl.viewport(0, 0, maskWidth, maskHeight)
    gl.useProgram(cellProgram)
    gl.uniform2f(cellCells, maskWidth, maskHeight)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    const w = Math.max(SNAP_MIN_WIDTH, Math.min(SNAP_MAX_WIDTH, Math.round(width / 3)))
    const h = Math.max(1, Math.round((w * height) / width))
    if (w !== snapWidth || h !== snapHeight) {
      snapWidth = w
      snapHeight = h
      resize(SNAP_UNIT, snapTexture, w, h)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, snapFramebuffer)
    gl.viewport(0, 0, w, h)
    gl.useProgram(snapProgram)
    gl.uniform2f(snapCells, maskWidth, maskHeight)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  const draw = (video: HTMLVideoElement, options: EchoDrawOptions) => {
    const frame = uploadFrame(video)
    if (!frame) return false
    const { width, height, aspect } = frame

    const { settings, mirrored, mask } = options
    const people = settings.subject === "people" && !!mask
    const copies =
      settings.subject === "people" && !mask
        ? 0
        : Math.min(MAX_COPIES, settings.copies)
    if (people) {
      uploadMask(mask, settings.focus)
      snapOutline(width, height)
    }

    // Pass 3. Left and right are the screen's, so a mirrored canvas draws
    // them flipped.
    gl.viewport(0, 0, width, height)
    gl.useProgram(echoProgram)
    const side = (settings.direction !== "left") !== mirrored ? 1 : -1
    gl.uniform1f(u.gap, (side * settings.gap) / 100)
    gl.uniform1f(u.step, (side * settings.spacing) / 100)
    // Degrees on screen, so the height-per-width ratio carries the aspect.
    gl.uniform1f(u.rise, Math.tan((settings.rise * Math.PI) / 180) * aspect)
    gl.uniform1f(u.scale, settings.scale / 100)
    gl.uniform1i(u.both, settings.direction === "both" ? 1 : 0)
    gl.uniform1f(u.fringe, settings.fringe / 100)
    gl.uniform1f(u.strength, settings.strength / 100)
    gl.uniform1f(u.falloff, settings.falloff / 100)
    gl.uniform1i(u.copies, copies)
    gl.uniform1i(u.people, people ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  const dispose = () => {
    for (const texture of [maskTexture, cellTexture, snapTexture]) {
      gl.deleteTexture(texture)
    }
    gl.deleteFramebuffer(cellFramebuffer)
    gl.deleteFramebuffer(snapFramebuffer)
    release()
  }

  return { draw, dispose }
}
