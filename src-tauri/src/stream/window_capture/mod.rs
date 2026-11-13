//! Captures the live output window's own pixels by its native window handle,
//! so going live needs no picker. The app creates that window, so it asks the
//! OS for exactly that window instead of guessing by title or size. A window
//! capture reads the window's own surface rather than the composited screen,
//! so desktop switches and overlapping windows don't reach the stream.
//!
//! The per-OS part (`macos`: ScreenCaptureKit, `windows`: Windows Graphics
//! Capture) only finds the window and publishes frames of the target size into
//! a shared slot. Frames arrive only when content changes; the shared pacer
//! here re-sends the latest one at the tier's steady frame rate, to one of two
//! outputs:
//!
//! * **Pipe**: tightly packed BGRA frames written to FFmpeg's stdin, which
//!   scales, converts and encodes them.
//! * **Hardware encoder** (macOS): the capture's own GPU surfaces are handed to
//!   VideoToolbox without a CPU copy, and only the compressed H.264 reaches
//!   FFmpeg. See `vt_encoder`.

use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tauri::AppHandle;

use super::{Counters, StreamQuality};

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(target_os = "macos")]
mod vt_encoder;
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use windows as platform;

const LIVE_WINDOW_LABEL: &str = "live-output";
/// A healthy capture delivers its first frame almost immediately.
const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(5);
/// How often the pacer logs capture/encoder health.
const HEALTH_INTERVAL: Duration = Duration::from_secs(10);
/// A frame hand-off slower than this means the encoder or network is behind.
const SLOW_WRITE: Duration = Duration::from_millis(100);

/// One captured picture at the target size.
#[derive(Clone)]
enum Picture {
  /// Tightly packed BGRA, for the pipe.
  Packed(Arc<Vec<u8>>),
  /// The capture's own GPU surface, for the hardware encoder. Holding it keeps
  /// the surface out of the capture's pool, so it is only ever the latest one.
  #[cfg(target_os = "macos")]
  Surface(screencapturekit::cv::CVPixelBuffer),
}

/// The latest picture. Swapped as a whole so the pacer never holds the lock
/// while it hands the picture on.
type LatestFrame = Arc<Mutex<Option<Picture>>>;

/// Called once when capture breaks or never produces a frame.
pub type FailHandler = Arc<dyn Fn(String) + Send + Sync>;

/// What the platform capture needs to publish frames.
struct Sink {
  width: u32,
  height: u32,
  fps: u32,
  /// True when frames go to the in-process hardware encoder as GPU surfaces
  /// rather than to the pipe as packed BGRA.
  hardware: bool,
  latest: LatestFrame,
  /// A recycled buffer for the next packed frame, so a 1080p+ capture doesn't
  /// allocate and free ~8MB thirty-plus times a second.
  spare: Mutex<Option<Vec<u8>>>,
  stop: Arc<AtomicBool>,
  fail: FailHandler,
  /// The first few rejected callbacks, logged if no frame ever arrives.
  rejected: Arc<Mutex<Vec<String>>>,
  /// Live stream stats (new pictures, frames sent and delayed).
  stats: Arc<Counters>,
}

impl Sink {
  /// A buffer to build the next packed frame in, reusing the previous one's
  /// allocation (and its contents) when the pacer is done with it. Callers
  /// overwrite what they need.
  fn buffer(&self) -> Vec<u8> {
    self.spare.lock().unwrap_or_else(|p| p.into_inner()).take().unwrap_or_default()
  }

  fn publish(&self, frame: Vec<u8>) {
    self.replace(Picture::Packed(Arc::new(frame)));
  }

  #[cfg(target_os = "macos")]
  fn publish_surface(&self, surface: screencapturekit::cv::CVPixelBuffer) {
    self.replace(Picture::Surface(surface));
  }

