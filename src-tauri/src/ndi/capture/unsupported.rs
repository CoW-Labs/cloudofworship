use super::{CaptureContext, CaptureStarted};
use crate::ndi::status::{NdiErrorCode, NdiErrorInfo};

pub fn start_capture(_context: CaptureContext) -> Result<CaptureStarted, NdiErrorInfo> {
  Err(NdiErrorInfo::new(
    NdiErrorCode::UnsupportedPlatform,
    "NDI live output is currently available only on macOS and Windows.",
    false,
  ))
}

pub fn open_capture_settings() -> Result<(), NdiErrorInfo> {
  Err(NdiErrorInfo::new(
    NdiErrorCode::UnsupportedPlatform,
    "Screen capture settings are only available on macOS.",
    false,
  ))
}
