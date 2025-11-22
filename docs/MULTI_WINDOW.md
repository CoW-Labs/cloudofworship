# Multi-Window Management in Desktop App

The desktop app now supports opening a dedicated fullscreen window for live output on secondary displays, just like the web version but using native Tauri windows.

## How It Works

### Web Mode (Browser)

- Uses `window.getScreenDetails()` API
- Opens popup windows with `window.open()`
- Limited by browser popup blockers
- Requires user permission for multi-screen access

### Desktop Mode (Tauri)

- Uses Tauri's native window management
- Creates proper application windows (not popups)
- Direct monitor access without browser restrictions
- Better performance and reliability

## Usage

### Basic Usage

The app automatically detects whether it's running in web or desktop mode and uses the appropriate method:

```typescript
// In your component
const { isTauri } = useTauri()

// When user clicks "Go Live"
if (isTauri.value) {
  // Desktop: Uses Tauri windows
  await openTauriLiveWindow()
} else {
  // Web: Uses browser popups
  openWindows()
}
```

### Using the Composable

For more control over window management:

```typescript
const {
  getMonitors,
  isLiveWindowOpen,
  getLiveWindow,
  closeLiveWindow,
  focusLiveWindow,
  createLiveWindow,
  toggleLiveWindow,
} = useTauriWindows()

// Get all available monitors
const monitors = await getMonitors()
console.log(`Found ${monitors.length} monitors`)

// Check if live window is open
const isOpen = await isLiveWindowOpen()

// Create live window on a specific monitor (0 = primary, 1 = secondary, etc.)
await createLiveWindow(1) // Opens on second monitor

// Toggle live window
await toggleLiveWindow() // Opens if closed, closes if open

// Close live window
await closeLiveWindow()

// Focus and ensure fullscreen
await focusLiveWindow()
```

## Monitor Detection

### Desktop (Tauri)

```typescript
const { getMonitors } = useTauriWindows()
const monitors = await getMonitors()

monitors.forEach((monitor, index) => {
  console.log(`Monitor ${index}:`, {
    name: monitor.name,
    size: monitor.size, // { width, height }
    position: monitor.position, // { x, y }
    scaleFactor: monitor.scaleFactor,
  })
})
```

### Stored Display Preference

The app saves the user's preferred display in `appStore.currentState.mainDisplayLabel`. The live window will automatically open on this display.

## Window Configuration

The live window is created with these settings:

```typescript
{
  url: '/live',
  title: 'Cloud of Worship - Live Output',
  fullscreen: true,           // Opens in fullscreen
  alwaysOnTop: false,         // Can be changed if needed
  decorations: false,         // No title bar
  resizable: true,            // Can resize if exiting fullscreen
  skipTaskbar: false,         // Shows in taskbar
  x: monitor.position.x,      // Position on target monitor
  y: monitor.position.y,
  width: monitor.size.width,  // Full monitor width
  height: monitor.size.height // Full monitor height
}
```

## Keyboard Shortcuts

Users can exit fullscreen using:

- **macOS**: `Cmd + Control + F` or `Esc`
- **Windows/Linux**: `F11` or `Esc`

## Error Handling

The implementation includes error handling for common scenarios:

1. **No monitors detected**

   - Shows toast notification
   - Prompts user to check display settings

2. **Only one monitor**

   - Shows notification about needing multiple displays
   - Still opens window for testing

3. **Preferred display not found**

   - Falls back to secondary monitor
   - Shows notification to update display settings

4. **Window creation fails**
   - Shows error toast
   - Logs error details for debugging

## Comparison: Web vs Desktop

| Feature             | Web (Browser)     | Desktop (Tauri)      |
| ------------------- | ----------------- | -------------------- |
| Popup blockers      | ❌ Can be blocked | ✅ No restrictions   |
| Permission required | ✅ Yes            | ❌ No                |
| Performance         | Good              | ✅ Better            |
| Window control      | Limited           | ✅ Full control      |
| Multiple windows    | ✅ Yes            | ✅ Yes               |
| Fullscreen          | ✅ Yes            | ✅ Native fullscreen |
| Taskbar integration | ❌ No             | ✅ Yes               |

## Testing

### Development Mode

```bash
# Connect a second monitor
# Run the app
npm run tauri:dev

# Click "Go Live"
# The live window should open on your secondary display in fullscreen
```

### Single Monitor Testing

You can test with a single monitor - the window will open on the primary display.

## Advanced: Custom Window Positions

If you need to position windows in specific ways:

```typescript
const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow")

const customWindow = new WebviewWindow("custom-label", {
  url: "/your-route",
  title: "Custom Window",
  width: 1920,
  height: 1080,
  x: 0, // Position
  y: 0,
  fullscreen: false,
  decorations: true, // Show title bar
  resizable: true,
  alwaysOnTop: true, // Always on top
})
```

## Troubleshooting

### Window not opening

- Check browser console for errors
- Verify `/live` route exists
- Ensure Tauri API is properly imported

### Window opens on wrong monitor

- Update display settings in the app
- Check `appStore.currentState.mainDisplayLabel`
- Use `getMonitors()` to see available displays

### Window not fullscreen

- The app sets fullscreen after a 500ms delay
- Ensure Tauri permissions are granted
- Check window decorations setting

### Multiple windows open

- Call `closeLiveWindow()` before creating new one
- Check if window exists with `isLiveWindowOpen()`

## Best Practices

1. **Always check if Tauri is available**

   ```typescript
   const { isTauri } = useTauri()
   if (!isTauri.value) return
   ```

2. **Close windows on app exit**

   ```typescript
   onBeforeUnmount(async () => {
     await closeLiveWindow()
   })
   ```

3. **Handle monitor changes**

   ```typescript
   // Update display list when monitors change
   const monitors = await getMonitors()
   // Update UI with available displays
   ```

4. **Provide fallbacks**
   ```typescript
   try {
     await createLiveWindow()
   } catch (error) {
     // Show user-friendly error message
     // Offer alternative solutions
   }
   ```

## Future Enhancements

Potential improvements:

- [ ] Remember window positions per monitor
- [ ] Support for multiple live windows
- [ ] Drag-and-drop between windows
- [ ] Window preview/thumbnail
- [ ] Custom window layouts
- [ ] Per-window settings

## Resources

- [Tauri Window API](https://tauri.app/v1/api/js/window)
- [Tauri WebviewWindow API](https://tauri.app/v1/api/js/webviewwindow)
- [Multi-Window Example](https://github.com/tauri-apps/tauri/tree/dev/examples/multiwindow)