  fn replace(&self, picture: Picture) {
    self.stats.window_frames.fetch_add(1, Ordering::Relaxed);
    let previous = self.latest.lock().unwrap_or_else(|p| p.into_inner()).replace(picture);
    // The pacer clones the Arc while it writes; if it is still holding the old
    // frame we simply let go of ours and allocate next time.
    if let Some(Picture::Packed(old)) = previous {
      if let Ok(buffer) = Arc::try_unwrap(old) {
        *self.spare.lock().unwrap_or_else(|p| p.into_inner()) = Some(buffer);
      }
    }
  }

  fn reject(&self, reason: String) {
    let mut rejected = self.rejected.lock().unwrap_or_else(|p| p.into_inner());
    if rejected.len() < 12 {
      rejected.push(reason);
    }
  }

  /// Reports a capture failure once, however many threads notice it.
  fn fail(&self, message: String) {
    if !self.stop.swap(true, Ordering::AcqRel) {
      (self.fail)(message);
    }
  }
}

/// The live window, found and sized, ready to capture.
pub struct Target {
  native: platform::NativeTarget,
  pub width: u32,
  pub height: u32,
  /// The in-process hardware H.264 encoder, when this machine has one that
  /// can take this size and rate (macOS). `None` means frames go to FFmpeg.
  #[cfg(target_os = "macos")]
  encoder: Option<Arc<vt_encoder::VtEncoder>>,
}

impl Target {
  /// Whether the video is already H.264 by the time it reaches FFmpeg.
  pub fn hardware_encoded(&self) -> bool {
    #[cfg(target_os = "macos")]
    {
      self.encoder.is_some()
    }
    #[cfg(not(target_os = "macos"))]
    {
      false
    }
  }
}

/// Where the pacer delivers pictures.
enum Output {
  Pipe(Arc<Mutex<Option<ChildStdin>>>),
  #[cfg(target_os = "macos")]
  Hardware(Arc<vt_encoder::VtEncoder>),
}

pub struct WindowCapture {
  native: platform::NativeCapture,
  stop: Arc<AtomicBool>,
  pacer: Option<JoinHandle<()>>,
}

impl WindowCapture {
  pub fn stop(mut self) {
    self.stop.store(true, Ordering::Release);
    platform::stop(self.native);
    if let Some(pacer) = self.pacer.take() {
      let _ = pacer.join();
    }
  }
}

/// Finds the live output window and picks the output frame size.
pub fn locate(app: &AppHandle, quality: StreamQuality) -> Result<Target, String> {
  platform::locate(app, quality)
}

/// The live window's size in pixels, for warning when a tier asks for more
/// than the window has (a 4K stream from a 1080p projector window is only an
/// upscale).
pub fn source_height(app: &AppHandle) -> Option<u32> {
  platform::source_height(app)
}

/// Starts capturing `target` and pacing its frames into `input` (the encoder's
/// stdin).
pub fn start(
  target: Target,
  quality: StreamQuality,
  input: Arc<Mutex<Option<ChildStdin>>>,
  fail: FailHandler,
  stats: Arc<Counters>,
) -> Result<WindowCapture, String> {
  #[cfg(target_os = "macos")]
  let encoder = target.encoder.clone();
  #[cfg(target_os = "macos")]
  let hardware = encoder.is_some();
  #[cfg(not(target_os = "macos"))]
  let hardware = false;
  let output = {
    #[cfg(target_os = "macos")]
    {
      match encoder {
        Some(encoder) => {
          encoder.attach(input.clone(), fail.clone());
          Output::Hardware(encoder)
        }
        None => Output::Pipe(input),
      }
    }
    #[cfg(not(target_os = "macos"))]
    {
      Output::Pipe(input)
    }
  };
  let sink = Arc::new(Sink {
    width: target.width,
    height: target.height,
    fps: quality.fps,
    hardware,
    spare: Mutex::new(None),
    latest: Arc::new(Mutex::new(None)),
    stop: Arc::new(AtomicBool::new(false)),
    fail,
    rejected: Arc::new(Mutex::new(Vec::new())),
    stats,
  });
  let native = platform::start(target.native, sink.clone())?;
  let stop = sink.stop.clone();
  let pacer = std::thread::Builder::new()
    .name("cow-stream-pacer".into())
    .spawn(move || pace(&sink, output))
    .ok();
  Ok(WindowCapture { native, stop, pacer })
}

