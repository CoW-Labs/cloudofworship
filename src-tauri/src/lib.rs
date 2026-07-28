use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use tauri::{Emitter, Manager, Window};

#[tauri::command]
async fn start_oauth_server(window: Window) -> Result<u16, String> {
    tauri_plugin_oauth::start(move |url| {
        // Send the OAuth redirect URL back to the frontend
        let _ = window.emit("oauth_url", url);
    })
    .map_err(|err| err.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaStorageStats {
  free_bytes: u64,
  total_bytes: u64,
  media_bytes: u64,
}

fn directory_size(path: &Path) -> u64 {
  let Ok(entries) = std::fs::read_dir(path) else {
    return 0;
  };

  entries
    .filter_map(Result::ok)
    .map(|entry| {
      let path = entry.path();
      match entry.metadata() {
        Ok(metadata) if metadata.is_dir() => directory_size(&path),
        Ok(metadata) => metadata.len(),
        Err(_) => 0,
      }
    })
    .sum()
}

fn managed_media_path(app_local_data: &Path, relative_path: &Path) -> Result<PathBuf, String> {
  if relative_path.is_absolute()
    || relative_path
      .components()
      .any(|component| !matches!(component, Component::Normal(_)))
  {
    return Err("invalid managed media path".into());
  }

  let components: Vec<_> = relative_path.components().collect();
  if components.len() < 2
    || components[0].as_os_str() != "cow-media"
    || components[1].as_os_str() != "v1"
  {
    return Err("path is outside the managed media root".into());
  }

  Ok(app_local_data.join(relative_path))
}

fn media_storage_stats_for(app_local_data: &Path) -> Result<MediaStorageStats, String> {
  let media_dir = managed_media_path(app_local_data, Path::new("cow-media/v1"))?;
  std::fs::create_dir_all(&media_dir).map_err(|error| error.to_string())?;

  Ok(MediaStorageStats {
    free_bytes: fs2::available_space(&media_dir).map_err(|error| error.to_string())?,
    total_bytes: fs2::total_space(&media_dir).map_err(|error| error.to_string())?,
    media_bytes: directory_size(&media_dir),
  })
}

/// Report capacity only for the volume containing Cloud of Worship's managed
/// media directory. The frontend cannot supply a path, so this command cannot
/// be used to inspect arbitrary locations.
#[tauri::command]
fn media_storage_stats(app: tauri::AppHandle) -> Result<MediaStorageStats, String> {
  let app_local_data = app
    .path()
    .app_local_data_dir()
    .map_err(|error| error.to_string())?;
  media_storage_stats_for(&app_local_data)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn temporary_app_data() -> PathBuf {
    let suffix = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("clock should be valid")
      .as_nanos();
    std::env::temp_dir().join(format!("cow-media-test-{}-{suffix}", std::process::id()))
  }

  #[test]
  fn resolves_only_managed_media_paths() {
    let base = Path::new("/private/app-data");
    let resolved =
      managed_media_path(base, Path::new("cow-media/v1/slide/hash/file")).unwrap();
    assert_eq!(
      resolved,
      base.join("cow-media/v1/slide/hash/file")
    );
  }

  #[test]
  fn rejects_path_traversal_and_paths_outside_the_root() {
    let base = Path::new("/private/app-data");
    assert!(managed_media_path(base, Path::new("../secret")).is_err());
    assert!(managed_media_path(base, Path::new("cow-media/v1/../../secret")).is_err());
    assert!(managed_media_path(base, Path::new("other/file")).is_err());
    assert!(managed_media_path(base, Path::new("/absolute/file")).is_err());
  }

  #[test]
  fn reports_managed_usage_and_volume_capacity() {
    let base = temporary_app_data();
    let media_dir = base.join("cow-media/v1/slide/hash");
    std::fs::create_dir_all(&media_dir).unwrap();
    std::fs::write(media_dir.join("fixture"), vec![7_u8; 4096]).unwrap();

    let stats = media_storage_stats_for(&base).unwrap();
    assert_eq!(stats.media_bytes, 4096);
    assert!(stats.total_bytes > 0);
    assert!(stats.free_bytes <= stats.total_bytes);

    std::fs::remove_dir_all(&base).unwrap();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_oauth::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      start_oauth_server,
      media_storage_stats
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
