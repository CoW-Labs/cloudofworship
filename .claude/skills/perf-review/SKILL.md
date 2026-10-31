---
name: perf-review
description: Review recent frontend changes (the last week by default, or a commit range, or uncommitted work) for performance problems on low-end church laptops, plus any bugs found on the way, then lay the findings out and fix the clear ones. Use when the user says "review the last week's changes for performance", "check for bottlenecks", "will this run on cheaper laptops", "memory keeps climbing", "perf review", or "/perf-review [range]".
---

# Low-end performance review

Most churches run Cloud of Worship on budget Windows laptops, often with the operator window, the `/live` projector window and a video or interlude all running at once. A review asks one question of every change: what does this cost on a 4 GB, 4-thread laptop with integrated graphics, mid-service?

The argument is the range. No argument means the last 7 days of commits on the current branch. "uncommitted" means `git diff` plus untracked files.

## 1. Confirm the hardware mix first

Check PostHog (project 99168) before reviewing, and put the numbers at the top of the report. Every event carries `device_memory_gb` and `hardware_concurrency` (added 2026-09-30).

```sql
SELECT toString(properties.device_memory_gb) AS ram_gb, uniq(person_id) AS users
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND event = '$pageview'
  AND properties.$host = 'app.cloudofworship.com'
GROUP BY ram_gb ORDER BY users DESC LIMIT 20
```

Run it again with `properties.hardware_concurrency`. Notes:
- `deviceMemory` only exists in Chromium and is rounded, so read "8" as "8 or more". Safari and Firefox users show as null.
- One person can show in two buckets (two devices).
- 2026-10-31 baseline (30 days): about 150 users at 4 GB or less (18% of those reporting) and about 335 at 4 threads or fewer (36%).

## 2. Collect every change

```bash
git log --since="7 days ago" --format="%h %ad %s" --date=short
git diff <oldest>~1 HEAD --stat
git diff <oldest>~1 HEAD -- app > <scratchpad>/range.diff
```

Read the whole diff, every file. Read the surrounding code too when a change touches a loop, a watcher, a lifecycle hook, media, a canvas or a store action. Splash and SVG changes can be read separately, but still read them.

## 3. Check each change against this list

**Memory that only grows**
- Components kept mounted forever, or caches with no cap or eviction.
- `emitter.on`, `addEventListener`, sockets, `setInterval`, `requestAnimationFrame`, `ResizeObserver`, `IntersectionObserver` with no matching cleanup on unmount.
- Blob URLs never revoked. Canvases never shrunk to 0 after use.
- pdf.js documents never destroyed. Each `getDocument` starts its own worker thread.
- A `<video>` created for slides that have no video (use `v-if`, not `v-show`). Thumbnails without `preload="metadata"`.

**Hidden things still running**
- Elements at `opacity: 0` or `v-show` false still decode video, capture a camera, or animate a canvas. Remove them with `v-if` once a fade ends; pause videos you need to resume.
- Swapping components with `v-if` remounts them, which restarts videos and reopens cameras.

**Video and camera load**
- Count decoders that run together: pair members, picture-in-picture, backdrop videos, Live Output preview plus `/live`. Celeron and Intel UHD machines often cannot decode three 1080p streams in hardware.
- A second camera on a shared USB 2.0 hub may fail to start. Small insets should ask for preview quality.

**Animation and paint**
- Animate only `transform` and `opacity`. Animating `box-shadow`, `filter`, `width`, `height`, `top`, `left` or `font-size` repaints or re-lays out every frame.
- Infinite animations must stop (a set number of cycles) or pause when hidden or tucked away.
- `backdrop-filter` is re-blurred every time anything behind it moves. The Live Output panel moves constantly, and stacked blurred panes each cost a pass. Modal overlays use `backdrop-blur-sm` over the whole window.
- Transforms on SVG children repaint the SVG every frame.

**Canvas and interlude engine**
- No allocations inside the frame loop (arrays, objects, closures, `Math.hypot`). Work out per-frame constants once per frame.
- Previews cap at 30fps and pause off screen. The projector holds 60fps and steps quality down.

