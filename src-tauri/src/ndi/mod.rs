mod capture;
mod pipeline;
mod quality;
mod status;

#[cfg(any(target_os = "macos", target_os = "windows"))]
mod ffi;
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod runtime;
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod sender;
#[cfg(all(test, target_os = "macos"))]
mod bench;

use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};
use std::thread::JoinHandle;

use tauri::{AppHandle, State};

use capture::ActiveCapture;
use pipeline::FrameMailbox;
use quality::NdiQuality;
pub use status::{NdiErrorInfo, NdiStatus, NdiPhase};
use status::{CapturePermission, NdiErrorCode, StatusSink};

#[derive(Clone)]
pub struct NdiBridge {
  inner: Arc<BridgeInner>,
}

struct BridgeInner {
  app: AppHandle,
  operation: Mutex<()>,
  session: Mutex<Option<NdiSession>>,
  status: StatusSink,
}

struct NdiSession {
  stop: Arc<AtomicBool>,
  mailbox: Arc<FrameMailbox>,
  capture: Box<dyn ActiveCapture>,
  sender_thread: Option<JoinHandle<()>>,
}

impl NdiBridge {
  pub fn new(app: AppHandle) -> Self {
    Self {
      inner: Arc::new(BridgeInner {
        status: StatusSink::new(app.clone()),
        app,
        operation: Mutex::new(()),
        session: Mutex::new(None),
      }),
    }
  }

  pub fn status(&self) -> NdiStatus {
    self.inner.status.current()
  }

  #[cfg(any(target_os = "macos", target_os = "windows"))]
  pub fn start_blocking(&self, quality: NdiQuality) -> Result<NdiStatus, NdiErrorInfo> {
    let _operation = self
      .inner
      .operation
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    let stale_session = {
      let mut session = self
        .inner
        .session
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
      match session.as_ref() {
        Some(active) if !active.stop.load(Ordering::Acquire) => {
          return Ok(self.status());
        }
        Some(_) => session.take(),
        None => None,
      }
    };
    if let Some(mut stale) = stale_session {
      stale.stop.store(true, Ordering::Release);
      stale.mailbox.close();
      let _ = stale.capture.stop();
      if let Some(thread) = stale.sender_thread.take() {
        let _ = thread.join();
      }
    }

    self.inner.status.update(|status| {
      *status = NdiStatus::default();
      status.phase = NdiPhase::Starting;
      status.fps = quality.fps;
      status.quality = quality.id.to_string();
    });

    let runtime = match runtime::load() {
      Ok(runtime) => runtime,
      Err(error) => {
        self.inner.status.fail(error.clone());
        return Err(error);
      }
    };
    self.inner.status.update(|status| {
      status.runtime_available = true;
      status.runtime_version = Some(runtime.version.clone());
      status.runtime_path = Some(runtime.path.display().to_string());
    });

    let stop = Arc::new(AtomicBool::new(false));
    let mailbox = Arc::new(FrameMailbox::default());
    let (ready_sender, ready_receiver) = std::sync::mpsc::sync_channel(1);
    let sender_runtime = runtime;
    let sender_mailbox = mailbox.clone();
    let sender_stop = stop.clone();
    let sender_status = self.inner.status.clone();
    let sender_thread = match std::thread::Builder::new()
      .name("cow-ndi-sender".to_string())
      .spawn(move || {
        sender::run_sender(
          sender_runtime,
          quality,
          sender_mailbox,
          sender_stop,
          sender_status,
          ready_sender,
        );
      }) {
        Ok(thread) => thread,
        Err(error) => {
          let error = NdiErrorInfo::internal(format!(
            "Could not start the NDI sender thread: {error}"
          ));
          self.inner.status.fail(error.clone());
          return Err(error);
        }
      };

    let capture = match capture::start_capture(capture::CaptureContext {
      app: self.inner.app.clone(),
      quality,
      mailbox: mailbox.clone(),
      stop: stop.clone(),
      status: self.inner.status.clone(),
    }) {
      Ok(capture) => capture,
      Err(error) => {
        stop.store(true, Ordering::Release);
        mailbox.close();
        let _ = sender_thread.join();
        update_permission_from_error(&self.inner.status, &error);
        self.inner.status.fail(error.clone());
        return Err(error);
      }
    };
    self.inner.status.update(|status| {
      status.capture_permission = capture.permission.clone();
    });

    let ready = match ready_receiver.recv_timeout(std::time::Duration::from_secs(6)) {
      Ok(ready) => ready,
      Err(error) => Err(NdiErrorInfo::new(
          NdiErrorCode::FirstFrameTimeout,
          format!("NDI did not receive its first live frame: {error}"),
          true,
      )),
    };
    if let Err(error) = ready {
      stop.store(true, Ordering::Release);
      mailbox.close();
      let mut handle = capture.handle;
      let _ = handle.stop();
      let _ = sender_thread.join();
      self.inner.status.fail(error.clone());
      return Err(error);
    }

    self
      .inner
      .session
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .replace(NdiSession {
        stop,
        mailbox,
        capture: capture.handle,
        sender_thread: Some(sender_thread),
      });

    Ok(self.inner.status.update(|status| {
      status.phase = NdiPhase::Broadcasting;
      status.error = None;
    }))
  }

  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  pub fn start_blocking(&self, _quality: NdiQuality) -> Result<NdiStatus, NdiErrorInfo> {
    let error = NdiErrorInfo::new(
      NdiErrorCode::UnsupportedPlatform,
      "NDI live output is currently available only on macOS and Windows.",
      false,
    );
    self.inner.status.fail(error.clone());
    Err(error)
  }

