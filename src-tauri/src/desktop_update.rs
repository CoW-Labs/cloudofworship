use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc, Mutex,
};

use futures_util::future::{AbortHandle, Abortable};
use sha2::{Digest, Sha256};
use tauri::{Manager, State, WebviewWindow};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Read by `installer.nsi` in `.onInstSuccess`. The updater always passes `/R`
/// to the Windows installer in passive mode, which would reopen an app the
/// operator has just closed; the installer inherits this environment and
/// skips the relaunch when it is "0".
const RELAUNCH_ENV: &str = "COW_UPDATE_RELAUNCH";

#[derive(Clone, Default)]
pub struct DesktopUpdateState {
  inner: Arc<Mutex<UpdateState>>,
}

#[derive(Default)]
struct UpdateState {
  staged: Option<StagedUpdate>,
  pending: Option<Cancellation>,
  installing: bool,
}

struct Cancellation {
  abort: AbortHandle,
  cancelled: Arc<AtomicBool>,
}

struct StagedUpdate {
  update: Update,
  file: File,
  digest: [u8; 32],
}

struct StageGuard(DesktopUpdateState);
impl Drop for StageGuard {
  fn drop(&mut self) {
    self
      .0
      .inner
      .lock()
      .unwrap_or_else(|p| p.into_inner())
      .pending = None;
  }
}

fn main_window(window: &WebviewWindow) -> Result<(), String> {
  if window.label() == "main" {
    Ok(())
  } else {
    Err("Only the operator window can manage desktop updates.".into())
  }
}

fn write_verified_package(
  directory: &std::path::Path,
  bytes: &[u8],
) -> Result<(File, [u8; 32]), String> {
  std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
  // An anonymous temporary file is removed on close/process exit. Never leave
  // unverified or abandoned installers in the media cache or a public path.
  let mut file = tempfile::tempfile_in(directory).map_err(|error| error.to_string())?;
  file.write_all(bytes).map_err(|error| error.to_string())?;
  file.flush().map_err(|error| error.to_string())?;
  Ok((file, Sha256::digest(bytes).into()))
}

fn read_verified_package(file: &mut File, expected: &[u8; 32]) -> Result<Vec<u8>, String> {
  file
    .seek(SeekFrom::Start(0))
    .map_err(|error| error.to_string())?;
  let mut bytes = Vec::new();
  file
    .read_to_end(&mut bytes)
    .map_err(|error| error.to_string())?;
  let actual: [u8; 32] = Sha256::digest(&bytes).into();
  if actual != *expected {
    return Err("The staged update changed on disk. Please download it again.".into());
  }
  Ok(bytes)
}

#[tauri::command]
pub async fn desktop_stage_update(
  app: tauri::AppHandle,
  window: WebviewWindow,
  state: State<'_, DesktopUpdateState>,
) -> Result<Option<String>, String> {
  main_window(&window)?;
  // Also guard native NDI callers, even if frontend status has not arrived yet.
  let ndi_status = app.state::<crate::ndi::NdiBridge>().status();
  if matches!(
    ndi_status.phase,
    crate::ndi::NdiPhase::Starting | crate::ndi::NdiPhase::Broadcasting
  ) {
    return Ok(None);
  }
  let state = state.inner().clone();
  let (abort, registration) = AbortHandle::new_pair();
  let cancelled = Arc::new(AtomicBool::new(false));
  {
    let mut inner = state.inner.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(staged) = &inner.staged {
      return Ok(Some(staged.update.version.clone()));
    }
    if inner.pending.is_some() || inner.installing {
      return Ok(None);
    }
    inner.pending = Some(Cancellation {
      abort,
      cancelled: cancelled.clone(),
    });
  }
  let _guard = StageGuard(state.clone());
  let download = Abortable::new(
    async {
      let Some(update) = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?
      else {
        return Ok(None);
      };
      // The SDK verifies the package signature before returning any bytes.
      // Its API buffers during download, but that allocation is released after
      // disk staging instead of being retained for the whole worship service.
      let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
      Ok::<_, String>(Some((update, bytes)))
    },
    registration,
  )
  .await;
  let Some((update, bytes)) = (match download {
    Ok(result) => result?,
    Err(_) => return Ok(None),
  }) else {
    return Ok(None);
  };
  if cancelled.load(Ordering::Acquire) {
    return Ok(None);
  }
  let directory = app
    .path()
    .app_cache_dir()
    .map_err(|error| error.to_string())?
    .join("updates");
  let (file, digest) =
    tauri::async_runtime::spawn_blocking(move || write_verified_package(&directory, &bytes))
      .await
      .map_err(|error| error.to_string())??;
  let mut inner = state.inner.lock().unwrap_or_else(|p| p.into_inner());
  if cancelled.load(Ordering::Acquire) {
    return Ok(None);
  }
  let version = update.version.clone();
  inner.staged = Some(StagedUpdate {
    update,
    file,
    digest,
  });
  Ok(Some(version))
}

#[tauri::command]
pub fn desktop_cancel_update(
  window: WebviewWindow,
  state: State<'_, DesktopUpdateState>,
) -> Result<(), String> {
  main_window(&window)?;
  if let Some(pending) = &state
    .inner
    .lock()
    .unwrap_or_else(|p| p.into_inner())
    .pending
  {
    pending.cancelled.store(true, Ordering::Release);
    pending.abort.abort();
  }
  Ok(())
}

#[tauri::command]
pub async fn desktop_install_update(
  window: WebviewWindow,
  state: State<'_, DesktopUpdateState>,
  relaunch: bool,
) -> Result<(), String> {
  main_window(&window)?;
  let state = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    std::env::set_var(RELAUNCH_ENV, if relaunch { "1" } else { "0" });
    let mut staged = {
      let mut inner = state.inner.lock().unwrap_or_else(|p| p.into_inner());
      if inner.installing {
        return Err("A desktop update is already installing.".into());
      }
      let staged = inner.staged.take().ok_or("No desktop update is staged.")?;
      inner.installing = true;
      staged
    };
    // Installation may request main-thread work on macOS. Never hold the
    // state mutex across it: cancellation/status commands must remain quick.
    let result = (|| {
      let bytes = read_verified_package(&mut staged.file, &staged.digest)?;
      staged
        .update
        .install(bytes)
        .map_err(|error| error.to_string())
    })();
    let mut inner = state.inner.lock().unwrap_or_else(|p| p.into_inner());
    inner.installing = false;
    if result.is_err() {
      inner.staged = Some(staged);
    }
    result
  })
  .await
  .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn staged_package_can_be_read_again_for_an_install_retry() {
    let directory = tempfile::tempdir().unwrap();
    let (mut file, digest) = write_verified_package(directory.path(), b"verified package").unwrap();
    assert_eq!(
      read_verified_package(&mut file, &digest).unwrap(),
      b"verified package"
    );
    assert_eq!(
      read_verified_package(&mut file, &digest).unwrap(),
      b"verified package"
    );
  }

  #[test]
  fn staged_package_modification_is_rejected() {
    let directory = tempfile::tempdir().unwrap();
    let (mut file, digest) = write_verified_package(directory.path(), b"verified package").unwrap();
    file.seek(SeekFrom::Start(0)).unwrap();
    file.write_all(b"changed!").unwrap();
    assert!(read_verified_package(&mut file, &digest).is_err());
  }
}
