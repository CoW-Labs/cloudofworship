/**
 * useDisplayHotplug
 *
 * Tells the desktop app when a display is plugged in while it is running.
 *
 * Tauri has no monitor-change event (tao only surfaces per-window moves and
 * scale changes), and Windows 10 in particular never tells a running app that
 * a projector arrived. The only reliable signal is to ask again, so this polls
 * `availableMonitors()` and reports displays that were not there last time.
 * The poll is a single cheap OS call; it does not touch the webview.
 *
 * Only additions are reported. A display disappearing is handled where it
 * matters: the live window falls back when it next opens.
 */
const POLL_INTERVAL_MS = 3000
// Windows reports a new monitor before its final position and size settle, and
// opening a window against the half-configured layout lands it in the wrong
// place. Wait, then read the layout again.
const SETTLE_DELAY_MS = 1500

type Monitor = { name?: string | null; position: { x: number; y: number }; size: { width: number; height: number } }

// Name is stable across resolution changes; position is the fallback for
// drivers that report no name.
const monitorKey = (monitor: Monitor) =>
  monitor.name || `${monitor.position.x},${monitor.position.y}`

export const useDisplayHotplug = (
  onDisplayAdded: (added: Monitor[], all: Monitor[]) => void | Promise<void>
) => {
  const { isTauri } = useTauri()
  let timer: ReturnType<typeof setInterval> | null = null
  let known = new Set<string>()
  let busy = false

  const readMonitors = async (): Promise<Monitor[] | null> => {
    try {
      const { availableMonitors } = await import("@tauri-apps/api/window")
      return ((await availableMonitors()) as Monitor[]) ?? null
    } catch (error) {
      console.warn("Display hotplug: could not read monitors:", error)
      return null
    }
  }

  const check = async () => {
    if (busy) return
    busy = true
    try {
      const monitors = await readMonitors()
      if (!monitors) return

      const previous = known
      const added = monitors.filter((m) => !previous.has(monitorKey(m)))

      // Always track the current set so an unplug followed by a replug is seen
      // as a new arrival.
      known = new Set(monitors.map(monitorKey))

      if (!added.length) return

      await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS))
      const settled = (await readMonitors()) ?? monitors
      known = new Set(settled.map(monitorKey))
      await onDisplayAdded(
        settled.filter((m) => !previous.has(monitorKey(m))),
        settled
      )
    } finally {
      busy = false
    }
  }

  const start = async () => {
    if (!isTauri || timer) return
    // The monitors present at launch are the baseline, not new arrivals.
    const monitors = await readMonitors()
    known = new Set((monitors ?? []).map(monitorKey))
    timer = setInterval(check, POLL_INTERVAL_MS)
  }

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { start, stop }
}

export default useDisplayHotplug
