/**
 * Generates the NSIS installer bitmaps from brand assets already in the repo.
 *
 * Run from the repo root:  node src-tauri/installer/generate-assets.mjs
 *
 * NSIS/MUI2 will only load uncompressed 24-bit BMPs, so we render with sharp and
 * write the BMP container by hand rather than trusting a converter to drop alpha.
 */
import sharp from "sharp"
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")
const TILES = join(ROOT, "public", "collage", "thumbs")
const LOGO_VUE = join(ROOT, "app", "components", "svgs", "CoWLogo.vue")

const BG = { r: 0x0b, g: 0x11, b: 0x20 } // matches .auth-layout dark background
const PURPLE = "#A855F7"

/* ---------- brand lockup, lifted straight from the Vue component ---------- */

function logoSvg(width) {
  const src = readFileSync(LOGO_VUE, "utf8")
  const paths = [...src.matchAll(/<path\s+d="([^"]+)"/g)].map((m) => m[1])
  if (paths.length < 2) {
    throw new Error(`expected 2 paths in CoWLogo.vue, found ${paths.length}`)
  }
  const [mark, wordmark] = paths
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(
      (width * 63) / 295
    )}" viewBox="0 0 295 63">
       <path d="${mark}" fill="${PURPLE}"/>
       <path d="${wordmark}" fill="#FFFFFF"/>
     </svg>`
  )
}

/* ---------- the rotated slide mosaic ---------- */

async function mosaic(W, H, { angle, tileW, tileH, gap, coverTo }) {
  const files = readdirSync(TILES)
    .filter((f) => f.endsWith(".webp"))
    .sort((a, b) => {
      const n = (s) => parseInt(s.match(/(\d+)/)[1], 10)
      return n(a) - n(b)
    })

  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const stepX = tileW + gap
  const stepY = tileH + gap

  // Walk a lattice in unrotated space, rotate each point, keep what lands on canvas.
  const layers = []
  let n = 0
  for (let j = -4; j <= 6; j++) {
    for (let i = -4; i <= 8; i++) {
      const ux = i * stepX
      const uy = j * stepY
      const x = ux * cos - uy * sin + W * 0.16
      const y = ux * sin + uy * cos + H * 0.5

      if (x < -tileW * 1.4 || x > coverTo + tileW || y < -tileH * 1.6 || y > H + tileH * 1.6) {
        continue
      }

      const file = files[n++ % files.length]
      const tile = await sharp(join(TILES, file))
        .resize(tileW, tileH, { fit: "cover" })
        .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      const meta = await sharp(tile).metadata()

      layers.push({
        input: tile,
        left: Math.round(x - meta.width / 2),
        top: Math.round(y - meta.height / 2),
      })
    }
  }
  return layers
}

/* ---------- scrim: fades the mosaic out so the logo sits on clean dark ---------- */

function scrim(W, H, { start, end }) {
  const px = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.min(1, Math.max(0, (x - start) / (end - start)))
      const a = Math.round(255 * (t * t * (3 - 2 * t))) // smoothstep
      const o = (y * W + x) * 4
      px[o] = BG.r
      px[o + 1] = BG.g
      px[o + 2] = BG.b
      px[o + 3] = a
    }
  }
  return { input: px, raw: { width: W, height: H, channels: 4 }, left: 0, top: 0 }
}

/* ---------- 24-bit BI_RGB BMP writer ---------- */

function writeBmp24(path, rgb, W, H) {
  const rowSize = Math.ceil((W * 3) / 4) * 4
  const pixels = rowSize * H
  const buf = Buffer.alloc(54 + pixels)

  buf.write("BM", 0)
  buf.writeUInt32LE(54 + pixels, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(W, 18)
  buf.writeInt32LE(H, 22) // positive => bottom-up rows
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(0, 30) // BI_RGB, uncompressed
  buf.writeUInt32LE(pixels, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)

  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 3
    const dst = 54 + y * rowSize
    for (let x = 0; x < W; x++) {
      buf[dst + x * 3] = rgb[src + x * 3 + 2] // B
      buf[dst + x * 3 + 1] = rgb[src + x * 3 + 1] // G
      buf[dst + x * 3 + 2] = rgb[src + x * 3] // R
    }
  }
  writeFileSync(path, buf)
  console.log(`  ${path.replace(ROOT + "/", "")}  ${W}x${H}  ${buf.length} bytes`)
}

async function flatten(W, H, layers, out) {
  const { data } = await sharp({
    create: { width: W, height: H, channels: 3, background: BG },
  })
    .composite(layers)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  writeBmp24(join(HERE, out), data, W, H)
}

/* ---------- welcome page: the full 499x314 MUI inner dialog ---------- */

// The installer picks the bitmap whose scale matches the Windows display
// scaling (see CoWSetScaledImage in installer.nsi), so every size is rendered
// from the vector logo and full-res tiles rather than upscaled.
const SCALES = [100, 125, 150, 200]

async function welcome(scale) {
  const s = scale / 100
  const W = Math.round(499 * s)
  const H = Math.round(314 * s)
  const logoW = Math.round(208 * s)
  const logo = logoSvg(logoW)
  const logoH = Math.round((logoW * 63) / 295)

  await flatten(
    W,
    H,
    [
      ...(await mosaic(W, H, {
        angle: -28,
        tileW: Math.round(152 * s),
        tileH: Math.round(86 * s),
        gap: Math.round(10 * s),
        coverTo: W * 0.58,
      })),
      scrim(W, H, { start: W * 0.16, end: W * 0.5 }),
      { input: logo, left: W - logoW - Math.round(32 * s), top: Math.round(H / 2 - logoH / 2 - 8 * s) },
    ],
    `welcome-${scale}.bmp`
  )
}

/* ---------- header strip shown on the progress page ---------- */

async function header(scale) {
  const s = scale / 100
  const W = Math.round(150 * s)
  const H = Math.round(57 * s)
  const logoW = Math.round(116 * s)
  const logo = logoSvg(logoW)
  const logoH = Math.round((logoW * 63) / 295)
  await flatten(
    W,
    H,
    [{ input: logo, left: Math.round((W - logoW) / 2), top: Math.round((H - logoH) / 2) }],
    `header-${scale}.bmp`
  )
}

console.log("Generating NSIS installer bitmaps...")
for (const scale of SCALES) {
  await welcome(scale)
  await header(scale)
}
// tauri.conf.json points MUI at the 100% files under their plain names.
copyFileSync(join(HERE, "welcome-100.bmp"), join(HERE, "welcome.bmp"))
copyFileSync(join(HERE, "header-100.bmp"), join(HERE, "header.bmp"))
console.log("Done.")
