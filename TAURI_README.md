# Cloud of Worship - Desktop App

This project has been set up to work as both a web app and a desktop app using Tauri.

## Desktop App Development

### Prerequisites

- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **System Dependencies** (macOS):
  ```bash
  xcode-select --install
  ```

### Development Commands

**Run the desktop app in development mode:**

```bash
npm run tauri:dev
```

**Build the desktop app for production:**

```bash
npm run tauri:build
```

**Run just the web version:**

```bash
npm run dev
```

## How It Works

### Architecture

- **Frontend**: Nuxt 3 (Vue 3 + TypeScript) - generates static files
- **Backend**: Tauri (Rust) - provides native desktop APIs
- **Build Output**: `dist/` folder contains the static web files that Tauri serves

### Key Files

- **`src-tauri/`**: Tauri backend (Rust code)

  - `src-tauri/tauri.conf.json`: Tauri configuration
  - `src-tauri/src/main.rs`: Main Rust entry point (minimal, mostly boilerplate)
  - `src-tauri/Cargo.toml`: Rust dependencies

- **`plugins/tauri.ts`**: Nuxt plugin for Tauri integration
- **`composables/useTauri.ts`**: Composable to detect if running in Tauri

### Using Tauri APIs in Your Code

The app automatically detects if it's running in Tauri (desktop) or web mode.

**Using the plugin:**

```typescript
// In any component or composable
const { $tauri } = useNuxtApp()

// Check if running in desktop mode
if ($tauri.enabled) {
  console.log("Running as desktop app")
}

// Get the window API
const window = await $tauri.getWindow()
await window?.setTitle("New Title")

// Get event API
const event = await $tauri.getEvent()
await event?.listen("my-event", (data) => {
  console.log("Event received:", data)
})
```

**Using the composable:**

```typescript
const { isTauri, isWeb } = useTauri()

// Conditionally show UI elements
<template>
  <div v-if="isTauri">
    Desktop-only features
  </div>
  <div v-if="isWeb">
    Web-only features
  </div>
</template>
```

### Building for Production

When you run `npm run tauri:build`, it will:

1. Generate static files with `npm run generate`
2. Bundle them with Tauri
3. Create platform-specific installers in `src-tauri/target/release/bundle/`

**Build outputs:**

- **macOS**: `.dmg` and `.app` in `src-tauri/target/release/bundle/dmg/` and `bundle/macos/`
- **Windows**: `.msi` and `.exe` in `bundle/msi/` and `bundle/nsis/`
- **Linux**: `.deb`, `.AppImage`, etc. in various bundle folders

## Configuration

### Window Settings

Edit `src-tauri/tauri.conf.json` to customize:

- Window size, title, resizable, etc.
- App name and identifier
- Icons and bundle settings

### Adding Rust Functionality (Optional)

If you need to add Rust commands:

1. **Define command in `src-tauri/src/main.rs`:**

```rust
#[tauri::command]
fn my_custom_command(name: String) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![my_custom_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

2. **Call from TypeScript:**

```typescript
const { $tauri } = useNuxtApp()
const result = await $tauri.invoke<string>("my_custom_command", {
  name: "World",
})
console.log(result) // "Hello, World!"
```

## Desktop Features You Can Add

With Tauri, you can add desktop-specific features:

- **File System Access**: Read/write files outside the web sandbox
- **System Tray**: Add a system tray icon
- **Native Dialogs**: File picker, save dialogs
- **Auto-Updates**: Built-in auto-update system
- **Notifications**: Native system notifications
- **Global Shortcuts**: Register keyboard shortcuts
- **Multiple Windows**: Create and manage multiple windows
- **Menu Bar**: Custom application menu

## Troubleshooting

**Port already in use:**

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Rust compilation errors:**

```bash
# Update Rust
rustup update
# Clean build
cd src-tauri && cargo clean
```

**Icons not showing:**

```bash
# Regenerate icons
npx @tauri-apps/cli icon src-tauri/icons/icon.png
```

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri API Reference](https://tauri.app/v1/api/js/)
- [Nuxt Documentation](https://nuxt.com/)
