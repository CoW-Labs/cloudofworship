//! Live numbers for the operator: how much data reaches YouTube, how smooth the
//! video is, whether the connection dropped, and the audio level. The pipeline
//! bumps shared counters as it works; a reporter thread turns them into rates
//! once a second and emits them on `stream://stats`.
//!
//! The audio level comes from FFmpeg itself: the encoder's audio filter chain
//! measures loudness (`astats`) and prints it to stderr (`ametadata`), which
//! `read_encoder_stderr` parses. The pre-flight audio meter runs the same
//! measurement on its own FFmpeg process.

use std::io::{BufRead, BufReader, Read};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const STATS_EVENT: &str = "stream://stats";
pub const AUDIO_LEVEL_EVENT: &str = "stream://audio-level";

/// The key FFmpeg prints the measured loudness under.
const LEVEL_KEY: &str = "lavfi.astats.Overall.RMS_level=";
/// A level older than this means audio stopped arriving.
const LEVEL_STALE_AFTER: Duration = Duration::from_secs(2);
/// Quieter than this is shown as silence (FFmpeg reports `-inf` for it).
const SILENCE_DB: f32 = -100.0;
const REPORT_EVERY: Duration = Duration::from_secs(1);
const STOP_POLL: Duration = Duration::from_millis(250);

/// Audio filters that measure loudness ~10 times a second and print it to
/// stderr, appended to whatever audio chain the caller already has. The `:` in
/// `pipe:2` is escaped twice: once for the filter graph, once for the option.
/// `direct=1` writes each reading straight away; without it FFmpeg buffers
/// about a minute of readings before any reach us.
pub const LEVEL_FILTERS: &str = "asetnsamples=n=4410:p=0,astats=metadata=1:reset=1,\
   ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=pipe\\\\:2:direct=1";

#[derive(Default)]
pub struct Counters {
  /// Encoded bytes handed to the pusher (i.e. on their way to YouTube).
  pub sent_bytes: AtomicU64,
  /// Frames the pacer wrote to the encoder.
  pub frames_sent: AtomicU64,
  /// Frames whose write stalled (the encoder or the network fell behind).
  pub frames_delayed: AtomicU64,
  /// New pictures the live window delivered.
  pub window_frames: AtomicU64,
  /// Encoded chunks whose hand-off to the uploader stalled (upload too slow).
  pub upload_stalls: AtomicU64,
  /// Times the connection to YouTube dropped and was re-established.
  pub reconnects: AtomicU64,
  audio_level: Mutex<Option<(f32, Instant)>>,
}

impl Counters {
  pub fn set_audio_level(&self, db: f32) {
    *self.audio_level.lock().unwrap_or_else(|p| p.into_inner()) = Some((db, Instant::now()));
  }

  fn audio_level(&self) -> Option<f32> {
    let level = *self.audio_level.lock().unwrap_or_else(|p| p.into_inner());
    level.filter(|(_, at)| at.elapsed() < LEVEL_STALE_AFTER).map(|(db, _)| db)
  }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamStats {
  pub uptime_secs: u64,
  /// Data actually leaving for YouTube over the last second.
  pub bitrate_kbps: u32,
  /// What the encoder is set to produce, for comparison.
  pub target_kbps: u32,
  pub fps: f32,
  pub frames_delayed: u64,
  pub delayed_percent: f32,
  /// New pictures per second from the live window (low while a slide is still).
  pub window_fps: f32,
  pub reconnects: u64,
  /// Loudness in dB (0 is the loudest; ~-60 and below is near silence), or
  /// `None` when no audio is arriving.
  pub audio_db: Option<f32>,
}

/// Emits stats once a second until `stopping` is set.
pub fn spawn_reporter(
  app: AppHandle,
  counters: Arc<Counters>,
  stopping: Arc<AtomicBool>,
  target_kbps: u32,
) -> Option<JoinHandle<()>> {
  std::thread::Builder::new()
    .name("cow-stream-stats".into())
    .spawn(move || {
      let started = Instant::now();
      let mut last = Instant::now();
      let (mut bytes, mut frames, mut pictures) = (0u64, 0u64, 0u64);
      while !stopping.load(Ordering::Acquire) {
        std::thread::sleep(STOP_POLL);
        let elapsed = last.elapsed();
        if elapsed < REPORT_EVERY {
          continue;
        }
        last = Instant::now();
        let seconds = elapsed.as_secs_f64();
        let now_bytes = counters.sent_bytes.load(Ordering::Relaxed);
        let now_frames = counters.frames_sent.load(Ordering::Relaxed);
        let now_pictures = counters.window_frames.load(Ordering::Relaxed);
        let delayed = counters.frames_delayed.load(Ordering::Relaxed);
        let stats = StreamStats {
          uptime_secs: started.elapsed().as_secs(),
          bitrate_kbps: ((now_bytes - bytes) as f64 * 8.0 / 1000.0 / seconds) as u32,
          target_kbps,
          fps: ((now_frames - frames) as f64 / seconds) as f32,
          frames_delayed: delayed,
          delayed_percent: if now_frames == 0 {
            0.0
          } else {
            (delayed as f64 * 100.0 / now_frames as f64) as f32
          },
          window_fps: ((now_pictures - pictures) as f64 / seconds) as f32,
          reconnects: counters.reconnects.load(Ordering::Relaxed),
          audio_db: counters.audio_level(),
        };
        (bytes, frames, pictures) = (now_bytes, now_frames, now_pictures);
        let _ = app.emit(STATS_EVENT, stats);
      }
    })
    .ok()
}

/// Reads an FFmpeg process's stderr: loudness lines feed `on_level`, anything
/// else (warnings) goes to the dev console as before.
pub fn read_levels(stderr: impl Read + Send + 'static, on_level: impl Fn(f32) + Send + 'static) {
  let _ = std::thread::Builder::new().name("cow-stream-stderr".into()).spawn(move || {
    for line in BufReader::new(stderr).lines() {
      let Ok(line) = line else { break };
      if let Some(db) = parse_level(&line) {
        on_level(db);
      } else if !line.starts_with("frame:") {
        eprintln!("{line}");
      }
    }
  });
}

/// `lavfi.astats.Overall.RMS_level=-23.5` → -23.5; `-inf` (silence) → floor.
fn parse_level(line: &str) -> Option<f32> {
  let value: f32 = line.trim().strip_prefix(LEVEL_KEY)?.parse().ok()?;
  Some(if value.is_finite() { value.max(SILENCE_DB) } else { SILENCE_DB })
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioLevel {
  pub db: f32,
}

/// Emits a meter reading for the pre-flight check.
pub fn emit_level(app: &AppHandle, db: f32) {
  let _ = app.emit(AUDIO_LEVEL_EVENT, AudioLevel { db });
}

#[cfg(test)]
mod tests {
  use super::{parse_level, SILENCE_DB};

  #[test]
  fn level_readings_are_not_buffered() {
    assert!(super::LEVEL_FILTERS.ends_with("file=pipe\\\\:2:direct=1"));
  }

  #[test]
  fn parses_loudness_lines() {
    assert_eq!(parse_level("lavfi.astats.Overall.RMS_level=-23.5"), Some(-23.5));
    assert_eq!(parse_level("lavfi.astats.Overall.RMS_level=-inf"), Some(SILENCE_DB));
    assert_eq!(parse_level("frame:12 pts:5292 pts_time:0.12"), None);
    assert_eq!(parse_level("[aac @ 0x1] Qavg: 120"), None);
  }
}
