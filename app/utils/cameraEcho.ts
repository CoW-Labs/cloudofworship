import type { CameraEchoSettings } from "~/types"
import type { PersonMask } from "~/utils/personSegmenter"

/**
 * The camera slide's "Main character echo": the people on screen repeated in
 * fading copies to one or both sides, each with a red/cyan fringe, as seen on
 * concert broadcasts.
 *
 * One WebGL pass per camera frame: the frame is uploaded once and the shader
 * samples it at each copy's offset. With a person outline (see
 * personSegmenter) a copy is the people only, laid behind the real ones. With
 * none ("whole picture") a copy only brightens what is under it (lighten
 * blend), so a lit singer echoes across a dark stage while the dark parts of a
 * copy never dim the original. Canvas 2D would need a draw per copy plus
 * offscreen passes for the fringe, which falls to the CPU on laptops whose GPU
 * Chrome has blocklisted.
 */

/** The largest frame drawn; a 4K capture card is scaled down to this. */
const MAX_WIDTH = 1920
/** The shader's loop bound; the settings never ask for more copies a side. */
const MAX_COPIES = 4

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  // Texture row 0 is the top of the picture, clip-space y = 1 is the top.
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform float u_step;
uniform float u_fringe;
uniform float u_strength;
uniform float u_falloff;
uniform int u_copies;
uniform int u_people;
uniform int u_both;
uniform vec2 u_maskScale;
uniform vec2 u_maskOffset;
varying vec2 v_uv;

// How much of a person is at uv (0 to 1), read from the outline grid. Past
// the frame's edge there is nobody.
float personAt(vec2 uv) {
  float inside = step(0.0, uv.x) * step(uv.x, 1.0);
  float p = texture2D(u_mask, uv * u_maskScale + u_maskOffset).r;
  return smoothstep(0.35, 0.65, p) * inside;
}

// The picture shifted sideways by d (a share of the width), with its red and
// blue parted. Past the frame's edge there is nothing to echo (clamping would
// smear the edge column across the screen).
vec3 copyAt(float d) {
  vec2 uv = vec2(v_uv.x - d, v_uv.y);
  float inside = step(0.0, uv.x) * step(uv.x, 1.0);
  float r = texture2D(u_frame, vec2(uv.x + u_fringe, uv.y)).r;
  float g = texture2D(u_frame, uv).g;
  float b = texture2D(u_frame, vec2(uv.x - u_fringe, uv.y)).b;
  return vec3(r, g, b) * inside;
}

// Lays one copy, shifted by d, over the colour so far.
vec3 echo(vec3 color, float d, float a) {
  if (u_people == 1) {
    // Each channel takes its own shifted outline, which gives the copy its
    // red and cyan edges.
    float x = v_uv.x - d;
    vec3 cut = vec3(
      personAt(vec2(x + u_fringe, v_uv.y)),
      personAt(vec2(x, v_uv.y)),
      personAt(vec2(x - u_fringe, v_uv.y))
    );
    return mix(color, copyAt(d), cut * a);
  }
  return mix(color, max(color, copyAt(d)), a);
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
    color = echo(color, u_step * fi, a);
    if (u_both == 1) color = echo(color, -u_step * fi, a);
  }
  // The real people stay in front of their copies.
  if (u_people == 1) color = mix(color, base, personAt(v_uv));
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

export interface EchoRenderer {
  /** Draws the video's current frame. False when there is no frame yet. */
  draw: (video: HTMLVideoElement, options: EchoDrawOptions) => boolean
  dispose: () => void
}

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Camera echo shader:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

