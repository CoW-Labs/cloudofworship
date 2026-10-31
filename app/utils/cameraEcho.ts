/**
 * The camera slide's echo effect: the picture repeated in fading copies to one
 * side, each with a red/cyan fringe, as seen on concert broadcasts.
 *
 * One WebGL pass per camera frame: the frame is uploaded once and the shader
 * samples it at each copy's offset. A copy only brightens what is under it
 * (lighten blend), so a lit singer echoes across a dark stage while the dark
 * parts of a copy never dim the original. Canvas 2D would need a draw per copy
 * plus offscreen passes for the fringe, which falls to the CPU on laptops whose
 * GPU Chrome has blocklisted.
 */

/** Gap between copies, as a share of the frame's width. */
const ECHO_STEP = 0.075
/** How far the red and blue of a copy part, as a share of the width. */
const ECHO_FRINGE = 0.0035
/** Strength of each copy, nearest first. */
const ECHO_STRENGTHS = [0.72, 0.5, 0.3] as const
/** The largest frame drawn; a 4K capture card is scaled down to this. */
const MAX_WIDTH = 1920

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
uniform float u_step;
uniform float u_fringe;
uniform vec3 u_strengths;
varying vec2 v_uv;

vec3 copyAt(float index) {
  vec2 uv = vec2(v_uv.x - u_step * index, v_uv.y);
  // Past the frame's edge there is nothing to echo (clamping would smear the
  // edge column across the screen).
  float inside = step(0.0, uv.x) * step(uv.x, 1.0);
  float r = texture2D(u_frame, vec2(uv.x + u_fringe, uv.y)).r;
  float g = texture2D(u_frame, uv).g;
  float b = texture2D(u_frame, vec2(uv.x - u_fringe, uv.y)).b;
  return vec3(r, g, b) * inside;
}

void main() {
  vec3 color = texture2D(u_frame, v_uv).rgb;
  // Farthest first, so a nearer copy sits over a farther one.
  color = mix(color, max(color, copyAt(3.0)), u_strengths.z);
  color = mix(color, max(color, copyAt(2.0)), u_strengths.y);
  color = mix(color, max(color, copyAt(1.0)), u_strengths.x);
  gl_FragColor = vec4(color, 1.0);
}
`

export interface EchoOptions {
  /** The side of the screen the copies trail toward. */
  direction: "left" | "right"
  /** The canvas is flipped by CSS, so the trail is drawn the other way. */
  mirrored: boolean
}

export interface EchoRenderer {
  /** Draws the video's current frame. False when there is no frame yet. */
  draw: (video: HTMLVideoElement, options: EchoOptions) => boolean
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

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // Camera frames are rarely a power of two, which WebGL 1 only samples with
  // clamped edges and no mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const stepLocation = gl.getUniformLocation(program, "u_step")
  gl.uniform1i(gl.getUniformLocation(program, "u_frame"), 0)
  gl.uniform1f(gl.getUniformLocation(program, "u_fringe"), ECHO_FRINGE)
  gl.uniform3f(
    gl.getUniformLocation(program, "u_strengths"),
    ...ECHO_STRENGTHS
  )

  let textureWidth = 0
  let textureHeight = 0

  const draw = (video: HTMLVideoElement, options: EchoOptions) => {
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
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        video
      )
      textureWidth = videoWidth
      textureHeight = videoHeight
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGB, gl.UNSIGNED_BYTE, video)
    }

    const toRight = (options.direction === "right") !== options.mirrored
    gl.uniform1f(stepLocation, toRight ? ECHO_STEP : -ECHO_STEP)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return true
  }

  const dispose = () => {
    gl.deleteTexture(texture)
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
