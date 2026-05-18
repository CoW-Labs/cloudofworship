# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Web development server (port 3000, required for Tauri)
npm run dev

# Desktop app (Tauri) development
npm run tauri:dev

# Production build (static site via nuxt generate)
npm run build

# Desktop app production build
npm run tauri:build

# Regenerate Nuxt type declarations after adding modules/composables
npm run postinstall
```

There is no test suite in this project.

## Architecture Overview

Cloud of Worship is a church presentation SaaS built with **Nuxt 4** (SPA mode, SSR disabled) and optionally wrapped in **Tauri 2** for desktop distribution. The app is statically generated (`nuxt generate`), with all code under `app/`.

### Two-window architecture

The app runs in two browser windows simultaneously:

1. **Operator window** (`/` → `app` layout) — the control surface with three resizable panels:
   - **QuickActions** (left) — slide creation menu + fuzzy search over all `quickActionsArr` actions
   - **PreviewContent** (center) — slide schedule/editor for the active schedule
   - **LiveOutput** (right) — thumbnail preview of what's on screen

2. **Live projection window** (`/live`) — full-screen output displayed on the projector/second monitor; renders `LiveProjectionOnly` component driven by the active slide state.

These two windows communicate via the **BroadcastChannel API** (`useBroadcastPost` / `useBroadcastMessage`, channel name `"cow-live-channel"`). When a slide goes live, the operator serialises the full `Slide` object and posts it; the live window deserialises and renders it.

**`pinia-shared-state`** (plugin `pinia-shared-state.ts`) keeps Pinia store state in sync across both windows via `localStorage` events, so settings and live slide ID stay consistent.

### State management (Pinia)

Three stores, all persisted to `localStorage`:

| Store | File | Purpose |
|-------|------|---------|
| `useAppStore` | `app/store/app.ts` | Global app state: active schedule, all slides, live slide ID, settings, alerts, online users. Has undo/redo stack (throttled at 1500ms). |
| `useAuthStore` | `app/store/auth.ts` | Authenticated user, church, JWT token, cached subscription details. |
| `useTemplateStore` | `app/store/template.ts` | Slide templates. |

`AppState` (defined in `app/types/index.ts`) is the canonical shape of `appStore.currentState`. Settings (`AppSettings`) live inside `currentState.settings`.

### Slide model

A `Slide` (see `app/types/index.ts`) has:
- **type**: one of `song | song-setlist | hymn | bible | text | media | countdown | presentation` (constants in `app/utils/constants.ts`)
- **contents**: array of strings (the raw text lines)
- **background / backgroundType / backgroundVideoKey**: visual style
- **slideStyle** (`SlideStyle`): per-slide overrides (blur, brightness, font size %, alignment, padding, etc.)
- **data**: typed payload attached client-side only (e.g. `Song`, `Scripture`, `Hymn`, `Countdown`)

The active schedule's slides live in `appStore.currentState.activeSlides`. `liveSlideId` is the ID of the slide currently projected.

### API layer

`useAPIFetch` (`app/composables/useAPIFetch.ts`) wraps Nuxt's `useFetch` with:
- `Authorization: Bearer <token>` header on every request
- `x-dev-token` header in development
- Offline detection — queues failed `POST/PUT/DELETE` requests and retries when back online
- Auto sign-out on 401

The base URL comes from `runtimeConfig.public.BASE_URL` (default: `https://api.cloudofworship.com/api/v1`).

### Authentication

- **Web**: JWT stored in a `token` cookie (30-day expiry, `sameSite`, `secure` in production).
- **Tauri desktop**: JWT stored in Pinia `authStore.token` (no cookie).
- `useAuthToken` composable abstracts the difference.
- `auth.global.ts` middleware redirects unauthenticated users to `/login`.

### Realtime collaboration (Socket.IO)

`useSocketIO` (`app/composables/useSocketIO.ts`) connects to the same origin as `BASE_URL` at `/socket.io/`. It handles:
- Slide CRUD events (`slide-created`, `slide-updated`, `slide-deleted`, batch variants)
- Slide locking for concurrent editing (`lock-slide`, `lock-granted`, `lock-denied`)
- Live slide sync across team members (`live-slide`)
- Online presence (`user-joined`, `user-left`, `online-users`)
- Alert/overlay events

`useRealtimeSlides` (`app/composables/useRealtimeSlides.ts`) builds on `useSocketIO` and updates Pinia state in response to events.

### Offline support

- **Service worker** (`public/sw.js`) — registered in `app.vue`; can be force-unregistered via the `force-sw-unregister` PostHog feature flag.
- **IndexedDB** (Dexie) — `useIndexedDB` provides the singleton `WorshipCloudDatabase` with tables: `songs`, `media`, `library`, `cached`, `bibleAndHymns`.
- Bible translations (`kjv.json`, `niv.json`, `nkjv.json`) and `hymns.json` live in `public/` and are loaded into IndexedDB on first use.

### Feature flags & subscription gating

- **PostHog** (`app/plugins/posthog.ts`) is the feature flag backend. Not initialized on `localhost`.
- `useFeatureFlags` composable wraps PostHog flag checks. Valid flag keys are typed as `FeatureFlagKey` in that file.
- `useSubscription` (`app/composables/useSubscription.ts`) maps action names to tiers (`free` | `teams`) via `ACTION_TIER_MAP`. Check `hasAccessToFeature(actionName)` before gating UI. The `tier` field on `QuickAction` objects drives the same logic.

### Global event bus

An **emitter** (mitt) is provided to the Nuxt app as `nuxtApp.$emitter` and stored in `appStore.currentState.emitter`. All cross-component communication goes through this emitter using the string action names from `appWideActions` (defined in `app/utils/constants.ts`). Always use those constants rather than raw strings.

### Tauri integration

- `useTauri()` — detects desktop environment via `window.__TAURI__` / `window.__TAURI_INTERNALS__`.
- `getTauriAPI()` — dynamically imports `@tauri-apps/api` (safe to call in browser; returns `null`).
- Nuxt plugin `app/plugins/tauri.ts` provides `$nuxtApp.$tauri.invoke()` / `.getWindow()` / `.getEvent()`.
- Desktop-only features (zoom shortcuts, auto-update, Google OAuth via `tauri-plugin-oauth`) are initialised in `initializeTauri()` called from `app.vue`.

### UI framework

- **Nuxt UI** (edge channel) + **TailwindCSS** — `@nuxt/ui` is configured globally (`ui.global: true`).
- Color mode: system preference → fallback light.
- Icon sets: `mdi`, `bx`, `bxs`, `bi`, `mingcute`, `tabler`, `ph`, `lucide` (all bundled client-side via `nuxt-icon` client bundle).
- Custom purple palette is extended in `tailwind.config.ts`; dynamic color classes are safelisted there.

### Layouts

| Layout | Used by |
|--------|---------|
| `default` | General public pages |
| `auth` | Login, signup, verify, forgot/reset password |
| `app` | Main operator window (`/`) |
| `live` | Live projection window (`/live`) |
