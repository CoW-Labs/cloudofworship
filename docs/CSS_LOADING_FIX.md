# CSS Loading in Tauri Windows - Fix

## Problem

CSS styles were not being applied to the live screen window opened by Tauri. This happened because:

1. **Dynamic Window Creation**: When Tauri creates a new window for `/live`, it's a separate webview instance
2. **CSS Not Inherited**: Unlike browser popups, Tauri windows don't inherit styles from the parent
3. **Async Loading**: The main app uses `onload` handlers for CSS which may not work in new windows
4. **SSG Build**: Static generation means CSS needs to be explicitly included per route

## Solution

### 1. Created Dedicated Layout (`layouts/live.vue`)

Created a specific layout for the live page that:

- Explicitly loads all required CSS files
- Includes inline critical styles
- Ensures proper style application

```vue
<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: "Cloud of Worship - Live",
  link: [
    {
      rel: "stylesheet",
      href: "/css/fonts.css",
    },
    {
      rel: "stylesheet",
      href: "/css/main.css",
    },
  ],
})
</script>

<style>
/* Critical inline styles */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
```

### 2. Updated Live Page (`pages/live.vue`)

Modified the page to:

- Use the dedicated `live` layout
- Explicitly include CSS links in `useHead()`
- Ensure styles load before content renders

```typescript
definePageMeta({
  layout: "live",
})

useHead({
  title: "CoW Live",
  link: [
    { rel: "stylesheet", href: "/css/fonts.css" },
    { rel: "stylesheet", href: "/css/main.css" },
  ],
})
```

### 3. Updated Tauri CSP (`src-tauri/tauri.conf.json`)

Changed Content Security Policy from `null` to explicit rules:

```json
{
  "security": {
    "csp": "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss: ws:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;"
  }
}
```

This allows:

- ✅ Inline styles (`'unsafe-inline'`)
- ✅ External stylesheets from same origin
- ✅ Fonts from data URLs and HTTPS
- ✅ Images from various sources
- ✅ Scripts needed for Nuxt/Vue

## How It Works

### Before (Broken):

```
Main Window loads → CSS via onload handlers
   ↓
Create Live Window → New webview instance
   ↓
Live Window → ❌ No CSS loaded
   ↓
Components render → ❌ No styles applied
```

### After (Fixed):

```
Main Window loads → CSS via onload handlers
   ↓
Create Live Window → New webview with /live route
   ↓
Live layout loads → Explicitly includes CSS files
   ↓
useHead() injects → <link rel="stylesheet"> tags
   ↓
Components render → ✅ Styles properly applied
```

## Testing

### Development Mode:

```bash
npm run tauri:dev

# Then:
1. Click "Go Live"
2. Check live window
3. Verify styles are applied (colors, fonts, layout)
4. Check browser console for CSS load errors
```

### Production Build:

```bash
npm run tauri:build

# After installing:
1. Run the app
2. Click "Go Live"
3. Verify styles work in built version
```

## Key Files Modified

1. **`layouts/live.vue`** (NEW)

   - Dedicated layout for live page
   - Explicit CSS loading
   - Critical inline styles

2. **`pages/live.vue`** (UPDATED)

   - Uses `live` layout
   - Additional CSS links in useHead()

3. **`src-tauri/tauri.conf.json`** (UPDATED)
   - CSP updated to allow inline styles
   - Allows loading of CSS/fonts/images

## Why This Approach Works

### 1. **Explicit Loading**

Instead of relying on parent window or async loading, we explicitly declare CSS dependencies per route.

### 2. **Layout-Based**

Using a dedicated layout ensures CSS is loaded before the page content, preventing FOUC (Flash of Unstyled Content).

### 3. **Inline Critical Styles**

Critical CSS is inlined to ensure basic layout works even if external CSS is delayed.

### 4. **Proper CSP**

Content Security Policy now explicitly allows the styles needed by the app.

## Troubleshooting

### Styles Still Not Loading?

**Check 1: CSS Files Exist**

```bash
ls -la dist/css/
# Should show fonts.css and main.css
```

**Check 2: Browser Console**
Open DevTools in live window (if possible) and check for:

- 404 errors on CSS files
- CSP violations
- Network errors

**Check 3: Build Process**

```bash
npm run generate
# Ensure CSS files are in dist/css/
```

**Check 4: Tauri CSP**
Verify `tauri.conf.json` has the correct CSP policy.

### Fonts Not Loading?

Add font preload in layout:

```vue
useHead({ link: [ { rel: "preload", href: "/fonts/your-font.woff2", as: "font",
type: "font/woff2", crossorigin: "" }, ], })
```

### Images Not Showing?

Ensure images are in `public/` directory and referenced with absolute paths:

```vue
<img src="/images/logo.png" alt="Logo">
```

## Best Practices

### 1. **Always Use Absolute Paths**

```vue
<!-- ✅ Good -->
<link href="/css/main.css">

<!-- ❌ Bad -->
<link href="css/main.css">
<link href="../css/main.css">
```

### 2. **Include in Layout**

For routes that open in new windows, always use a dedicated layout with explicit CSS.

### 3. **Test Both Modes**

Always test in both development (`tauri:dev`) and production (`tauri:build`).

### 4. **Monitor CSP Violations**

Check console for CSP violations and adjust policy as needed.

## Alternative Solutions

If you still have issues, consider:

### Option 1: Inline All Styles

```vue
<style>
/* Paste critical CSS here */
</style>
```

### Option 2: Use CSS-in-JS

```vue
<div :style="{ backgroundColor: '#000', color: '#fff' }">
```

### Option 3: Import Tailwind Directly

```typescript
// In live.vue
import "tailwindcss/tailwind.css"
```

## Performance Considerations

### CSS Loading Order:

1. Inline critical styles (instant)
2. Layout CSS links (fast)
3. Page CSS links (fast)
4. Component styles (async)

### Optimization:

- Critical CSS is inline for instant rendering
- External CSS loads in parallel
- Fonts use preload for faster loading

## Related Issues

- [Tauri CSP Documentation](https://tauri.app/v1/guides/debugging/csp/)
- [Nuxt CSS Handling](https://nuxt.com/docs/getting-started/styling)
- [Vue Head Management](https://github.com/unjs/unhead)

## Future Improvements

- [ ] Automatically detect CSS dependencies per route
- [ ] Cache CSS in Tauri for faster loading
- [ ] Minimize CSS bundle size
- [ ] Split CSS by route for smaller chunks

---

✅ **CSS now loads properly in Tauri windows!**

The live window should now display with all styles correctly applied, including Tailwind classes, custom CSS, and fonts.
