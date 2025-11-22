# Display Settings - Desktop & Web Support

The Display Settings component now works seamlessly in both desktop (Tauri) and web (browser) modes, automatically detecting and listing all available monitors.

## What Was Updated

### Component: `components/settings/DisplaySettings.vue`

The component now:

1. ✅ Detects if running in Tauri (desktop) or browser (web) mode
2. ✅ Uses appropriate API for each platform
3. ✅ Displays monitors in the same format for both modes
4. ✅ Handles errors gracefully
5. ✅ Shows platform-specific UI elements

## How It Works

### Detection Logic

```typescript
const { isTauri } = useTauri()

const getDisplayDetails = async () => {
  if (isTauri.value) {
    // Desktop: Use Tauri API
    await getTauriDisplays()
  } else if ("getScreenDetails" in window) {
    // Web: Use Browser API
    await getBrowserDisplays()
  } else {
    // Fallback: Show error
  }
}
```

### Desktop Mode (Tauri)

**API Used:** `@tauri-apps/api/window`

```typescript
const getTauriDisplays = async () => {
  const { availableMonitors, currentMonitor } = await import(
    "@tauri-apps/api/window"
  )
  const monitors = await availableMonitors()
  const current = await currentMonitor()

  // Map to unified screen format
  allScreens.value = monitors.map((monitor, index) => ({
    id: useScreenId(monitor),
    label: monitor.name || `Display ${index + 1}`,
    width: monitor.size.width,
    height: monitor.size.height,
    availWidth: monitor.size.width,
    availHeight: monitor.size.height,
    availLeft: monitor.position.x,
    availTop: monitor.position.y,
    isPrimary: monitor.position.x === 0 && monitor.position.y === 0,
    devicePixelRatio: monitor.scaleFactor || 1,
    // ... other properties
  }))
}
```

### Web Mode (Browser)

**API Used:** `window.getScreenDetails()`

```typescript
const getBrowserDisplays = async () => {
  screenDetails = await window.getScreenDetails()
  screenDetails.currentScreen.id = useScreenId(screenDetails?.currentScreen)
  screenDetails?.screens?.map((screen) => {
    screen.id = useScreenId(screen)
  })
  currentScreen.value = screenDetails?.currentScreen
  allScreens.value = screenDetails?.screens
}
```

## UI Features

### Control Center Display

Shows the current monitor where the app is running:

- Monitor name/label
- Resolution (width x height)
- "Primary screen" badge if applicable
- Platform indicator "(Desktop Mode)" in Tauri

### Secondary Screens List

Shows all other connected monitors:

- Monitor name/label
- Resolution
- "Primary screen" badge if applicable
- Checkbox to set as "Live display"
- Refresh button to reload monitor list

### Platform-Specific Features

**Desktop Mode:**

- ✅ Shows "(Desktop Mode)" indicator
- ✅ Hides "Move window" button (not applicable)
- ✅ Uses Tauri monitor detection
- ✅ Better performance

**Web Mode:**

- ✅ Shows "Move window to primary screen" button
- ✅ Uses browser Screen Details API
- ✅ Requires user permission

## Monitor Selection

### How Users Select Live Display:

1. Open Settings → Display Settings
2. See list of all connected monitors
3. Check "Live display" for preferred monitor
4. Selection is saved to `appStore.currentState.mainDisplayLabel`
5. When "Go Live" is clicked, live window opens on selected monitor

### Data Stored:

```typescript
// Monitor ID
appStore.currentState.mainDisplayLabel = "screen-id-hash"

// Full monitor details
appStore.currentState.mainDisplayScreen = {
  id: "screen-id-hash",
  width: 1920,
  height: 1080,
  label: "Display 2",
  // ... other properties
}
```

## Monitor ID Generation

Both platforms use the same ID generation logic via `useScreenId()`:

```typescript
// Generates consistent IDs based on monitor properties
const monitorId = useScreenId(monitor)
// Example: "1920x1080-0x0-2.0" (width x height - x pos x y pos - scale)
```

This ensures saved preferences work across sessions.

## Error Handling

### No Monitors Detected

```typescript
useToast().add({
  title: "No monitors detected",
  icon: "i-bx-info-circle",
  color: "amber",
})
```