  pub fn stop_blocking(&self) -> Result<NdiStatus, NdiErrorInfo> {
    let _operation = self
      .inner
      .operation
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    let session = self
      .inner
      .session
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take();
    let Some(mut session) = session else {
      return Ok(self.inner.status.update(|status| {
        if status.phase != NdiPhase::Unsupported {
          status.phase = NdiPhase::Idle;
          status.error = None;
          status.stalled = false;
        }
      }));
    };

    session.stop.store(true, Ordering::Release);
    session.mailbox.close();
    let capture_error = session.capture.stop().err();
    if let Some(thread) = session.sender_thread.take() {
      if thread.join().is_err() {
        let error = NdiErrorInfo::internal("The NDI sender thread stopped unexpectedly.");
        self.inner.status.fail(error.clone());
        return Err(error);
      }
    }
    if let Some(error) = capture_error {
      log::warn!("NDI capture did not stop cleanly: {error}");
    }

    Ok(self.inner.status.update(|status| {
      status.phase = NdiPhase::Idle;
      status.error = None;
      status.width = None;
      status.height = None;
      status.frames_sent = 0;
      status.connection_count = 0;
      status.last_frame_age_ms = None;
      status.stalled = false;
    }))
  }
}

fn update_permission_from_error(status: &StatusSink, error: &NdiErrorInfo) {
  let permission = match error.code {
    NdiErrorCode::CapturePermissionRequired => Some(CapturePermission::Required),
    NdiErrorCode::CapturePermissionDenied => Some(CapturePermission::Denied),
    _ => None,
  };
  if let Some(permission) = permission {
    status.update(|value| value.capture_permission = permission);
  }
}

#[tauri::command]
pub async fn ndi_start(
  state: State<'_, NdiBridge>,
  quality: Option<String>,
) -> Result<NdiStatus, NdiErrorInfo> {
  let bridge = state.inner().clone();
  let quality = NdiQuality::by_id(quality.as_deref());
  tauri::async_runtime::spawn_blocking(move || bridge.start_blocking(quality))
    .await
    .map_err(|error| NdiErrorInfo::internal(format!("The NDI start task failed: {error}")))?
}

#[tauri::command]
pub async fn ndi_stop(state: State<'_, NdiBridge>) -> Result<NdiStatus, NdiErrorInfo> {
  let bridge = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || bridge.stop_blocking())
    .await
    .map_err(|error| NdiErrorInfo::internal(format!("The NDI stop task failed: {error}")))?
}

#[tauri::command]
pub fn ndi_status(state: State<'_, NdiBridge>) -> NdiStatus {
  state.status()
}

#[tauri::command]
pub async fn ndi_open_capture_settings() -> Result<(), NdiErrorInfo> {
  tauri::async_runtime::spawn_blocking(capture::open_capture_settings)
    .await
    .map_err(|error| NdiErrorInfo::internal(format!("Could not open capture settings: {error}")))?
}

/// One NDI quality tier as the picker shows it.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiTierInfo {
  #[serde(flatten)]
  pub tier: NdiQuality,
  /// False when this computer can't send the tier yet, with `reason` in plain
  /// words. The picker lists it greyed out.
  pub available: bool,
  pub reason: Option<String>,
}

/// Whether this computer can send `tier`.
///
/// Both captures scale and convert to NV12 on the GPU, so every tier is
/// offered. Whether a computer can *hold* 4K60 depends on its CPU (the NDI
/// runtime compresses on it) and its network, which can't be known up front.
fn tier_support(_tier: &NdiQuality) -> (bool, Option<String>) {
  (true, None)
}

#[tauri::command]
pub fn ndi_tiers() -> Vec<NdiTierInfo> {
  quality::TIERS
    .iter()
    .map(|tier| {
      let (available, reason) = tier_support(tier);
      NdiTierInfo { tier: *tier, available, reason }
    })
    .collect()
}
