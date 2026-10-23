//! Captures the live output window's own pixels by its native window handle,
//! so going live needs no picker. The app creates that window, so it asks the
//! OS for exactly that window instead of guessing by title or size. A window
//! capture reads the window's own surface rather than the composited screen,
//! so desktop switches and overlapping windows don't reach the stream.
//!
//! The per-OS part (`macos`: ScreenCaptureKit, `windows`: Windows Graphics
//! Capture) only finds the window and publishes tightly packed BGRA frames of
//! the target size into a shared slot. Frames arrive only when content
//! changes; the shared pacer here re-sends the latest one at a steady 30fps to
//! the encoder's stdin.

use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tauri::AppHandle;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use windows as platform;

const LIVE_WINDOW_LABEL: &str = "live-output";
const FRAME_INTERVAL: Duration = Duration::from_nanos(1_000_000_000 / 30);
/// A healthy capture delivers its first frame almost immediately.
const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(5);
/// How often the pacer logs capture/encoder health.
const HEALTH_INTERVAL: Duration = Duration::from_secs(10);
/// A frame write slower than this means the encoder or network is behind.
const SLOW_WRITE: Duration = Duration::from_millis(100);

/// The latest captured frame, tightly packed BGRA at the target size. Swapped
/// as a whole so the pacer never holds the lock while writing to the pipe.
type LatestFrame = Arc<Mutex<Option<Arc<Vec<u8>>>>>;

/// Called once when capture breaks or never produces a frame.
pub type FailHandler = Arc<dyn Fn(String) + Send + Sync>;

/// What the platform capture needs to publish frames.
struct Sink {
  width: u32,
  height: u32,
  latest: LatestFrame,
  stop: Arc<AtomicBool>,
  fail: FailHandler,
  /// The first few rejected callbacks, logged if no frame ever arrives.
  rejected: Arc<Mutex<Vec<String>>>,
  /// New pictures received from the OS, for the health log.
  published: AtomicU64,
}

impl Sink {
  fn publish(&self, frame: Vec<u8>) {
    self.published.fetch_add(1, Ordering::Relaxed);
    *self.latest.lock().unwrap_or_else(|p| p.into_inner()) = Some(Arc::new(frame));
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
pub fn locate(app: &AppHandle) -> Result<Target, String> {
  platform::locate(app)
}

/// Starts capturing `target` and pacing its frames into `input` (the encoder's
/// stdin).
pub fn start(
  target: Target,
  input: Arc<Mutex<Option<ChildStdin>>>,
  fail: FailHandler,
) -> Result<WindowCapture, String> {
  let sink = Arc::new(Sink {
    width: target.width,
    height: target.height,
    latest: Arc::new(Mutex::new(None)),
    stop: Arc::new(AtomicBool::new(false)),
    fail,
    rejected: Arc::new(Mutex::new(Vec::new())),
    published: AtomicU64::new(0),
  });
  let native = platform::start(target.native, sink.clone())?;
  let stop = sink.stop.clone();
  let pacer = std::thread::Builder::new()
    .name("cow-stream-pacer".into())
    .spawn(move || pace(&sink, input))
    .ok();
  Ok(WindowCapture { native, stop, pacer })
}

/// Writes the latest frame every 1/30s on a fixed schedule (repeating it while
/// the slide is static), so the encoder sees constant-rate video. The encoder
/// times video by frame count, so after a stall the pacer catches up with
/// back-to-back frames instead of skipping, keeping video in step with audio.
fn pace(sink: &Sink, input: Arc<Mutex<Option<ChildStdin>>>) {
  let started = Instant::now();
  let mut next = started;
  let mut sent = 0u64;
  let mut health = Health::new();
  while !sink.stop.load(Ordering::Acquire) {
    let now = Instant::now();
    if next > now {
      std::thread::sleep(next - now);
    }
    next += FRAME_INTERVAL;

    let frame = sink.latest.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let Some(frame) = frame else {
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
    let mut slot = input.lock().unwrap_or_else(|p| p.into_inner());
    let Some(stdin) = slot.as_mut() else { return };
    let writing = Instant::now();
    if stdin.write_all(&frame).is_err() {
      return;
    }
    drop(slot);
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
    if write_time > SLOW_WRITE {
      self.slow += 1;
    }
    let elapsed = self.since.elapsed();
    if elapsed < HEALTH_INTERVAL {
      return;
    }
    let published = sink.published.load(Ordering::Relaxed);
    let seconds = elapsed.as_secs_f64();
    log::info!(
      "stream health: window {:.1} new fps, sent {:.1} fps, {} slow writes",
      (published - self.published) as f64 / seconds,
      self.sent as f64 / seconds,
      self.slow
    );
    *self = Self { published, ..Self::new() };
  }
}

/// Copies a BGRA image with row padding (`stride` bytes per row) into a tightly
/// packed `width`×`height` frame, downscaling by an integer `factor` with a box
/// filter (averaging each factor×factor block keeps slide text smooth). Rows
/// or columns beyond the source are left black, extra ones are cropped, so a
/// window a few pixels off the expected size still produces a valid frame.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn pack_frame(
  data: &[u8],
  stride: usize,
  source_width: u32,
  source_height: u32,
  factor: u32,
  width: u32,
  height: u32,
) -> Vec<u8> {
  let factor = factor.max(1) as usize;
  let (width, height) = (width as usize, height as usize);
  let usable_width = (source_width as usize / factor).min(width);
  let usable_height = (source_height as usize / factor).min(height);
  let mut packed = vec![0u8; width * height * 4];
  for y in 0..usable_height {
    let out_row = &mut packed[y * width * 4..(y + 1) * width * 4];
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
  packed
}

#[cfg(test)]
mod tests {
  use super::pack_frame;

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
}
