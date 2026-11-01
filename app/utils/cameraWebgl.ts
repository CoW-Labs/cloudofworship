/**
 * What the camera effects' WebGL renderers share (see cameraEcho and
 * cameraLightLeak): one context per canvas, the corner buffer every pass
 * draws, and the camera frame uploaded once per draw at no more than the
 * canvas shows.
 */

/** The largest frame drawn; a 4K capture card is scaled down to this. */
const MAX_WIDTH = 1920

export interface CameraEffectRenderer<Options> {
  /**
   * Draws the video's current frame. False when there is no frame yet, or
   * the effect has nothing to add to it; the caller then shows the video.
   */
  draw: (video: HTMLVideoElement, options: Options) => boolean
  dispose: () => void
}

export const SCREEN_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  // Texture row 0 is the top of the picture, clip-space y = 1 is the top.
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// Drawn into a texture, whose first row is then read as the top of the
// picture like the frame's, so no flip.
export const TEXTURE_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

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
    console.warn("Camera effect shader:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export const makeTexture = (
  gl: WebGLRenderingContext,
  unit: number,
  filter: number = gl.LINEAR
) => {
  gl.activeTexture(gl.TEXTURE0 + unit)
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // Camera frames are rarely a power of two, which WebGL 1 only samples with
  // clamped edges and no mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
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
  return texture
}

/**
 * A canvas set up for camera effects: its context, a `link` for the passes'
 * programs, the camera frame's texture on unit 0, and `release` for all of
 * it. Null where WebGL is not available; the caller then shows the plain feed.
 */
export const openCameraCanvas = (canvas: HTMLCanvasElement) => {
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

  const shaders: WebGLShader[] = []
  const programs: WebGLProgram[] = []
  // Every pass draws the same two triangles, so a_position is pinned to slot
  // 0 in each program and one buffer serves them all.
  const link = (vertexSource: string, fragmentSource: string) => {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return null
    shaders.push(vertex, fragment)
    programs.push(program)
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.bindAttribLocation(program, 0, "a_position")
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Camera effect program:", gl.getProgramInfoLog(program))
      return null
    }
    return program
  }

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  let frameTexture: WebGLTexture | null = null
  let textureWidth = 0
  let textureHeight = 0

  // The canvas's size on screen, kept up by an observer: reading it every
  // frame could make the browser lay the page out again mid-frame.
  let shownCssWidth = canvas.clientWidth
  let shownCssHeight = canvas.clientHeight
  const sizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(([entry]) => {
          if (!entry) return
          shownCssWidth = entry.contentRect.width
          shownCssHeight = entry.contentRect.height
        })
  sizeObserver?.observe(canvas)

  /**
   * Uploads the video's current frame to unit 0 and sizes the canvas to it.
   * Call after creating any other textures, so unit 0 is left active with the
   * frame bound. Null when there is no frame yet.
   */
  const uploadFrame = (video: HTMLVideoElement) => {
    const { videoWidth, videoHeight } = video
    if (
      gl.isContextLost() ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !videoWidth ||
      !videoHeight
    ) {
      return null
    }
    frameTexture ??= makeTexture(gl, 0)

    // The canvas keeps the camera's own shape, so CSS object-fit crops or
    // letterboxes it exactly as it does the video. It is drawn no larger than
    // it shows on screen: the operator's thumbnails then shade a few hundred
    // pixels across rather than a full 1080p frame each.
    const aspect = videoWidth / videoHeight
    const shownWidth =
      Math.max(shownCssWidth, shownCssHeight * aspect) *
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
    }

    // Reallocate only when the camera's size changes; otherwise refill.
    if (videoWidth !== textureWidth || videoHeight !== textureHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video)
      textureWidth = videoWidth
      textureHeight = videoHeight
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGB, gl.UNSIGNED_BYTE, video)
    }
    return { width, height, aspect }
  }

  const release = () => {
    sizeObserver?.disconnect()
    gl.deleteTexture(frameTexture)
    gl.deleteBuffer(buffer)
    programs.forEach((program) => gl.deleteProgram(program))
    shaders.forEach((shader) => gl.deleteShader(shader))
    // Browsers cap live WebGL contexts per page (16 in Chrome) and drop the
    // oldest past it, so give this one back now rather than at GC. The canvas
    // cannot draw again after this; a new effect needs a new canvas.
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }

  return { gl, link, uploadFrame, release }
}