const makeTexture = (gl: WebGLRenderingContext, unit: number) => {
  gl.activeTexture(gl.TEXTURE0 + unit)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // Camera frames are rarely a power of two, which WebGL 1 only samples with
  // clamped edges and no mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}

/**
 * Sets the canvas up for the echo, or returns null where WebGL is not
 * available; the caller then shows the plain feed.
 */
export const createEchoRenderer = (
  canvas: HTMLCanvasElement
): EchoRenderer | null => {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  })
  if (!gl) return null

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Camera echo program:", gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)

  // Two triangles covering the canvas.
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  const position = gl.getAttribLocation(program, "a_position")
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const maskTexture = makeTexture(gl, 1)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(4)
  )
  const frameTexture = makeTexture(gl, 0)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    step: uniform("u_step"),
    fringe: uniform("u_fringe"),
    strength: uniform("u_strength"),
    falloff: uniform("u_falloff"),
    copies: uniform("u_copies"),
    people: uniform("u_people"),
    both: uniform("u_both"),
    maskScale: uniform("u_maskScale"),
    maskOffset: uniform("u_maskOffset"),
  }
  gl.uniform1i(uniform("u_frame"), 0)
  gl.uniform1i(uniform("u_mask"), 1)

  let textureWidth = 0
  let textureHeight = 0
  let maskVersion = -1

  const uploadMask = (mask: PersonMask) => {
    if (mask.version === maskVersion) return
    gl.activeTexture(gl.TEXTURE1)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      mask.width,
      mask.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      mask.pixels
    )
    gl.activeTexture(gl.TEXTURE0)
    maskVersion = mask.version
    // The outline grid's corners sit on the picture's corners (BodyPix reads
    // sizes of 16n + 1), not half a cell in as texture sampling assumes.
    const { width, height } = mask
    gl.uniform2f(u.maskScale, (width - 1) / width, (height - 1) / height)
    gl.uniform2f(u.maskOffset, 0.5 / width, 0.5 / height)
  }

  const draw = (video: HTMLVideoElement, options: EchoDrawOptions) => {
    const { videoWidth, videoHeight } = video
    if (
      gl.isContextLost() ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !videoWidth ||
      !videoHeight
    ) {
      return false
    }

    // The canvas keeps the camera's own shape, so CSS object-fit crops or
    // letterboxes it exactly as it does the video. It is drawn no larger than
    // it shows on screen: the operator's thumbnails then shade a few hundred
    // pixels across rather than a full 1080p frame each.
    const aspect = videoWidth / videoHeight
    const shownWidth =
      Math.max(canvas.clientWidth, canvas.clientHeight * aspect) *
      (window.devicePixelRatio || 1)
    const scale = Math.min(
      1,
      MAX_WIDTH / videoWidth,
      shownWidth > 0 ? shownWidth / videoWidth : 1
    )
    const width = Math.round(videoWidth * scale)
    const height = Math.round(videoHeight * scale)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }

    // Reallocate only when the camera's size changes; otherwise refill.
    if (videoWidth !== textureWidth || videoHeight !== textureHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video)
      textureWidth = videoWidth
      textureHeight = videoHeight
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGB, gl.UNSIGNED_BYTE, video)
    }

    const { settings, mirrored, mask } = options
    const people = settings.subject === "people"
    if (people && mask) uploadMask(mask)
    const copies = people && !mask ? 0 : Math.min(MAX_COPIES, settings.copies)

    // Left and right are the screen's, so a mirrored canvas draws them flipped.
    const toRight = (settings.direction !== "left") !== mirrored
    const step = settings.spacing / 100
    gl.uniform1f(u.step, toRight ? step : -step)
    gl.uniform1i(u.both, settings.direction === "both" ? 1 : 0)
    gl.uniform1f(u.fringe, settings.fringe / 100)
    gl.uniform1f(u.strength, settings.strength / 100)
    gl.uniform1f(u.falloff, settings.falloff / 100)
    gl.uniform1i(u.copies, copies)
    gl.uniform1i(u.people, people && mask ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  const dispose = () => {
    gl.deleteTexture(frameTexture)
    gl.deleteTexture(maskTexture)
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    // Browsers cap live WebGL contexts per page (16 in Chrome) and drop the
    // oldest past it, so give this one back now rather than at GC.
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }

  return { draw, dispose }
}
