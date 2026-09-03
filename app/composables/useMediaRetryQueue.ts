/**
 * Retry scheduler for media that could not be pulled down yet.
 *
 * A slide's media is fetched exactly once per pass, so a service that starts on
 * a weak connection used to leave a presentation page (or any background) blank
 * until the operator reloaded the window: the download threw, nothing rescheduled
 * it, and a CSS `background-image` that failed never re-requests on its own.
 *
 * Tasks are keyed (one per slide), deduplicated, retried on a capped backoff and
 * flushed immediately when the browser reports the network is back. Attempts run
 * one at a time so a reconnect does not fire the whole schedule at the router at
 * once. A task drops off the queue as soon as its `run` resolves `true`.
 */

const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 30_000, 60_000]
const MAX_ATTEMPTS = 12

type RetryTask = {
  key: string
  attempts: number
  timer: ReturnType<typeof setTimeout> | null
  run: () => Promise<boolean>
}

const tasks = new Map<string, RetryTask>()
let queueTail: Promise<void> = Promise.resolve()
let onlineBound = false

const clearTask = (key: string) => {
  const task = tasks.get(key)
  if (task?.timer) clearTimeout(task.timer)
  tasks.delete(key)
}

const delayFor = (attempts: number) =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] as number

const schedule = (task: RetryTask, delay = delayFor(task.attempts)) => {
  if (task.timer) clearTimeout(task.timer)
  task.timer = setTimeout(() => {
    task.timer = null
    // Serialize attempts across every queued task.
    queueTail = queueTail.then(async () => {
      if (!tasks.has(task.key)) return
      task.attempts += 1
      let resolved = false
      try {
        resolved = await task.run()
      } catch (error) {
        console.warn(`Media retry for ${task.key} failed:`, error)
      }
      if (resolved || task.attempts >= MAX_ATTEMPTS) {
        clearTask(task.key)
        return
      }
      schedule(task)
    })
  }, delay)
}

/** A reconnect gets every waiting task a fresh series of attempts. */
const flushOnReconnect = () => {
  tasks.forEach((task) => {
    task.attempts = 0
    schedule(task, 1_000)
  })
}

const bindOnline = () => {
  if (onlineBound || typeof window === "undefined") return
  onlineBound = true
  window.addEventListener("online", flushOnReconnect)
}

export default function useMediaRetryQueue() {
  /**
   * Keep calling `run` until it reports the media resolved. Re-registering the
   * same key replaces the pending task rather than stacking a second one.
   */
  const retryMediaUntilResolved = (key: string, run: () => Promise<boolean>) => {
    bindOnline()
    const existing = tasks.get(key)
    const task: RetryTask = {
      key,
      attempts: existing?.attempts ?? 0,
      timer: null,
      run,
    }
    if (existing?.timer) clearTimeout(existing.timer)
    tasks.set(key, task)
    schedule(task)
  }

  const cancelMediaRetry = (key: string) => clearTask(key)

  const pendingMediaRetryCount = () => tasks.size

  return { retryMediaUntilResolved, cancelMediaRetry, pendingMediaRetryCount }
}
