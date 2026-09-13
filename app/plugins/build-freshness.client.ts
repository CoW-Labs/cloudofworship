import posthog from "posthog-js"
import { useAppStore } from "~/store/app"
import useAppVersion from "~/composables/useAppVersion"
import { markBuildStale } from "~/utils/errorFilters"

/**
 * Reloads a tab that is running an older build than the one being served.
 *
 * The operator console is a single long-lived route — churches open it before a
 * service and leave it — so a tab routinely outlives the build it was served
 * from. `chunk-error.client.ts` covers the loud half of that: a lazy import
 * that 404s after a deploy. This covers the quiet half. A tab whose code is
 * months old but never imports anything new keeps running that code silently,
 * and every bug already fixed since is still live in it. Error tracking then
 * fills with crashes whose source no longer exists in the repository, pointing
 * at chunks the origin deleted long ago, which is worse than useless: the time
 * goes into re-finding a fix that already shipped.
 *
 * Two rules keep the cure from being worse:
 *
 *  1. **Never reload a screen anyone is looking at.** A reload only happens
 *     with nothing live and the operator demonstrably away from the keyboard.
 *     The projection windows never reload themselves at all — that blanks the
 *     congregation screen.
 *  2. **Never reload twice for the same version.** If a reload does not change
 *     the running version, reloading again will not either, and a tab that
 *     refreshes itself every few minutes mid-service is a far bigger failure
 *     than a stale one.
 */

/** Written into the build output by the `nitro:build:public-assets` hook. */
const VERSION_URL = "/version.json"

/** The first check is deliberately late: startup has enough to do. */
const FIRST_CHECK_DELAY_MS = 60_000
const CHECK_INTERVAL_MS = 30 * 60_000

/** How often the reload conditions are re-evaluated once a tab knows it is behind. */
const IDLE_POLL_MS = 30_000

/** No pointer, key or scroll for this long counts as "the operator is away". */
const IDLE_BEFORE_RELOAD_MS = 5 * 60_000

/** How long to wait for a quiet moment before also offering a manual reload. */
const PROMPT_AFTER_MS = 2 * 60_000

/** Windows that put something on a screen the congregation can see. */
const PROJECTION_ROUTES = ["/live", "/stage"]

/** Survives the reload it guards, which is the whole point of sessionStorage. */
const RELOAD_GUARD_KEY = "cow:stale-build-reload"

const readReloadGuard = (): string | null => {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY)
  } catch {
    // Private-mode Safari throws on access. Losing the guard only costs the
    // loop protection, so carry on without it.
    return null
  }
}

const writeReloadGuard = (version: string) => {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, version)
  } catch {}
}

const isProjectionWindow = () =>
  PROJECTION_ROUTES.some((route) => window.location.pathname.startsWith(route))

export default defineNuxtPlugin((nuxtApp) => {
  const runningVersion = useAppVersion().appVersion
  const appStore = useAppStore()

  let lastInteractionAt = Date.now()
  let hiddenSince: number | null =
    document.visibilityState === "hidden" ? Date.now() : null
  let detectedAt = 0
  let promptShown = false
  let reloading = false
  let idleTimer: ReturnType<typeof setInterval> | null = null

  const noteInteraction = () => {
    lastInteractionAt = Date.now()
  }
  for (const event of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(event, noteInteraction, { passive: true })
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenSince = Date.now()
      return
    }
    hiddenSince = null
    noteInteraction()
    // Coming back to a tab is the cheapest moment to find out it is behind.
    void check()
  })

  /**
   * A tab is safe to reload when nothing it owns is on a screen and nobody is
   * using it. Both halves matter: an idle operator with a slide live is still
   * mid-service, and a busy operator with nothing live is still mid-sentence.
   */
  const isSafeToReload = () => {
    if (!navigator.onLine) return false
    if (isProjectionWindow()) return false
    if (appStore.currentState.liveSlideId) return false
    if (appStore.currentState.activeAlert) return false

    const away = Date.now() - lastInteractionAt >= IDLE_BEFORE_RELOAD_MS
    const backgrounded =
      hiddenSince !== null && Date.now() - hiddenSince >= IDLE_BEFORE_RELOAD_MS
    return away || backgrounded
  }

  const reload = (deployedVersion: string) => {
    if (reloading) return
    reloading = true
    writeReloadGuard(runningVersion)
    posthog.capture?.(
      "stale_build_reloaded",
      {
        running_version: runningVersion,
        deployed_version: deployedVersion,
        path: window.location.pathname,
      },
      { send_instantly: true }
    )
    // Full document reload rather than a router navigation: the point is to
    // fetch fresh HTML pointing at the chunks this build actually published.
    // Pinia persists to localStorage and slides live in IndexedDB, so the
    // schedule, settings and selection all survive.
    window.location.reload()
  }

  const promptToReload = (deployedVersion: string) => {
    if (promptShown || isProjectionWindow()) return
    promptShown = true

    nuxtApp.runWithContext(() => {
      useToast().add({
        title: "A new version of Cloud of Worship is ready",
        description:
          "This tab is still running an older version. Reload when you get a moment — it will also reload on its own once nothing is live.",
        icon: "i-bx-download",
        color: "primary",
        // Nuxt UI v2: 0 disables auto-dismiss. Nothing else tells the operator,
        // so it stays until they act on it.
        timeout: 0,
        actions: [
          {
            label: "Reload now",
            click: () => reload(deployedVersion),
          },
        ],
      })
    })
  }

  const onStale = (deployedVersion: string) => {
    // Exceptions thrown by code this build no longer contains are noise: the
    // fix has already shipped, the frames point at chunks the origin deleted,
    // and there is nothing anyone can act on. Dropped from here on.
    markBuildStale()

    if (detectedAt) return
    detectedAt = Date.now()

    posthog.capture?.("stale_build_detected", {
      running_version: runningVersion,
      deployed_version: deployedVersion,
      path: window.location.pathname,
    })

    // A reload that did not change the running version will not change it next
    // time either — a CDN still serving old HTML, or a build whose version.json
    // moved ahead of its assets. Ask once, then leave the tab alone.
    if (readReloadGuard() === runningVersion) {
      promptToReload(deployedVersion)
      return
    }

    const tick = () => {
      if (isSafeToReload()) {
        reload(deployedVersion)
        return
      }
      if (!promptShown && Date.now() - detectedAt >= PROMPT_AFTER_MS) {
        promptToReload(deployedVersion)
      }
    }

    tick()
    if (!idleTimer) idleTimer = setInterval(tick, IDLE_POLL_MS)
  }

  const check = async () => {
    if (!runningVersion || !navigator.onLine || reloading) return

    try {
      const response = await fetch(VERSION_URL, { cache: "no-store" })
      if (!response.ok) return
      const deployedVersion = (await response.json())?.appVersion
      // Only a confirmed mismatch counts. A missing or unreadable version must
      // never mark a tab stale: that would silence its error reports for the
      // rest of the session over a deploy that forgot to write the file.
      if (!deployedVersion || deployedVersion === runningVersion) return
      onStale(deployedVersion)
    } catch {
      // Offline, or the service worker served a cached copy. Either way this
      // tab has learnt nothing, which is the safe direction to fail in.
    }
  }

  const firstCheck = setTimeout(check, FIRST_CHECK_DELAY_MS)
  const interval = setInterval(check, CHECK_INTERVAL_MS)
  window.addEventListener("online", () => void check())

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearTimeout(firstCheck)
      clearInterval(interval)
      if (idleTimer) clearInterval(idleTimer)
    })
  }
})
