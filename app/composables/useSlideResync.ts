import { useOnline } from "@vueuse/core"
import { computed, onScopeDispose, reactive } from "vue"
import posthog from "posthog-js"
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import {
  flushSlideShadowWrites,
  useSlideRepository,
} from "~/composables/useSlideRepository"
import {
  getAPIErrorStatus,
  getConflictSlide,
  isConflictError,
  isNetworkError,
  isNotFoundError,
} from "~/utils/apiErrors"
import { forgetOwnSlideRev, noteSlideRev, runSlideSave } from "~/utils/slideRev"
import { notifySlideDatabaseChanged } from "~/composables/useSlideDatabaseNotifications"
import { onSocketConnected } from "~/composables/useSocketIO"
import { slideUpdatePath, toSlideUpdatePayload } from "~/utils/slideSync"

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
 * records marked "pending" rather than a second parallel store. An operator
 * edit is queued as it is written and cleared once its PUT is confirmed, which
 * also covers an edit made offline or lost to a tab closed mid-request.
 */

/**
 * Retry cadence while work is outstanding. The failure this recovers from
 * usually comes with `navigator.onLine` stuck at true, so an event-driven
 * trigger alone can wait forever. The timer is armed only while something is
 * pending and disarms as soon as the queue drains, so an idle app never polls.
 */
const RETRY_INTERVAL_MS = 30_000

/**
 * A slide edit the server refused because someone saved the slide first (409).
 * Both versions are kept: the person's edit stays in IndexedDB as a pending
 * record and the server's copy is held here, so nothing is overwritten until
 * they choose. Memory only on purpose. After a reload the pending record is
 * retried, meets the same 409 and lands back here, instead of a stored
 * "conflict" that could outlive the thing it describes.
 */
export type SlideConflict = {
  serverId: string
  scheduleId: string
  slideId: string
  serverSlide: Slide
  localSlide: Slide
  localRevision: number
}
const slideConflicts = reactive(new Map<string, SlideConflict>())
const rejectedRevisions = new Map<string, number>()

let flushInFlight: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let triggersInstalled = false
let onServerSlide: ((slide: Slide, acceptedTheirs: boolean) => void) | undefined

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

export const scheduleSlideResync = () => {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushPendingSlides()
  }, RETRY_INTERVAL_MS)
}

/**
 * The editor and retry queue share the same write path. Re-read the durable
 * draft after taking the lock so a completed or superseded edit never sends.
 */
export const savePendingSlide = (
  churchId: string,
  scheduleId: string,
  slideId: string,
  serverId: string,
  resolution?: SlideConflict
) =>
  runSlideSave(serverId, async () => {
    const conflict = slideConflicts.get(serverId)
    if (conflict !== resolution) return { status: "skipped" } as const

    await flushSlideShadowWrites()
    const repository = useSlideRepository()
    const record = await repository.getStoredSlide(scheduleId, slideId)
    if (
      record?.serverId !== serverId ||
      !record.resyncRequestedAt ||
      record.deletedAt ||
      (record.slide.churchId && record.slide.churchId !== churchId)
    ) {
      if (resolution) slideConflicts.delete(serverId)
      return { status: "skipped" } as const
    }
    if (resolution && resolution.localRevision !== record.localRevision) {
      slideConflicts.set(serverId, {
        ...resolution,
        localSlide: record.slide,
        localRevision: record.localRevision,
      })
      return { status: "conflict" } as const
    }

    const body = await toSlideUpdatePayload(
      record.slide,
      resolution ? resolution.serverSlide.rev ?? 0 : undefined
    )
    const send = () =>
      useAPIFetch<Slide>(slideUpdatePath(churchId, scheduleId, serverId), {
        method: "PUT",
        body,
      })
    const { data, error } = await (resyncNuxtApp
      ? resyncNuxtApp.runWithContext(send)
      : send())
    if (!error?.value) {
      rejectedRevisions.delete(serverId)
      const saved = data?.value
      noteSlideRev(serverId, saved?.rev)
      await repository.markSlideSyncState(
        scheduleId,
        slideId,
        "synced",
        record.localRevision,
        saved?.rev
      )
      slideConflicts.delete(serverId)
      if (saved) onServerSlide?.(saved, false)
      return { status: "saved", slide: saved } as const
    }

    const serverSlide = getConflictSlide(error.value)
    if (isConflictError(error.value) && serverSlide) {
      await flushSlideShadowWrites()
      const latest =
        (await repository.getStoredSlide(scheduleId, slideId)) ?? record
      slideConflicts.set(serverId, {
        serverId,
        scheduleId,
        slideId,
        serverSlide,
        localSlide: latest.slide,
        localRevision: latest.localRevision,
      })
      usePosthogCapture("SLIDE_CONFLICT_DETECTED", {
        slideType: latest.slide.type,
      })
      return { status: "conflict" } as const
    }

    if (isNotFoundError(error.value)) {
      await repository.markSlideSyncState(
        scheduleId,
        slideId,
        "synced",
        record.localRevision
      )
      slideConflicts.delete(serverId)
      rejectedRevisions.delete(serverId)
      return { status: "missing" } as const
    }

    const status = getAPIErrorStatus(error.value)
    if (
      status &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    ) {
      // Keep the draft, but don't send an identical rejected body every 30s.
      rejectedRevisions.set(serverId, record.localRevision)
    } else if (!resolution) {
      scheduleSlideResync()
    }
    return { status: "failed", error: error.value } as const
  })

