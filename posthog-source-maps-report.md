# PostHog Source Map Upload — Setup Report

## What was configured

Source map injection and upload were already wired into the project. This run confirmed and refreshed the credentials.

### Files changed

| File | Change |
|------|--------|
| `.env` | Updated `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST` |

### Files already correctly configured (no changes needed)

| File | Why |
|------|-----|
| `nuxt.config.ts` | Already has `sourcemap: { client: true }` and the `nitro:build:public-assets` hook that runs `posthog-cli sourcemap inject` + `posthog-cli sourcemap upload --delete-after` |
| `package.json` | `@posthog/cli` already in `devDependencies` |
| `.github/workflows/create-release.yml` | Already has a comment documenting the required env vars |

## Credentials written to `.env`

```
POSTHOG_CLI_API_KEY     (personal API key — never commit this value)
POSTHOG_CLI_PROJECT_ID  99168
POSTHOG_CLI_HOST        https://us.posthog.com
```

## How source maps upload

Source maps are injected and uploaded automatically as part of `npm run build` (`nuxt generate`). The `nitro:build:public-assets` hook in `nuxt.config.ts` runs two CLI steps after every build:

1. `posthog-cli sourcemap inject --directory '.output'` — stamps each JS chunk with a `//# chunkId=…` comment so PostHog can match bundles to their maps
2. `posthog-cli sourcemap upload --directory '.output' --delete-after` — uploads the `.map` files and deletes them so they aren't served publicly

## Build command

```bash
npm run build
```

## Run command (to serve the production build locally)

```bash
npm run preview
```

> Note: PostHog is disabled on `localhost:30xx` by the plugin at `app/plugins/posthog.ts`. To test locally with PostHog active, serve the build on a different port: `npx serve .output/public -l 5001`

## CI / deploy — manual action required

The GitHub Actions workflow (`create-release.yml`) does **not** run `npm run build` — it only creates release tags. The production web build runs on an external hosting platform (Netlify, Vercel, or similar) that could not be traced in this repository.

**You must add these secrets wherever your production build runs:**

| Variable | Value |
|----------|-------|
| `POSTHOG_CLI_API_KEY` | Your personal API key (error_tracking:write + organization:read scopes) |
| `POSTHOG_CLI_PROJECT_ID` | `99168` |
| `POSTHOG_CLI_HOST` | `https://us.posthog.com` |

- **Netlify**: Site settings → Environment variables
- **Vercel**: Project settings → Environment variables
- **GitHub Actions** (if a build job is added later): Settings → Secrets and variables → Actions

Without these, source maps will only upload when you run `npm run build` locally.

## Verify the upload

After running `npm run build`, check the Symbol sets page in PostHog — a new symbol set should appear within a few seconds:

https://us.posthog.com/project/99168/error_tracking/configuration

To test manually:
1. `npm run build`
2. `npx serve .output/public -l 5001`
3. Open `http://localhost:5001`, sign in, open DevTools Console and run:
   ```js
   posthog.captureException(new Error('PostHog source maps test'))
   ```
4. Check Error Tracking — the stack trace should point at real source file paths, not minified bundle paths.
