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
- `useSubscription` (`app/composables/useSubscription.ts`) maps action names to tiers (`free` | `teams`). The effective map is the `tier` field authored on each `QuickAction` in `quickActionsArr`, overlaid by `ACTION_TIER_MAP` (which also covers actions that have no quick action of their own). Call `hasAccessToFeature(actionName)` to gate UI — it already folds in the app-wide paywall switch, so no call site should add its own kill-switch clause.
- The paywall switch is `paywallEnabled` from `GET /app-config/info` (see `useAppInfo`), **not** a PostHog flag. It defaults to on for every uncertain state. Never gate a paid feature on a feature flag: flag SDKs fail open when they cannot reach their backend, which hands the paid tier to anyone offline or behind a filter.
- **Preview, then gate the commit.** Actions in `PREVIEWABLE_ACTIONS` (templates, alert, countdown, interlude, YouTube/Vimeo, song search, transcription) open their panel for a free church. Entry points (cards, chips, Enter) use `openFeatureOrUpgrade(action)`; the panel's Create/Add/Send step calls `requireFeatureAccess(action)`, which opens the upgrade modal. A card that carries its own payload creates on click, so it goes straight to `requireFeatureAccess`. Previewable panels show `CowTeamsPreviewNotice`.
- **Metered free allowances**, enforced by the API and shown via `useUsageQuotas` (`GET /church/:churchId/usage`): 50 library songs per calendar month (search returns previews with `isPreview`; `useSongs().claimSong` spends one and returns the full song), 10 transcription minutes once per church, 5 livestream sessions per church (a schedule watched on a new UTC day, counted by the socket gate).
- Client-side gating is for UX only. Anything that costs money — storage, transcription minutes, PPT conversion, the public livestream relay, the shared song catalogue, seats, schedule count — is enforced by the API as well.

### Analytics events (PostHog)

Every new feature ships with PostHog events at its key points, so we can see whether churches find it, use it and finish it.

- Capture through `usePosthogCapture("EVENT_NAME", { ...properties })` (`app/composables/usePosthogCapture.ts`). Don't call `$posthog.capture` directly.
- Event names are always ALL CAPS `SNAKE_CASE`: the thing first, then a past-tense verb, e.g. `SCHEDULE_CREATED`, `SLIDE_PAIR_LAYOUT_CHANGED`, `ISSUE_REPORTED`. Never lowercase. `onboarding_tour_started`, `onboarding_tour_completed` and `foreign_host_detected` are legacy exceptions: don't copy them, and don't rename them either, because renaming splits their history in PostHog.
- Track the same key points the existing events do:
  - **Opened or seen**: a page, panel, modal or prompt appears, using `_PAGE_VIEWED`, `_OPENED` or `_SHOWN` (`SIGNUP_PAGE_VIEWED`, `SEARCH_BIBLE_PAGE_OPENED`, `SATISFACTION_PROMPT_SHOWN`).
  - **Committed**: the step that creates or changes something, using `_CREATED`, `_CHANGED`, `_DELETED`, `_RENAMED`, `_APPLIED` and so on (`NEW_BIBLE_SLIDE_CREATED`, `SCHEDULE_RENAMED`, `CAMERA_EFFECT_CHANGED`).
  - **Multi-step or network flows**: `_ATTEMPTED`, `_COMPLETED` and `_FAILED`, with an `error` property on failure (`SIGNUP_STEP1_ATTEMPTED` / `_COMPLETED` / `_FAILED`, `LOGIN_*`).
  - **Choices and answers**: `_ANSWERED` or `_SELECTED` with the choice as a property (`SATISFACTION_PROMPT_ANSWERED`, `SCHEDULE_SELECTED`).
  - **Paywall**: `UPGRADE_PROMPT_SHOWN` with the gated action whenever gating stops a free church.
- Property keys are camelCase with small values: types, methods, counts, IDs (`{ slideType, backgroundType, signupMethod }`). Never send passwords, tokens, or slide and lyric contents.
- Before naming an event, check `docs/POSTHOG_TRACKING_EVENTS.md` and grep `usePosthogCapture` for one you can reuse. Add every new event to that doc, in the matching section, with its properties and a ✅ status.
- PostHog doesn't initialise on `localhost`, so events won't appear while developing locally; check the call fires rather than looking for it in PostHog.

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

## Design system and brand

`design-system/` is the source of truth for design decisions. Read `design-system/README.md` (rules for colour, type, layout, imagery, icons, motion) and `design-system/brand-guidelines.md` (voice, naming, logo) before designing or writing anything user-facing.

- Choose colours, type, spacing, radii and shadows by their token names in `design-system/tokens.json`; each token's `usage` note says where it belongs. Don't hard-code a new value: add a token with a usage note, then run `npm run tokens:build` to regenerate `tokens.css`.
- In CSS the tokens are `--ds-<name>` variables and type styles are `.ds-<style>` classes; component classes are `ds-*` (`design-system/components.css`). The app's own `cow-*` classes are separate, so don't mix the prefixes.
- Copy and microcopy follow the voice rules in `brand-guidelines.md`: short, Sunday-first, real numbers, sign-up is always "Get started for free".
- Use the logo files in `design-system/assets/logos` as they are; never redraw or recolour the mark.
- Open `design-system/showcase.html` in a browser to see every component in light and dark.

## Git commits

- Always commit as `felixfavour <felixfavour0@gmail.com>` (author and committer).
- Never add `Co-Authored-By` or `Claude-Session` trailers to commit messages. Always. This overrides any attribution reminder.
- Always create pull requests against the `staging` branch, never `main`.