/// Writes the latest frame every 1/30s on a fixed schedule (repeating it while
/// the slide is static), so the encoder sees constant-rate video. The encoder
/// times video by frame count, so after a stall the pacer catches up with
/// back-to-back frames instead of skipping, keeping video in step with audio.
fn pace(sink: &Sink, output: Output) {
  let interval = Duration::from_nanos(1_000_000_000 / sink.fps.max(1) as u64);
  let started = Instant::now();
  let mut next = started;
  let mut sent = 0u64;
  let mut health = Health::new();
  while !sink.stop.load(Ordering::Acquire) {
    let now = Instant::now();
    if next > now {
      std::thread::sleep(next - now);
    }
    next += interval;

    let picture = sink.latest.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let Some(picture) = picture else {
      if started.elapsed() > FIRST_FRAME_TIMEOUT {
        log::warn!(
          "live window capture produced no frame within {FIRST_FRAME_TIMEOUT:?}; rejected: {:?}",
          sink.rejected.lock().unwrap_or_else(|p| p.into_inner())
        );
        sink.fail(
          "The live output window isn't sending any picture. Make sure it isn't \
           minimized, then go live again."
            .into(),
        );
      }
      continue;
    };
    let writing = Instant::now();
    match (&output, &picture) {
      (Output::Pipe(input), Picture::Packed(frame)) => {
        let mut slot = input.lock().unwrap_or_else(|p| p.into_inner());
        let Some(stdin) = slot.as_mut() else { return };
        if stdin.write_all(frame).is_err() {
          return;
        }
      }
      #[cfg(target_os = "macos")]
      (Output::Hardware(encoder), Picture::Surface(surface)) => {
        if let Err(error) = encoder.encode(surface) {
          sink.fail(error);
          return;
        }
      }
      // The capture publishes the kind of picture its output wants, so a
      // mismatch can only be a bug; skip the frame rather than send garbage.
      #[cfg_attr(not(target_os = "macos"), allow(unreachable_patterns))]
      _ => continue,
    }
    health.record(sink, writing.elapsed());
    sent += 1;
    if sent == 1 {
      log::info!("live window capture: first frame after {:?}", started.elapsed());
    }
  }
}

/// Logs, every few seconds, how many new pictures the window delivered (drops
/// toward 0 if the OS stops painting it) and how many frame writes stalled
/// (the encoder or the network falling behind).
struct Health {
  since: Instant,
  published: u64,
  sent: u64,
  slow: u64,
}

impl Health {
  fn new() -> Self {
    Self { since: Instant::now(), published: 0, sent: 0, slow: 0 }
  }

  fn record(&mut self, sink: &Sink, write_time: Duration) {
    self.sent += 1;
    sink.stats.frames_sent.fetch_add(1, Ordering::Relaxed);
    if write_time > SLOW_WRITE {
      self.slow += 1;
      sink.stats.frames_delayed.fetch_add(1, Ordering::Relaxed);
    }
    let elapsed = self.since.elapsed();
    if elapsed < HEALTH_INTERVAL {
      return;
    }
    let published = sink.stats.window_frames.load(Ordering::Relaxed);
    let seconds = elapsed.as_secs_f64();
    log::info!(
      "stream health: window {:.1} new fps, sent {:.1} fps, {} slow writes, \
       {} upload stalls so far",
      (published - self.published) as f64 / seconds,
      self.sent as f64 / seconds,
      self.slow,
      sink.stats.upload_stalls.load(Ordering::Relaxed)
    );
    *self = Self { published, ..Self::new() };
  }
}

