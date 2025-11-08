// Example Rust command (uncomment to use):
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You have successfully called Rust from TypeScript.", name)
// }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    // If you add custom commands, register them here:
    // .invoke_handler(tauri::generate_handler![greet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
