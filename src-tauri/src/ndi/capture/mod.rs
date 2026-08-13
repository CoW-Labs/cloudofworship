use std::sync::{atomic::AtomicBool, Arc};

use tauri::AppHandle;

use super::pipeline::FrameMailbox;
use super::status::{CapturePermission, NdiErrorInfo, StatusSink};

#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;
#[cfg(target_os = "windows")]
mod windows;

pub trait ActiveCapture: Send {
  fn stop(&mut self) -> Result<(), NdiErrorInfo>;
}

pub struct CaptureStarted {
  pub handle: Box<dyn ActiveCapture>,
  pub permission: CapturePermission,
}

pub struct CaptureContext {
  pub app: AppHandle,
  pub mailbox: Arc<FrameMailbox>,
  pub stop: Arc<AtomicBool>,
  pub status: StatusSink,
}

#[cfg(target_os = "macos")]
pub use macos::{open_capture_settings, start_capture};
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use unsupported::{open_capture_settings, start_capture};
#[cfg(target_os = "windows")]
pub use windows::{open_capture_settings, start_capture};
