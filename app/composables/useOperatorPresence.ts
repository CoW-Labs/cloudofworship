import { postCrossWindowNotification } from "~/composables/useBroadcastPost"

/**
 * Whether an operator console is open on this computer, for the windows it
 * drives (the stage display). Without this a closed or crashed console looks
 * exactly like a quiet one: the stage keeps the last slide up as though it were
 * live, and the band reads on from words the room stopped seeing long ago.
 *
 * Two signals, because neither is enough alone:
 *
 *  - **A Web Lock** the console holds for as long as its page is alive. The
 *    browser releases it the moment the page closes, reloads or crashes, and
 *    it is unaffected by the timer throttling a minimised console gets. It
 *    may not cross separate desktop webviews, so it is only trusted to say
 *    "gone" once this window has seen it held.
 *  - **A heartbeat** over the live channel, which does cross desktop webviews
 *    (it is mirrored onto Tauri's event bus) but can be slowed to once a
 *    minute in a hidden browser tab.
 */

const OPERATOR_LOCK = "cow-operator-console"

/** How often the console says it is still there. */
const HEARTBEAT_INTERVAL = 5000

/** A console unheard from for this long, and not holding the lock, is gone. */
const HEARTBEAT_TIMEOUT = 20000

/** How often the stage checks. */
const CHECK_INTERVAL = 2000

/**
 * How long a console has to stay gone before the stage says so. An operator
 * reloading the console releases the lock and comes back within a second or
 * two, and that should not flash a red warning at the band.
 */
const LOSS_GRACE = 5000

export type OperatorHeartbeat = {
  kind: "operator-heartbeat"
  state: "alive" | "closing"
}

export const isOperatorHeartbeat = (
  payload: unknown
): payload is OperatorHeartbeat =>
  !!payload &&
  typeof payload === "object" &&
  (payload as OperatorHeartbeat).kind === "operator-heartbeat"

const locksAvailable = () =>
  typeof navigator !== "undefined" && !!navigator.locks?.request

/**
 * Console side: hold the lock and beat until the returned stop is called.
 * Called once per operator page, by useOperatorSession.
 */
export const announceOperatorPresence = () => {
  const beat = (state: OperatorHeartbeat["state"]) =>
    postCrossWindowNotification<OperatorHeartbeat>({
      kind: "operator-heartbeat",
      state,
    })

  let releaseLock: (() => void) | null = null
  if (locksAvailable()) {
    // Shared, so a second console in the same browser holds it alongside.
    navigator.locks
      .request(OPERATOR_LOCK, { mode: "shared" }, () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve
        })
      )
      .catch((error) =>
        console.warn("Unable to hold the operator presence lock:", error)
      )
  }

  // A page going away says so, rather than leaving the stage to time it out.
  const onPageHide = () => beat("closing")
  window.addEventListener("pagehide", onPageHide)

  beat("alive")
  const timer = setInterval(() => beat("alive"), HEARTBEAT_INTERVAL)

  return () => {
    clearInterval(timer)
    window.removeEventListener("pagehide", onPageHide)
    beat("closing")
    releaseLock?.()
    releaseLock = null
  }
}

export type OperatorPresenceStatus = "connected" | "waiting" | "lost"

/**
 * Display side. `waiting` means no console has been seen since this window
 * opened; `lost` means one was, and has gone. `lastSeenAt` is when it was last
 * heard from, for telling the band how old the words on screen are.
 */
export const useOperatorPresence = () => {
  const status = ref<OperatorPresenceStatus>("connected")
  const lastSeenAt = ref<number | null>(null)

  const openedAt = Date.now()
  let lastHeartbeatAt = 0
  let goneSince: number | null = null
  // Set once the lock has been seen held from here. From then on its absence
  // is the answer, without waiting out a heartbeat the dead page may have
  // sent seconds before it closed.
  let lockVisible = false

  const lockHeld = async () => {
    if (!locksAvailable()) return false
    try {
      const { held } = await navigator.locks.query()
      return !!held?.some((lock) => lock.name === OPERATOR_LOCK)
    } catch {
      return false
    }
  }

  let checking = false
  const check = async () => {
    if (checking) return
    checking = true
    try {
      const now = Date.now()
      const held = await lockHeld()
      if (held) lockVisible = true
      const alive =
        held || (!lockVisible && now - lastHeartbeatAt < HEARTBEAT_TIMEOUT)
      if (alive) {
        goneSince = null
        lastSeenAt.value = Math.max(lastSeenAt.value || 0, lastHeartbeatAt, now)
        status.value = "connected"
      } else if (lastSeenAt.value) {
        goneSince ??= now
        if (now - goneSince >= LOSS_GRACE) status.value = "lost"
      } else if (now - openedAt >= HEARTBEAT_TIMEOUT) {
        status.value = "waiting"
      }
      // Otherwise this window has only just opened: give the console a
      // heartbeat's grace before saying it is missing.
    } finally {
      checking = false
    }
  }

  const cleanupBroadcast = useBroadcastMessage((data) => {
    // Every live slide crosses this channel too; skip parsing the ones that
    // cannot be a heartbeat.
    if (typeof data === "string" && !data.includes('"operator-heartbeat"')) return
    try {
      const envelope = (typeof data === "string" ? JSON.parse(data) : data) as
        | { payload?: unknown }
        | undefined
      const payload = envelope?.payload
      if (!isOperatorHeartbeat(payload)) return

      if (payload.state === "closing") {
        lastHeartbeatAt = 0
      } else {
        lastHeartbeatAt = Date.now()
      }
      void check()
    } catch {
      // Not ours to parse; the page's own listener reports bad messages.
    }
  })

  const timer = setInterval(() => void check(), CHECK_INTERVAL)
  void check()

  onBeforeUnmount(() => {
    clearInterval(timer)
    cleanupBroadcast()
  })

  return { status: readonly(status), lastSeenAt: readonly(lastSeenAt) }
}