### API Not Supported (Web)

```typescript
useToast().add({
  title: "Your browser does not support automatic displays detection",
  icon: "i-bx-info-circle",
  color: "amber",
})
```

### Detection Failed

```typescript
useToast().add({
  title: "Failed to detect displays",
  description: "Please try again",
  icon: "i-bx-error-circle",
  color: "red",
})
```

## Refresh Functionality

Users can manually refresh the monitor list:

```vue
<UButton
  size="sm"
  variant="outline"
  leading-icon="i-bx-refresh"
  :loading="isLoading"
  @click="getDisplayDetails()"
>
  Refresh screens
</UButton>
```

This is useful when:

- Connecting/disconnecting monitors
- Monitor configuration changes
- After waking from sleep

## Auto-Refresh

The component automatically refreshes on window resize:

```typescript
addEventListener("resize", async () => {
  debouncedGetDisplayDetails()
})
```

Debounced to avoid excessive API calls.

## Testing

### Desktop Mode Testing

```bash
# Run the desktop app
npm run tauri:dev

# Navigate to Settings → Display Settings
# Should see all connected monitors
# Select one as "Live display"
# Click "Go Live" to verify window opens on selected monitor
```

### Web Mode Testing

```bash
# Run in browser
npm run dev

# Navigate to Settings → Display Settings
# Grant screen detection permission when prompted
# Should see all connected monitors
# Same selection and testing process
```

### Multi-Monitor Setup

**Recommended test setup:**

1. Connect at least 2 monitors
2. Open Display Settings
3. Verify both monitors are listed
4. Select secondary monitor as "Live display"
5. Click "Go Live"
6. Verify live window opens on selected monitor

## Comparison: Desktop vs Web

| Feature             | Web (Browser)         | Desktop (Tauri)        |
| ------------------- | --------------------- | ---------------------- |
| Monitor detection   | ✅ getScreenDetails() | ✅ availableMonitors() |
| Permission required | ✅ Yes                | ❌ No                  |
| Monitor names       | ✅ Yes                | ✅ Yes                 |
| Primary monitor     | ✅ Detected           | ✅ Detected            |
| Monitor positions   | ✅ Yes                | ✅ Yes                 |
| Resolution info     | ✅ Yes                | ✅ Yes                 |
| Scale factor        | ✅ Yes                | ✅ Yes                 |
| Internal/External   | ✅ Yes                | ❌ Not available       |
| Move window         | ✅ Can try            | ❌ Not supported       |

## Known Limitations

### Desktop Mode

- Cannot distinguish between internal/external monitors
- Window movement between screens not supported via button
- Users must manually drag windows to desired screen

### Web Mode

- Requires user permission
- May be blocked by browser settings
- Limited window control

## Future Enhancements

Potential improvements:

- [ ] Remember last used monitor per session
- [ ] Show monitor thumbnails/previews
- [ ] Drag-and-drop monitor reordering
- [ ] Custom labels for monitors
- [ ] Monitor orientation support
- [ ] HDR/color space information

## Troubleshooting

### No Monitors Showing

**Desktop:**

1. Check if monitors are connected
2. Restart the app
3. Check system display settings

**Web:**

1. Grant screen detection permission
2. Check browser compatibility
3. Try different browser

### Wrong Monitor Selected

1. Go to Display Settings
2. Uncheck current selection
3. Check desired monitor
4. Test with "Go Live"

### Monitor List Not Updating

1. Click "Refresh screens" button
2. Disconnect and reconnect monitor
3. Restart application

## Related Files

- `components/settings/DisplaySettings.vue` - Main component
- `layouts/app.vue` - Window opening logic
- `composables/useTauriWindows.ts` - Tauri window utilities
- `composables/useScreenId.ts` - Monitor ID generation
- `types/window.d.ts` - TypeScript declarations

## Resources

- [Tauri Window API](https://tauri.app/v1/api/js/window/#availablemonitors)
- [Screen Details API](https://developer.mozilla.org/en-US/docs/Web/API/Screen)
- [Window Management API](https://developer.chrome.com/articles/multi-screen-window-placement/)

---

✅ **Display Settings now works perfectly in both desktop and web modes!**

Users get consistent monitor detection and selection experience regardless of platform.
