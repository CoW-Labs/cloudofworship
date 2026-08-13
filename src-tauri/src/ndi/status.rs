use serde::Serialize;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

pub const SOURCE_NAME: &str = "Cow Live Center";
pub const FRAME_RATE: u32 = 30;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NdiPhase {
  #[default]
  Idle,
  Starting,
  Broadcasting,
  Error,
  Unsupported,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub enum CapturePermission {
  #[default]
  Unknown,
  NotRequired,
  Granted,
  Required,
  Denied,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub enum NdiErrorCode {
  UnsupportedPlatform,
  UnsupportedOsVersion,
  RuntimeNotInstalled,
  RuntimeLoadFailed,
  RuntimeMissingSymbol,
  UnsupportedCpu,
  SenderCreateFailed,
  LiveWindowMissing,
  AmbiguousLiveWindow,
  CapturePermissionRequired,
  CapturePermissionDenied,
  CaptureStartFailed,
  FirstFrameTimeout,
  CaptureStopped,
  ScalingFailed,
  Internal,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiErrorInfo {
  pub code: NdiErrorCode,
  pub message: String,
  pub hint: Option<String>,
  pub help_url: Option<String>,
  pub recoverable: bool,
}

impl NdiErrorInfo {
  pub fn new(code: NdiErrorCode, message: impl Into<String>, recoverable: bool) -> Self {
    Self {
      code,
      message: message.into(),
      hint: None,
      help_url: None,
      recoverable,
    }
  }

  pub fn hint(mut self, hint: impl Into<String>) -> Self {
    self.hint = Some(hint.into());
    self
  }

  pub fn help_url(mut self, url: impl Into<String>) -> Self {
    self.help_url = Some(url.into());
    self
  }

  pub fn internal(message: impl Into<String>) -> Self {
    Self::new(NdiErrorCode::Internal, message, true)
  }
}

impl std::fmt::Display for NdiErrorInfo {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    formatter.write_str(&self.message)
  }
}

impl std::error::Error for NdiErrorInfo {}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiStatus {
  pub phase: NdiPhase,
  pub source_name: String,
  pub runtime_available: bool,
  pub runtime_version: Option<String>,
  pub runtime_path: Option<String>,
  pub capture_permission: CapturePermission,
  pub width: Option<u32>,
  pub height: Option<u32>,
  pub fps: u32,
  pub frames_sent: u64,
  pub connection_count: u32,
  pub last_frame_age_ms: Option<u64>,
  pub stalled: bool,
  pub error: Option<NdiErrorInfo>,
}

impl Default for NdiStatus {
  fn default() -> Self {
    Self {
      phase: NdiPhase::Idle,
      source_name: SOURCE_NAME.to_string(),
      runtime_available: false,
      runtime_version: None,
      runtime_path: None,
      capture_permission: CapturePermission::Unknown,
      width: None,
      height: None,
      fps: FRAME_RATE,
      frames_sent: 0,
      connection_count: 0,
      last_frame_age_ms: None,
      stalled: false,
      error: None,
    }
  }
}

#[derive(Clone)]
pub struct StatusSink {
  app: AppHandle,
  status: Arc<RwLock<NdiStatus>>,
}

impl StatusSink {
  pub fn new(app: AppHandle) -> Self {
    Self {
      app,
      status: Arc::new(RwLock::new(NdiStatus::default())),
    }
  }

  pub fn current(&self) -> NdiStatus {
    self
      .status
      .read()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
  }

  pub fn update(&self, mutate: impl FnOnce(&mut NdiStatus)) -> NdiStatus {
    let status = {
      let mut status = self
        .status
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
      mutate(&mut status);
      status.clone()
    };
    if let Err(error) = self.app.emit("ndi://status", &status) {
      log::warn!("failed to emit NDI status: {error}");
    }
    status
  }

  pub fn fail(&self, error: NdiErrorInfo) -> NdiStatus {
    self.update(|status| {
      status.phase = if matches!(
        error.code,
        NdiErrorCode::UnsupportedPlatform | NdiErrorCode::UnsupportedOsVersion
      ) {
        NdiPhase::Unsupported
      } else {
        NdiPhase::Error
      };
      status.error = Some(error);
    })
  }
}
