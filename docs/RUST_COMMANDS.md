# Adding Custom Rust Commands (Only When Needed)

This guide shows how to add Rust commands when JavaScript/TypeScript APIs aren't sufficient.

## When You Need Rust

- ✅ Performance-critical operations
- ✅ Native OS features not available in web APIs
- ✅ System-level integrations
- ✅ Custom file format parsing
- ❌ Most UI operations (use TypeScript instead)
- ❌ Network requests (use TypeScript instead)
- ❌ File system operations (use Tauri API from TypeScript)

## Example: Creating a Rust Command

### 1. Add the Rust Function

Edit `src-tauri/src/lib.rs`:

```rust
// Add this before the run() function:
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You have successfully called Rust from TypeScript.", name)
}

// Then update the run() function to register the command:
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // ... existing setup code ...
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![greet])  // Add this line
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

### 2. Call from TypeScript

```typescript
// In any component or composable:
const { $tauri } = useNuxtApp()

const result = await $tauri.invoke<string>("greet", { name: "World" })
console.log(result) // "Hello, World! You have successfully called Rust from TypeScript."
```

## More Complex Example: Reading System Info

### Rust Side (`src-tauri/src/lib.rs`):

```rust
use sysinfo::{System, SystemExt};

#[tauri::command]
fn get_system_info() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    format!(
        "OS: {}\nKernel: {}\nTotal Memory: {} KB",
        System::name().unwrap_or_default(),
        System::kernel_version().unwrap_or_default(),
        sys.total_memory()
    )
}

// Register in run():
.invoke_handler(tauri::generate_handler![get_system_info])
```

### Add Dependency in `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0.0", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sysinfo = "0.30"  # Add this
```

### TypeScript Side:

```typescript
const getSystemInfo = async () => {
  const { $tauri } = useNuxtApp()
  if (!$tauri.enabled) {
    return "Not available in web mode"
  }

  const info = await $tauri.invoke<string>("get_system_info")
  return info
}
```

## Returning Complex Data

### Rust Side:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct UserProfile {
    name: String,
    age: u32,
    active: bool,
}

#[tauri::command]
fn get_profile() -> UserProfile {
    UserProfile {
        name: "John Doe".to_string(),
        age: 30,
        active: true,
    }
}
```

### TypeScript Side:

```typescript
interface UserProfile {
  name: string
  age: number
  active: boolean
}

const profile = await $tauri.invoke<UserProfile>("get_profile")
console.log(profile.name) // "John Doe"
```

## Async Rust Commands

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Perform async operation
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}
```

## Error Handling

### Rust Side:

```rust
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}
```

### TypeScript Side:

```typescript
try {
  const result = await $tauri.invoke<number>("divide", { a: 10, b: 2 })
  console.log("Result:", result)
} catch (error) {
  console.error("Error:", error)
}
```

## Best Practices

1. **Keep Rust commands simple** - Complex logic should be in TypeScript when possible
2. **Use TypeScript for UI** - All component logic should be TypeScript
3. **Document your commands** - Add comments explaining what each Rust command does
4. **Type safety** - Always define TypeScript interfaces for Rust return types
5. **Error handling** - Always handle errors from Rust commands
6. **Test in both modes** - Ensure your app works in web mode (without Rust commands)

## Common Use Cases

### File Operations (Use Tauri API from TypeScript first!)

```typescript
// Prefer this (TypeScript):
const { $tauri } = useNuxtApp()
const fs = await $tauri.getFs()
if (fs) {
  await fs.readTextFile("path/to/file")
}
```

Only use Rust for file operations if you need:

- Custom binary format parsing
- High-performance file processing
- Complex file manipulation not supported by Tauri API

### System Tray (Needs Rust)

This is one area where Rust is required. See Tauri documentation:
https://tauri.app/v1/guides/features/system-tray/

### Window Management (Use TypeScript!)

```typescript
// This is already available in TypeScript:
const window = await $tauri.getWindow()
await window?.setTitle("New Title")
await window?.minimize()
```

## Remember

**Start with TypeScript. Add Rust only when necessary.**

Most desktop features are available through the Tauri JavaScript API, which you can use from TypeScript without touching any Rust code!
