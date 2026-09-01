import posthog from "posthog-js"

/**
 * Recovers a tab whose lazily-imported chunks no longer exist on the origin.
 *
 * Every deploy publishes a fresh set of hashed `_nuxt/*` files and drops the
 * previous set. The operator console is a single long-lived route — churches
 * leave it open for a whole service, and PostHog shows sessions running past
 * 24 hours — so a tab routinely outlives the build it was served from. The
 * moment it lazily imports anything after a deploy the request 404s, and the
 * feature the operator just clicked silently does nothing.
 *
 * Nuxt ships a handler for this (`experimental.emitRouteChunkError`, default
 * 'automatic') but it only reloads from `router.onError` — i.e. when the dead
 * chunk aborted a *route navigation*. This app barely navigates, so that path
 * effectively never fires and the tab stays broken until someone thinks to
 * refresh. nuxt.config.ts sets the option to 'manual' so Nuxt still emits
 * `app:chunkError` but installs neither built-in plugin, leaving the policy
 * here.
 */

/** Timestamps of reloads this plugin has triggered, newest last. */
const ATTEMPTS_KEY = "cow:chunk-reload-attempts"

/**
 * A deploy needs exactly one reload to heal. More than this inside the window
 * means reloading is not fixing it — an ad blocker, a half-broken CDN, a
 * captive portal — and continuing would trap the operator in a refresh loop
 * that wipes what they were doing every few seconds. Losing a feature is bad;
 * losing the console mid-service is worse.
 */
const MAX_ATTEMPTS = 2
const ATTEMPT_WINDOW_MS = 3 * 60_000

/** Chunk errors arrive in bursts (one per failed import) — reload once. */
const COALESCE_MS = 300

/** Uptime after which the tab is considered healed and the count is cleared. */
const HEALTHY_UPTIME_MS = 60_000

const readAttempts = (): number[] => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) || "[]")
    if (!Array.isArray(raw)) return []
    const cutoff = Date.now() - ATTEMPT_WINDOW_MS
    return raw.filter((at: unknown) => typeof at === "number" && at > cutoff)
  } catch {
    // Private-mode Safari throws on sessionStorage access. Treating that as
    // "no attempts" keeps recovery working; only the loop guard is lost.
    return []
  }
}

const writeAttempts = (attempts: number[]) => {
  try {
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts))
  } catch {}
}

const clearAttempts = () => {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY)
  } catch {}
}

export default defineNuxtPlugin((nuxtApp) => {
  let reloadScheduled = false
  let sawChunkError = false
  let waitingForOnline = false

  // A clean run means whatever went wrong is behind us. Without this, one
  // failure would count against an unrelated failure days later in the same tab.
  setTimeout(() => {
    if (!sawChunkError) clearAttempts()
  }, HEALTHY_UPTIME_MS)

  const recover = (message: string) => {
    if (reloadScheduled) return

    // Offline is a different failure with the same symptom: the chunk is
    // missing from the service worker cache and unreachable. Reloading now
    // just costs the operator their view for nothing, so wait for the network.
    if (!navigator.onLine) {
      if (waitingForOnline) return
      waitingForOnline = true
      window.addEventListener(
        "online",
        () => {
          waitingForOnline = false
          recover(message)
        },
        { once: true }
      )
      return
    }

    const attempts = readAttempts()

    if (attempts.length >= MAX_ATTEMPTS) {
      posthog.capture?.("chunk_load_unrecoverable", {
        chunk_error: message,
        attempts: attempts.length,
        path: window.location.pathname,
      })

      // Never on the projector — a toast there is shown to the congregation.
      if (!window.location.pathname.startsWith("/live")) {
        nuxtApp.runWithContext(() => {
          useToast().add({
            title: "Some features could not load",
            description:
              "The app was updated while this tab was open and reloading has not fixed it. Close the tab and open Cloud of Worship again.",
            icon: "i-bx-error",
            color: "amber",
            // Nuxt UI v2: 0 disables auto-dismiss. This is the only prompt the
            // operator gets, so it must stay until they act on it.
            timeout: 0,
            actions: [
              {
                label: "Reload anyway",
                click: () => {
                  clearAttempts()
                  window.location.reload()
                },
              },
            ],
          })
        })
      }
      return
    }

    reloadScheduled = true

    setTimeout(() => {
      writeAttempts([...attempts, Date.now()])
      posthog.capture?.("chunk_load_recovered_by_reload", {
        chunk_error: message,
        attempt: attempts.length + 1,
        path: window.location.pathname,
      })
      // Full document reload, not a router navigation: the point is to fetch
      // fresh HTML pointing at the chunks this build actually published.
      // Pinia persists to localStorage, so the schedule and settings survive.
      window.location.reload()
    }, COALESCE_MS)
  }

  nuxtApp.hook("app:chunkError", ({ error }) => {
    sawChunkError = true
    recover((error as Error)?.message || "Unknown chunk load error")
  })
})
