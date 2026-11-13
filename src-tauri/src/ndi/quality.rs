//! The size and frame rate tiers an NDI output can run at.
//!
//! NDI has no bitrate setting: the SDK compresses each frame itself and only
//! when a receiver is connected. What an operator can choose is how big the
//! picture is and how often it is sent. The capture never upscales, so a tier
//! is a ceiling: a 1080p window under a 4K tier is still sent at 1080p.

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiQuality {
  pub id: &'static str,
  pub max_width: u32,
  pub max_height: u32,
  pub fps: u32,
}

pub const TIERS: [NdiQuality; 4] = [
  NdiQuality { id: "1080p30", max_width: 1920, max_height: 1080, fps: 30 },
  NdiQuality { id: "1080p60", max_width: 1920, max_height: 1080, fps: 60 },
  NdiQuality { id: "2160p30", max_width: 3840, max_height: 2160, fps: 30 },
  NdiQuality { id: "2160p60", max_width: 3840, max_height: 2160, fps: 60 },
];

/// What NDI has always sent here, so an app that never picks a tier is unchanged.
pub const DEFAULT: NdiQuality = TIERS[0];

impl NdiQuality {
  /// The tier with this id; an unknown or missing id means the default.
  pub fn by_id(id: Option<&str>) -> Self {
    id.and_then(|id| TIERS.iter().find(|tier| tier.id == id)).copied().unwrap_or(DEFAULT)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn unknown_ids_fall_back_to_the_unchanged_default() {
    assert_eq!(NdiQuality::by_id(None), DEFAULT);
    assert_eq!(NdiQuality::by_id(Some("8k120")), DEFAULT);
    assert_eq!(DEFAULT.max_height, 1080);
    assert_eq!(DEFAULT.fps, 30);
    assert_eq!(NdiQuality::by_id(Some("2160p60")).fps, 60);
  }
}
