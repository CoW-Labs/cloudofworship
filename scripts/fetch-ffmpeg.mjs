#!/usr/bin/env node
// Puts the FFmpeg sidecar the desktop app bundles at
// src-tauri/binaries/ffmpeg-<target-triple>[.exe], where Tauri's
// `bundle.externalBin` expects it. Runs before `tauri dev` / `tauri build` and
// does nothing when the binary is already there.
//
// Only LGPL builds are used (no --enable-gpl), so the app can ship FFmpeg
// alongside its own closed source; see src-tauri/licenses/ffmpeg.txt.
//
//  - Windows: downloads BtbN's LGPL static build of the FFmpeg 8.1 release
//    line. It has no libx264, so the stream picks a hardware/Media Foundation
//    H.264 encoder at runtime (see `video_encoder_args` in stream/mod.rs).
//  - macOS: builds FFmpeg 8.1.2 from source, minimal and LGPL, linking only
//    system frameworks (VideoToolbox for H.264, AVFoundation for audio). Takes
//    a few minutes the first time; the result is cached.
//  - Linux: copies the system FFmpeg (desktop streaming isn't supported there
//    yet; this only keeps the bundle buildable).

import { execFileSync } from "node:child_process"
import { copyFileSync, chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { cpus, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const FFMPEG_VERSION = "8.1.2"
const WINDOWS_BUILD_URL =
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-lgpl-8.1.zip"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const binDir = join(root, "src-tauri", "binaries")
const cacheDir = join(root, "node_modules", ".cache", "cow-ffmpeg")

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options })

// Tauri passes the build target to before*Command; otherwise use the host's.
const targetTriple = () => {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE
  const info = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
  const host = info.split("\n").find((line) => line.startsWith("host:"))
  if (!host) throw new Error("Could not determine the Rust host target.")
  return host.slice("host:".length).trim()
}

const download = (url, destination) => {
  console.log(`[ffmpeg] downloading ${url}`)
  run("curl", ["-fL", "--retry", "3", "-o", destination, url])
}

const fetchWindows = (output) => {
  mkdirSync(cacheDir, { recursive: true })
  const archive = join(cacheDir, "ffmpeg-win64-lgpl.zip")
  if (!existsSync(archive)) download(WINDOWS_BUILD_URL, archive)
  const extracted = join(cacheDir, "win64")
  rmSync(extracted, { recursive: true, force: true })
  mkdirSync(extracted, { recursive: true })
  // bsdtar (Windows 10+, macOS) reads zip archives.
  run("tar", ["-xf", archive, "-C", extracted])
  const [folder] = readdirSync(extracted)
  copyFileSync(join(extracted, folder, "bin", "ffmpeg.exe"), output)
}

const MACOS_CONFIGURE_FLAGS = [
  "--disable-autodetect",
  "--disable-doc",
  "--disable-debug",
  "--disable-ffplay",
  "--disable-ffprobe",
  "--enable-videotoolbox",
  "--enable-audiotoolbox",
  "--enable-avfoundation",
  "--enable-coreimage",
  "--enable-securetransport",
  "--enable-zlib",
  "--enable-pthreads",
]

const buildMacArch = (arch) => {
  const built = join(cacheDir, `ffmpeg-${FFMPEG_VERSION}-${arch}`)
  if (existsSync(built)) return built
  mkdirSync(cacheDir, { recursive: true })
  const tarball = join(cacheDir, `ffmpeg-${FFMPEG_VERSION}.tar.xz`)
  if (!existsSync(tarball)) {
    download(`https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz`, tarball)
  }
  const work = join(tmpdir(), `cow-ffmpeg-${arch}-${process.pid}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  run("tar", ["-xf", tarball, "-C", work])
  const source = join(work, `ffmpeg-${FFMPEG_VERSION}`)
  const archFlags = `-arch ${arch} -mmacosx-version-min=13.0`
  const cross =
    arch === process.arch.replace("x64", "x86_64")
      ? []
      : ["--enable-cross-compile", `--arch=${arch}`, "--target-os=darwin", "--disable-x86asm"]
  console.log(`[ffmpeg] building FFmpeg ${FFMPEG_VERSION} for macOS ${arch} (one-time, a few minutes)…`)
  run(
    "./configure",
    [...MACOS_CONFIGURE_FLAGS, ...cross, `--extra-cflags=${archFlags}`, `--extra-ldflags=${archFlags}`],
    { cwd: source }
  )
  run("make", [`-j${cpus().length}`, "ffmpeg"], { cwd: source })
  copyFileSync(join(source, "ffmpeg"), built)
  rmSync(work, { recursive: true, force: true })
  return built
}

const buildMac = (triple, output) => {
  if (triple.startsWith("universal")) {
    const arm = buildMacArch("arm64")
    const intel = buildMacArch("x86_64")
    run("lipo", ["-create", arm, intel, "-output", output])
  } else {
    copyFileSync(buildMacArch(triple.startsWith("aarch64") ? "arm64" : "x86_64"), output)
  }
}

const copySystem = (output) => {
  const found = execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim()
  if (!found) throw new Error("Install FFmpeg (e.g. `apt install ffmpeg`) to build the Linux bundle.")
  copyFileSync(found, output)
}

const triple = targetTriple()
const output = join(binDir, `ffmpeg-${triple}${triple.includes("windows") ? ".exe" : ""}`)
if (existsSync(output) && statSync(output).size > 0) {
  process.exit(0)
}
mkdirSync(binDir, { recursive: true })
if (triple.includes("windows")) fetchWindows(output)
else if (triple.includes("apple-darwin")) buildMac(triple, output)
else copySystem(output)
chmodSync(output, 0o755)
console.log(`[ffmpeg] ready: ${output}`)
