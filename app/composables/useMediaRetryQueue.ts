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
const MAX_CONCURRENT_ATTEMPTS = 2
const ATTEMPT_TIMEOUT_MS = 30_000

type RetryTask = {
  key: string
  fingerprint: string
  attempts: number
  timer: ReturnType<typeof setTimeout> | null
  controller: AbortController | null
  queued: boolean
  running: boolean
  run: (signal: AbortSignal, heartbeat: () => void) => Promise<boolean>
}

const tasks = new Map<string, RetryTask>()
const readyQueue: RetryTask[] = []
let activeAttempts = 0
let onlineBound = false

const isCurrentTask = (task: RetryTask) => tasks.get(task.key) === task

const clearTask = (key: string, expected?: RetryTask) => {
  const task = tasks.get(key)
  if (!task || (expected && task !== expected)) return
  if (task?.timer) clearTimeout(task.timer)
  task.controller?.abort()
  tasks.delete(key)
}

const delayFor = (attempts: number) =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] as number

const runTask = async (task: RetryTask) => {
  if (!isCurrentTask(task)) return

  task.running = true
  task.attempts += 1
  const controller = new AbortController()
  task.controller = controller
  let timeout: ReturnType<typeof setTimeout> | null = null
  let resolved = false
  let timeoutResolved = false

  try {
    let resolveTimeout!: (resolved: boolean) => void
    const timedOut = new Promise<boolean>((resolve) => {
      resolveTimeout = resolve
    })
    const heartbeat = () => {
      if (timeoutResolved || controller.signal.aborted) return
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        timeoutResolved = true
        controller.abort()
        resolveTimeout(false)
      }, ATTEMPT_TIMEOUT_MS)
    }
    heartbeat()
    const attempt = Promise.resolve().then(() =>
      task.run(controller.signal, heartbeat)
    )
    resolved = await Promise.race([attempt, timedOut])
  } catch (error) {
    if ((error as { name?: string } | null)?.name !== "AbortError") {
      console.warn(`Media retry for ${task.key} failed:`, error)
    }
  } finally {
    if (timeout) clearTimeout(timeout)
    if (task.controller === controller) task.controller = null
    task.running = false
  }

  // The task may have been replaced while its attempt was in flight. A stale
  // completion must never clear or reschedule the replacement.
  if (!isCurrentTask(task)) return
  if (resolved || task.attempts >= MAX_ATTEMPTS) {
    clearTask(task.key, task)
    return
  }
  schedule(task)
}

const drainQueue = () => {
  while (activeAttempts < MAX_CONCURRENT_ATTEMPTS && readyQueue.length) {
    const task = readyQueue.shift() as RetryTask
    task.queued = false
    if (!isCurrentTask(task) || task.running) continue
    activeAttempts += 1
    void runTask(task).finally(() => {
      activeAttempts -= 1
      drainQueue()
    })
  }
}

const enqueue = (task: RetryTask) => {
  if (!isCurrentTask(task) || task.queued || task.running) return
  task.queued = true
  readyQueue.push(task)
  drainQueue()
}

const schedule = (task: RetryTask, delay = delayFor(task.attempts)) => {
  if (!isCurrentTask(task)) return
  if (task.timer) clearTimeout(task.timer)
  task.timer = setTimeout(() => {
    task.timer = null
    enqueue(task)
  }, delay)
}

/** A reconnect gets every waiting task a fresh series of attempts. */
const flushOnReconnect = () => {
  tasks.forEach((task) => {
    task.attempts = 0
    if (!task.running) schedule(task, 1_000)
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
  const retryMediaUntilResolved = (
    key: string,
    run: (signal: AbortSignal, heartbeat: () => void) => Promise<boolean>,
    fingerprint = key
  ) => {
    bindOnline()
    const existing = tasks.get(key)
    if (existing?.fingerprint === fingerprint) {
      // Refresh the callback without resetting the attempt budget or stacking
      // another timer. If an attempt is already running, it is resolving the
      // same media source and may safely finish.
      existing.run = run
      return
    }
    if (existing) clearTask(key, existing)
    const task: RetryTask = {
      key,
      fingerprint,
      attempts: 0,
      timer: null,
      controller: null,
      queued: false,
      running: false,
      run,
    }
    tasks.set(key, task)
    schedule(task)
  }

  const cancelMediaRetry = (key: string, fingerprint?: string) => {
    const task = tasks.get(key)
    if (!task || (fingerprint && task.fingerprint !== fingerprint)) return
    clearTask(key, task)
  }

  const pendingMediaRetryCount = () => tasks.size

  return { retryMediaUntilResolved, cancelMediaRetry, pendingMediaRetryCount }
}