**Re-render cost**
- `.find` or `.filter` over every slide inside a per-card computed or template. Use `activeSlidesById` and `slidePairsById`.
- Replacing a whole array (`slidePairs`, `activeSlides`) re-renders every card.
- Props built as fresh objects on every render.

**Layout thrash**
- Measuring inside loops. Text-fitting that reruns on resize, text change, font load and clock ticks: merge triggers into one per animation frame and skip when nothing changed.

**Network**
- Parallel duplicate requests: share one in-flight promise.
- Retries need an attempt count, a last-tried time and a backoff.
- Batch updates that send the whole schedule when only a few slides changed.

**Storage and cross-window sync**
- IndexedDB writes on every Up/Down, full schedule rewrites, and `pinia-shared-state` serialising large state to the other window on each change.

**Startup**
- Work that every `AppSection` or card repeats on mount. PostHog flag reloads on mount (subscribe instead). Heavy imports that could be lazy.

**Live service**
- Nothing may lock a church out or slow it down mid-service. Limits fail open.

**Bugs**
- Note any bug found on the way: races (edits during upload), stale state, wrong ids, API contract mismatches. Check the backend repo when the client depends on an API rule.

## 4. Measure before claiming a gain

- For engine or loop code, write a small benchmark in the scratchpad and report before and after (for example, garbage per frame and JS time per frame).
- Do **not** start the browser preview or take screenshots unless the user asks that turn. Say what was not checked in a browser instead.
- If the user is watching memory climb on `npm run dev`, Vite hot reload and Vue devtools grow memory on their own. Compare against a production build.

## 5. Report

Lead with a one-line answer, then:

1. **Who is affected:** the PostHog table.
2. **Findings, most serious first.** Each one says what happens, where (file links with line numbers and the commit hash), why it matters on a low-end laptop, and the fix. Say when the code is older than the range.
3. **Your call:** changes that would alter a look or behaviour the user shipped on purpose, with a recommendation.
4. **Looked fine:** a short list, so the user knows it was checked.
5. **Not verified:** what was not run in a browser or measured.

Keep the copy short and plain. No em dashes.

## 6. Fix

"Lay it out and address it" means fix as well. Fix the clear wins that keep the look the same. Leave design or behaviour changes as "your call". Engine rewrites only go ahead when measured gains are large.

Then verify:

```bash
npx vitest run
npx vue-tsc --noEmit -p tsconfig.json
```

CLAUDE.md says there is no test suite, but there is a vitest suite. Both have older failures (26 failing tests and 95 type errors on 2026-10-31). Compare against a baseline: `git stash push -- <changed files>`, rerun, `git stash pop`, and report only what changed.

Commit only when asked: to `staging`, with a `fix:` or `chore:` subject, authored as felixfavour, and no Co-Authored-By trailer.

## Decisions already made (do not raise again)

- 2026-09-30: the user declined holding the Live Output interlude on a still frame while `/live` is open. Two animated interlude windows are accepted.
- Fixed before, so a regression is a finding: thumbnails unload 600px off screen; `<video>` only for video backgrounds, with `preload="metadata"` in thumbnails; zero-allocation interlude engine; the mic pulse is a transform/opacity pseudo-element; one shared `GET /usage`; upload retry backoff (1 min, 5 min, 30 min, 2 h, then every 6 h); no flag reload on mount; hidden pair members removed after the fade; text-fit triggers merged per frame; maps instead of `.find` in pair cards; toasts drift once and tucked toasts skip the blur; pdf.js documents destroyed and canvases released after a PDF import.

## Older items still open (check whether they still are)

- `PreviewContent.vue` registers about 35 `emitter.on` handlers and never removes them. They pile up only if the operator page unmounts and remounts (for example, a visit to `/update` and back).
- Every modal overlay blurs the whole window. A "lite effects" mode for 4 GB or 4-thread machines (no `backdrop-filter`, no decorative infinite animation) would cover these at once.
