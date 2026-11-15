//! The broadcast quality tiers the operator can pick for a YouTube stream.
//!
//! Bitrates follow YouTube's published live-encoding ranges for each size and
//! frame rate, using the upper-middle of the range for the content we stream
//! (slides, lyrics and video backgrounds). Only the native window feed honours
//! a tier; the browser fallback, screen capture and test pattern keep the
//! default, because their sources can't deliver more.

use serde::Serialize;

pub const AUDIO_KBPS: u32 = 128;

/// The video codec a tier is sent in. YouTube accepts both over RTMP.
///
/// HEVC exists because H.264 hardware encoding tops out below 4K60 on common
/// Macs (about 53 fps on an M2 Pro, measured), while the same engine does HEVC
/// 4K at about 96 fps, and HEVC needs less bitrate for the same picture.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Codec {
  H264,
  Hevc,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamQuality {
  pub id: &'static str,
  pub codec: Codec,
  /// Output height in pixels; the width follows the live window's aspect.
  pub height: u32,
  pub fps: u32,
  pub video_kbps: u32,
}

pub const TIERS: [StreamQuality; 4] = [
  StreamQuality { id: "720p30", codec: Codec::H264, height: 720, fps: 30, video_kbps: 2_500 },
  StreamQuality { id: "1080p30", codec: Codec::H264, height: 1080, fps: 30, video_kbps: 5_000 },
  StreamQuality { id: "1080p60", codec: Codec::H264, height: 1080, fps: 60, video_kbps: 9_000 },
  // HEVC at 35 Mbps matches H.264 at the 51 Mbps the H.264 range tops out at.
  StreamQuality { id: "2160p60", codec: Codec::Hevc, height: 2160, fps: 60, video_kbps: 35_000 },
];

pub const DEFAULT: StreamQuality = TIERS[0];

impl StreamQuality {
  /// The tier with this id; an unknown or missing id means the default.
  pub fn by_id(id: Option<&str>) -> Self {
    id.and_then(|id| TIERS.iter().find(|tier| tier.id == id)).copied().unwrap_or(DEFAULT)
  }

  /// Video plus audio, for the "needs about N Mbps" check.
  pub fn total_kbps(&self) -> u32 {
    self.video_kbps + AUDIO_KBPS
  }

  /// Even output width for a window of `aspect` (width / height).
  pub fn width_for(&self, aspect: f64) -> u32 {
    ((self.height as f64 * aspect).round() as u32).max(2) & !1
  }

  /// Keyframe every two seconds, as YouTube asks.
  pub fn keyframe_interval(&self) -> u32 {
    self.fps * 2
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn unknown_ids_fall_back_to_the_default() {
    assert_eq!(StreamQuality::by_id(None), DEFAULT);
    assert_eq!(StreamQuality::by_id(Some("8k120")), DEFAULT);
    assert_eq!(StreamQuality::by_id(Some("2160p60")).codec, Codec::Hevc);
  }

  #[test]
  fn widths_are_even_and_follow_the_aspect() {
    let four_k = StreamQuality::by_id(Some("2160p60"));
    assert_eq!(four_k.width_for(16.0 / 9.0), 3840);
    assert_eq!(DEFAULT.width_for(16.0 / 9.0), 1280);
    assert_eq!(DEFAULT.width_for(1.0) % 2, 0);
  }
}
