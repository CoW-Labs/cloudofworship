# PostHog Source Maps — Diagnosis & Fix

## Symptom

PostHog Error Tracking showed minified frames (`/_nuxt/DehTS3zn.js`) for errors from the
web app, even though thousands of symbol sets had been uploaded. Errors originating from
local/desktop builds *were* symbolicated (`app/composables/useURLFriendlyString.ts`), which
narrowed the problem to the production web build.

## Root causes

Three independent faults, all in the `nitro:build:public-assets` hook in `nuxt.config.ts`
and its environment.

### 1. `POSTHOG_CLI_API_KEY` was never set on Vercel

`POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` had been added to the Vercel project, but
the API key had not. Every production build failed at the first CLI step with:

```
Couldn't find POSTHOG_CLI_API_KEY and POSTHOG_CLI_PROJECT_ID in process env
```

### 2. The output directory was hardcoded to `.output`

The local build writes to `.output/public`, but Vercel's Nitro preset writes to
`.vercel/output/static`. `.output` does not exist on Vercel at all, so even with valid
credentials the CLI would have found zero chunks to inject. The hook now takes the
directory from `nitro.options.output.publicDir`, which is correct under every preset.

### 3. The failure was swallowed

`try/catch` logged the error and let the build succeed, so ~every production deploy since
setup shipped unsymbolicated bundles with no signal that anything was wrong.

## Why the symbol sets looked fine

5,600+ symbol sets existed in PostHog — all uploaded from **local** `npm run build` runs,
where `.output` happens to be the right path. Every one had `last_used: null`: the JS
actually served from `cloudofworship.com` carried no `//# chunkId=` stamp, so nothing could
ever match them.

## Changes made

| File | Change |
|------|--------|
| `nuxt.config.ts` | Directory now read from `nitro.options.output.publicDir`; explicit skip-with-warning when credentials are absent; loud `SOURCEMAP UPLOAD FAILED` banner on error; symbol sets tagged with `--release-name`/`--release-version` from `VERCEL_GIT_COMMIT_SHA`/`GITHUB_SHA`; `--skip-on-conflict` so a repeated chunk hash cannot fail a deploy |
| `.github/workflows/create-release.yml` | Corrected the documented `POSTHOG_CLI_HOST` (was the `us.i.posthog.com` ingestion host, which does not serve the symbol-set endpoints) and noted that Vercel — not this workflow — runs the web build |

The hook stays non-fatal: a PostHog outage should not block a deploy. It is now just
impossible for it to fail quietly.

## Verification

`NITRO_PRESET=vercel npm run build` reproduces the Vercel preset locally:

```
[posthog] Injecting and uploading sourcemaps from .../.vercel/output/static
found 127 pairs
Found 127 chunks to upload
Server returned 50 / 50 / 27 upload keys
[posthog] Sourcemap upload completed successfully
```

All 127 emitted chunks carry a `//# chunkId=` stamp and every `.map` is deleted from the
output, so no source is served publicly.

## Remaining manual step

`POSTHOG_CLI_API_KEY` still has to be added to the Vercel project (Production scope) —
without it the fix above changes nothing on real deploys:

```bash
vercel env add POSTHOG_CLI_API_KEY production --sensitive
```

Paste the `phx_…` personal API key from `.env` when prompted. It needs the
`error_tracking:write` and `organization:read` scopes.

Also re-set `POSTHOG_CLI_HOST` if you are not certain of its stored value — it must be
`https://us.posthog.com`, the API host. Earlier documentation in this repo said
`https://us.i.posthog.com`, which is the ingestion host and will fail the upload:

```bash
vercel env rm POSTHOG_CLI_HOST production && vercel env add POSTHOG_CLI_HOST production
```

## Confirming it worked

After the next production deploy:

```bash
curl -s https://cloudofworship.com/_nuxt/<chunk>.js | tail -c 100
```

should end in `//# chunkId=…`. New Error Tracking issues will then show `.ts`/`.vue`
sources instead of `/_nuxt/*.js`.
