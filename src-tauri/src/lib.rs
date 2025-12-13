use tauri::{Emitter, Manager, Window};

#[tauri::command]
async fn start_oauth_server(window: Window) -> Result<u16, String> {
    tauri_plugin_oauth::start(move |url| {
        // Send the OAuth redirect URL back to the frontend
        let _ = window.emit("oauth_url", url);
    })
    .map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    .invoke_handler(tauri::generate_handler![start_oauth_server])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
