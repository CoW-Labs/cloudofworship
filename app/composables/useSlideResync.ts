import { useOnline } from "@vueuse/core"
import posthog from "posthog-js"
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import {
  flushSlideShadowWrites,
  useSlideRepository,
} from "~/composables/useSlideRepository"
import { isNetworkError, isNotFoundError } from "~/utils/apiErrors"
import {
  isMediaVideoSlide,
  slideUpdatePath,
  toSlideUpdatePayload,
} from "~/utils/slideSync"

/**
 * Re-sends slide edits whose PUT never reached the server.
 *
 * The API's socket layer is a pure relay — `update-slide` fans out to the
 * schedule room and writes nothing — so the REST PUT is the only path to the
 * database. When that request fails at the network layer the edit exists only
 * in this browser: collaborators hold it in memory until they reload, and the
 * server never hears about it. `useAPIFetch`'s offline queue does not cover
 * this, because it only fills when the app already knows it is offline, and it
 * excludes slide paths even then. These failures happen while `navigator.onLine`
 * is still true — flaky venue wifi and captive portals — so nothing catches them.
 *
 * The repository already tracks `syncState`, so the retry queue is the set of
 * records marked "pending" rather than a second parallel store.
 */

/**
 * Retry cadence while work is outstanding. The failure this recovers from
 * usually comes with `navigator.onLine` stuck at true, so an event-driven
 * trigger alone can wait forever. The timer is armed only while something is
 * pending and disarms as soon as the queue drains, so an idle app never polls.
 */
const RETRY_INTERVAL_MS = 30_000

let flushInFlight: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let triggersInstalled = false

/**
 * Captured at install time. Flushes fire from timers and socket callbacks,
 * where the Nuxt instance is no longer implicit — and `useAPIFetch` reaches for
 * `useRuntimeConfig()`, which throws without one. Running the pass inside this
 * context keeps the retry path working from anywhere.
 */
let resyncNuxtApp: ReturnType<typeof useNuxtApp> | null = null

const disarmRetry = () => {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

const armRetry = () => {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushPendingSlides()
  }, RETRY_INTERVAL_MS)
}

/**
 * Mark a slide as not yet delivered so the next flush picks it up. Called from
 * the edit path when a PUT fails at the network layer.
 */
export const markSlideUnsynced = async (slide: Slide) => {
  if (!slide?.scheduleId || !slide?.id) return
  try {
    // The editor write is coalesced. Flush it first so we mark the exact latest
    // durable snapshot, not an older record or no record at all.
    await flushSlideShadowWrites()
    const repository = useSlideRepository()
    await repository.markSlideSyncState(slide.scheduleId, slide.id, "pending")
    armRetry()
  } catch (error) {
    console.error("Failed to mark slide unsynced:", error)
  }
}

/**
 * Push every pending slide edit to the server. Safe to call concurrently —
 * overlapping callers await the in-flight pass rather than double-sending.
 */
export const flushPendingSlides = async (): Promise<void> => {
  if (flushInFlight) return flushInFlight

  const runFlush = async () => {
    const authStore = useAuthStore()
    const appStore = useAppStore()
    const repository = useSlideRepository()

    // Read the queue before any other guard. Arming the retry timer without
    // knowing there is work would leave a logged-out or offline app polling
    // every 30s forever, since each firing re-arms.
    let records: Awaited<ReturnType<typeof repository.getPendingSlides>>
    try {
      records = await repository.getPendingSlides()
    } catch (error) {
      console.error("Failed to read pending slides:", error)
      return
    }

    // A record with no `serverId` was never created server side. Those belong
    // to the create flow, which owns its own retry; a PUT to a nonexistent id
    // would 404 and delete the slide out from under the operator.
    const retryable = records.filter(
      (record) => record.serverId && !isMediaVideoSlide(record.slide)
    )
    if (!retryable.length) {
      disarmRetry()
      return
    }

    // Work is queued but we cannot send it yet. Keep the timer armed so the
    // pass repeats once sign-in completes or the connection returns.
    const churchId = authStore.user?.churchId
    if (!churchId || !navigator.onLine) {
      armRetry()
      return
    }

    let delivered = 0
    let failed = 0

    for (const record of retryable) {
      // `record` was read at the top of this pass, so it is the newest local
      // copy. An edit landing *during* the pass bumps `localRevision`, which
      // the guard on the "synced" write below catches.
      const slide = record.slide
      try {
        const { error } = await useAPIFetch(
          slideUpdatePath(churchId, slide.scheduleId, record.serverId!),
          { method: "PUT", body: toSlideUpdatePayload(slide) }
        )

        if (!error?.value) {
          delivered += 1
          await repository.markSlideSyncState(
            slide.scheduleId,
            slide.id,
            "synced",
            record.localRevision
          )
          continue
        }

        // The slide is gone server side. Retrying forever would keep the queue
        // permanently dirty, so drop it from the retry set and let the existing
        // 404 handling remove it from the schedule.
        if (isNotFoundError(error.value)) {
          await repository.markSlideSyncState(
            slide.scheduleId,
            slide.id,
            "synced",
            record.localRevision
          )
          continue
        }

        // Still unreachable — leave it pending for the next pass.
        if (isNetworkError(error.value)) {
          failed += 1
          break
        }

        // A real server rejection (validation, auth). Retrying an identical
        // body will fail identically, so stop retrying this one.
        failed += 1
        console.error("Slide resync rejected by server:", error.value)
        await repository.markSlideSyncState(
          slide.scheduleId,
          slide.id,
          "synced",
          record.localRevision
        )
      } catch (error) {
        failed += 1
        console.error("Slide resync failed:", error)
        break
      }
    }

    if (delivered) {
      appStore.setLastSynced(new Date().toISOString())
      posthog.capture?.("slide_resync_delivered", {
        delivered,
        failed,
        queued: retryable.length,
      })
    }

    // A local edit may have landed while the request was in flight. In that
    // case the revision guard above correctly leaves it pending, so determine
    // timer state from the database instead of the stale counters from this
    // pass. This also catches a different slide being queued concurrently.
    try {
      const remaining = await repository.getPendingSlides()
      if (
        remaining.some(
          (record) => record.serverId && !isMediaVideoSlide(record.slide)
        )
      ) {
        armRetry()
      } else {
        disarmRetry()
      }
    } catch (error) {
      console.error("Failed to verify pending slide queue:", error)
      armRetry()
    }
  }

  flushInFlight = (
    resyncNuxtApp ? resyncNuxtApp.runWithContext(runFlush) : runFlush()
  ).finally(() => {
    flushInFlight = null
  }) as Promise<void>

  return flushInFlight
}

/**
 * Install the flush triggers. Idempotent — the operator window may mount the
 * host component more than once, and the queue is process-wide.
 */
export const useSlideResync = () => {
  if (triggersInstalled) return { flushPendingSlides, markSlideUnsynced }
  triggersInstalled = true

  const nuxtApp = useNuxtApp()
  resyncNuxtApp = nuxtApp
  const online = useOnline()

  // Real offline → online transition.
  watch(online, (isOnline) => {
    if (isOnline) void flushPendingSlides()
  })

  // A socket reconnect is the most reliable signal that a flaky connection
  // recovered, which is the case `navigator.onLine` misses entirely.
  const socket = nuxtApp.$socketio as any
  socket?.on?.("connect", () => void flushPendingSlides())

  // Anything left pending from a previous session — a tab closed or crashed
  // before the queue drained — is only recoverable at startup.
  void flushPendingSlides()

  return { flushPendingSlides, markSlideUnsynced }
}

export default useSlideResync