/** Push pending edits without duplicating a concurrent retry pass. */
export const flushPendingSlides = async (): Promise<void> => {
  if (flushInFlight) return flushInFlight

  const runFlush = async () => {
    const churchId = useAuthStore().user?.churchId
    const appStore = useAppStore()
    const repository = useSlideRepository()
    const isRetryable = (record: {
      serverId?: string
      localRevision: number
      slide: Slide
    }) =>
      !!record.serverId &&
      !slideConflicts.has(record.serverId) &&
      rejectedRevisions.get(record.serverId) !== record.localRevision &&
      (!churchId ||
        !record.slide.churchId ||
        record.slide.churchId === churchId)

    try {
      await flushSlideShadowWrites()
      const records = (await repository.getPendingSlides()).filter(isRetryable)
      if (!records.length) {
        disarmRetry()
        return
      }
      if (!churchId || !navigator.onLine) {
        scheduleSlideResync()
        return
      }

      let delivered = 0
      let failed = 0
      for (const record of records) {
        const result = await savePendingSlide(
          churchId,
          record.scheduleId,
          record.id,
          record.serverId!
        )
        if (result.status === "saved") delivered += 1
        if (result.status === "conflict") failed += 1
        if (result.status === "failed") {
          failed += 1
          if (isNetworkError(result.error)) break
          console.error("Slide resync rejected by server:", result.error)
        }
      }

      if (delivered) {
        appStore.setLastSynced(new Date().toISOString())
        posthog.capture?.("slide_resync_delivered", {
          delivered,
          failed,
          queued: records.length,
        })
      }

      const remaining = await repository.getPendingSlides()
      if (remaining.some(isRetryable)) scheduleSlideResync()
      else disarmRetry()
    } catch (error) {
      console.error("Slide resync failed:", error)
      scheduleSlideResync()
    }
  }

  flushInFlight = (
    resyncNuxtApp ? resyncNuxtApp.runWithContext(runFlush) : runFlush()
  ).finally(() => {
    flushInFlight = null
  })

  return flushInFlight
}

const resolveKeepMine = async (serverId: string) => {
  const conflict = slideConflicts.get(serverId)
  const churchId = useAuthStore().user?.churchId
  if (!conflict || !churchId) return false
  const result = await savePendingSlide(
    churchId,
    conflict.scheduleId,
    conflict.slideId,
    serverId,
    conflict
  )
  if (result.status === "failed") throw result.error
  if (result.status !== "saved") return false
  useAppStore().setLastSynced(new Date().toISOString())
  return true
}

const resolveKeepTheirs = (serverId: string) => {
  const appStore = useAppStore()
  return runSlideSave(serverId, async () => {
    const conflict = slideConflicts.get(serverId)
    if (!conflict) return false
    await flushSlideShadowWrites()
    const repository = useSlideRepository()
    const draft = await repository.getStoredSlide(
      conflict.scheduleId,
      conflict.slideId
    )
    if (
      draft?.serverId !== serverId ||
      !draft.resyncRequestedAt ||
      draft.deletedAt
    ) {
      slideConflicts.delete(serverId)
      return false
    }
    if (draft.localRevision !== conflict.localRevision) {
      slideConflicts.set(serverId, {
        ...conflict,
        localSlide: draft.slide,
        localRevision: draft.localRevision,
      })
      return false
    }
    const slide = {
      ...conflict.serverSlide,
      _id: serverId,
      id: conflict.slideId,
      scheduleId: conflict.scheduleId,
      rev: conflict.serverSlide.rev ?? 0,
    }
    if (!(await repository.replacePendingSlide(slide, draft.localRevision))) {
      return false
    }
    if (appStore.activeSlidesById.has(slide.id)) {
      appStore.setActiveSlides(
        appStore.activeSlides.map((active) =>
          active.id === slide.id && active.scheduleId === slide.scheduleId
            ? slide
            : active
        )
      )
    }
    notifySlideDatabaseChanged()
    forgetOwnSlideRev(serverId)
    rejectedRevisions.delete(serverId)
    slideConflicts.delete(serverId)
    onServerSlide?.(slide, true)
    return true
  })
}

export const useSlideConflicts = () => {
  const authStore = useAuthStore()
  return {
    conflicts: computed(() =>
      [...slideConflicts.values()].filter(
        ({ localSlide }) => localSlide.churchId === authStore.user?.churchId
      )
    ),
    resolveKeepMine,
    resolveKeepTheirs,
  }
}

export const hasSlideConflict = (serverId?: string) =>
  !!serverId && slideConflicts.has(serverId)

/**
 * Install the flush triggers. Idempotent — the operator window may mount the
 * host component more than once, and the queue is process-wide.
 */
export const useSlideResync = (onSlide?: typeof onServerSlide) => {
  if (onSlide) {
    onServerSlide = onSlide
    onScopeDispose(() => {
      if (onServerSlide === onSlide) onServerSlide = undefined
    })
  }
  if (triggersInstalled) return { flushPendingSlides }
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
  onSocketConnected(() => void flushPendingSlides())

  // Anything left pending from a previous session — a tab closed or crashed
  // before the queue drained — is only recoverable at startup.
  void flushPendingSlides()

  return { flushPendingSlides }
}

export default useSlideResync