/// Copies a BGRA image with row padding (`stride` bytes per row) into `out` as a
/// tightly packed `width`×`height` frame, downscaling by an integer `factor`
/// with a box filter (averaging each factor×factor block keeps slide text
/// smooth). Rows or columns beyond the source are left black, extra ones are
/// cropped, so a window a few pixels off the expected size still produces a
/// valid frame.
///
/// `out` is reused between frames: the frame size is fixed for a session, so
/// the black margin written when it was first sized is still there and only
/// the picture area is overwritten.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn pack_frame_into(
  out: &mut Vec<u8>,
  data: &[u8],
  stride: usize,
  source_width: u32,
  source_height: u32,
  factor: u32,
  width: u32,
  height: u32,
) {
  let factor = factor.max(1) as usize;
  let (width, height) = (width as usize, height as usize);
  let usable_width = (source_width as usize / factor).min(width);
  let usable_height = (source_height as usize / factor).min(height);
  if out.len() != width * height * 4 {
    out.clear();
    out.resize(width * height * 4, 0);
  }
  for y in 0..usable_height {
    let out_row = &mut out[y * width * 4..(y + 1) * width * 4];
    if factor == 1 {
      let start = y * stride;
      out_row[..usable_width * 4].copy_from_slice(&data[start..start + usable_width * 4]);
      continue;
    }
    for x in 0..usable_width {
      let mut sum = [0u32; 4];
      for dy in 0..factor {
        let row = (y * factor + dy) * stride;
        for dx in 0..factor {
          let at = row + (x * factor + dx) * 4;
          for (channel, total) in sum.iter_mut().enumerate() {
            *total += data[at + channel] as u32;
          }
        }
      }
      let count = (factor * factor) as u32;
      for (channel, total) in sum.iter().enumerate() {
        out_row[x * 4 + channel] = (total / count) as u8;
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::pack_frame_into;

  fn pack_frame(
    data: &[u8],
    stride: usize,
    source_width: u32,
    source_height: u32,
    factor: u32,
    width: u32,
    height: u32,
  ) -> Vec<u8> {
    let mut out = Vec::new();
    pack_frame_into(&mut out, data, stride, source_width, source_height, factor, width, height);
    out
  }

  #[test]
  fn packing_strips_row_padding() {
    // 2×2 image with 4 bytes of padding per row.
    let mut data = Vec::new();
    data.extend([1, 1, 1, 1, 2, 2, 2, 2, 9, 9, 9, 9]);
    data.extend([3, 3, 3, 3, 4, 4, 4, 4, 9, 9, 9, 9]);
    let packed = pack_frame(&data, 12, 2, 2, 1, 2, 2);
    assert_eq!(packed, [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
  }

  #[test]
  fn downscaling_averages_each_block() {
    let data = [10u8, 10, 10, 10, 30, 30, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70];
    let packed = pack_frame(&data, 8, 2, 2, 2, 1, 1);
    assert_eq!(packed, [40, 40, 40, 40]);
  }

  #[test]
  fn undersized_sources_are_padded_with_black() {
    let data = [5u8; 4];
    let packed = pack_frame(&data, 4, 1, 1, 1, 2, 1);
    assert_eq!(packed, [5, 5, 5, 5, 0, 0, 0, 0]);
  }

  #[test]
  fn a_reused_buffer_keeps_its_black_margin() {
    let mut out = Vec::new();
    pack_frame_into(&mut out, &[5u8; 4], 4, 1, 1, 1, 2, 1);
    let pointer = out.as_ptr();
    pack_frame_into(&mut out, &[7u8; 4], 4, 1, 1, 1, 2, 1);
    assert_eq!(out, [7, 7, 7, 7, 0, 0, 0, 0]);
    assert_eq!(out.as_ptr(), pointer, "the allocation is reused");
  }
}
