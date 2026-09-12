/**
 * The single list of errors we deliberately do not report.
 *
 * Both the Vue error handler (plugins/error-handler.client.ts) and PostHog's
 * `before_send` (plugins/posthog.ts) filter through here. That matters: PostHog
 * installs its *own* window.onerror / unhandledrejection listeners for
 * exception autocapture, so calling `event.preventDefault()` in our handler
 * does nothing to stop a report. `before_send` is the only hook that reliably
 * drops an event, which is why these two lists must never drift apart again.
 */

import { isHandledChunkLoadError } from "~/utils/chunkErrors"

/** Exact `error.message` matches. */
export const IGNORED_ERROR_MESSAGES = new Set([
  "Permissions check failed",
  "Script error.",
])

/** Exact `error.name` / exception-type matches. */
export const IGNORED_ERROR_NAMES = new Set([
  "AbortError",
  "NotAllowedError",
  "NotSupportedError",
])

/**
 * Substrings matched against the message *and* the exception type. Each entry
 * is a known-benign condition rather than a bug we can act on:
 *
 * - media `play()` races, permission prompts and display probing are expected
 *   outcomes of browser policy, already handled at the call site
 * - ResizeObserver loop warnings are spec-mandated notifications, not errors;
 *   the browser has already re-run layout by the time we see them
 * - WebKit aborts IndexedDB transactions it considers idle — Dexie retries
 * - the Nuxt build manifest is gone for clients still running an older build
 *   (see `experimental.appManifest: false`); those clients heal on next reload
 */
export const IGNORED_ERROR_FRAGMENTS = [
  "play() request was interrupted",
  "No internet connection",
  "Failed to get browser displays",
  "Auto-detect secondary display",
  "Transient activation is required",
  "Permission denied",
  "MetaMask extension not found",
  "Failed to fetch this Firebase app's measurement ID",
  "ResizeObserver loop completed with undelivered notifications",
  "ResizeObserver loop limit exceeded",
  "Transaction timed out due to inactivity",
  "/_nuxt/builds/meta/",
]

/**
 * Set by `plugins/build-freshness.client.ts` once this tab has confirmed the
 * origin is serving a newer build than the one it is running.
 *
 * Everything such a tab throws is unactionable. The code is not in the
 * repository any more, so the "fix" has already shipped; the frames point at
 * chunks the origin deleted on deploy, so they cannot be symbolicated; and the
 * fingerprint changes with every build, so each stale client opens a fresh
 * issue that looks like a new regression. Three of those cost an afternoon
 * before this flag existed. The tab reports `stale_build_detected` instead,
 * which is the one fact worth knowing about it.
 *
 * Deliberately one-way: a tab that has fallen behind does not catch up without
 * a reload, and a reload resets this.
 */
let buildIsStale = false

export const markBuildStale = () => {
  buildIsStale = true
}

export const isBuildStale = () => buildIsStale

const matchesFragment = (text: string) =>
  IGNORED_ERROR_FRAGMENTS.some((fragment) => text.includes(fragment))

/** Filter for a thrown value (Vue errorHandler, unhandledrejection). */
export const shouldSuppressError = (error: unknown) => {
  const err = error as Error | undefined

  // Deliberately evaluated before the stale-build check: this call is what
  // hands a dead chunk to the reload plugin, and a stale tab is the one most
  // likely to hit one. Short-circuiting past it would strand the very tab the
  // recovery exists for. A dead post-deploy chunk the plugin is already healing
  // is then suppressed; the unrecoverable case still reports.
  if (isHandledChunkLoadError(err?.message)) return true

  if (buildIsStale) return true
  if (!err) return false
  return Boolean(
    (err.message && IGNORED_ERROR_MESSAGES.has(err.message)) ||
      (err.name && IGNORED_ERROR_NAMES.has(err.name)) ||
      (err.message && matchesFragment(err.message))
  )
}

/** Filter for a PostHog `$exception` event, which carries no Error instance. */
export const shouldSuppressExceptionEvent = (event: any) => {
  const properties = event?.properties || {}
  const exceptionList = Array.isArray(properties.$exception_list)
    ? properties.$exception_list
    : []

  const message = properties.$exception_message

  const text = [
    message,
    properties.$exception_type,
    ...exceptionList.flatMap((exception: any) => [
      exception?.type,
      exception?.value,
      exception?.message,
    ]),
  ]
    .filter(Boolean)
    .join("\n")

  // Same ordering as `shouldSuppressError`: the chunk check notifies recovery,
  // so it has to run whether or not this tab already knows it is behind.
  if (text && isHandledChunkLoadError(text)) return true

  if (buildIsStale) return true

  if (message && IGNORED_ERROR_MESSAGES.has(message)) return true

  const types = [
    properties.$exception_type,
    ...exceptionList.map((exception: any) => exception?.type),
  ].filter(Boolean)
  if (types.some((type: string) => IGNORED_ERROR_NAMES.has(type))) return true

  return Boolean(text && matchesFragment(text))
}
