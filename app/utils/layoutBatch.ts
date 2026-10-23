/**
 * Runs DOM measurements from many components in one pass per frame, so the
 * page is laid out once for all of them rather than once each.
 *
 * Reading a size straight after a style change forces the browser to lay out
 * the whole page there and then. A component that does that on its own is
 * cheap; forty slide previews doing it one after another, each undoing what
 * the last one measured, is forty full layouts in a row. Here every job's
 * phase runs for all jobs before the next phase starts, so the reads share
 * one layout and the writes share the next.
 *
 * Phases, in order: `read` (reads only), `write` (writes only), `measure`
 * (reads only) and `finish` (writes, typically undoing `write`).
 */
export interface LayoutJob {
  read?: () => void
  write?: () => void
  measure?: () => void
  finish?: () => void
}

const pending = new Set<LayoutJob>()
let frame = 0

const runPhase = (jobs: LayoutJob[], phase: keyof LayoutJob) => {
  for (const job of jobs) {
    try {
      job[phase]?.()
    } catch (error) {
      console.warn(`Layout job failed in its ${phase} phase:`, error)
    }
  }
}

const flush = () => {
  frame = 0
  const jobs = [...pending]
  pending.clear()
  runPhase(jobs, "read")
  runPhase(jobs, "write")
  runPhase(jobs, "measure")
  runPhase(jobs, "finish")
}

/**
 * Queue a job for the next frame. Queuing the same job again before then is
 * a no-op, so callers can schedule on every change without counting.
 */
export const scheduleLayoutJob = (job: LayoutJob) => {
  pending.add(job)
  if (frame) return
  frame =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(flush)
      : (setTimeout(flush, 16) as unknown as number)
}

/** Drop a queued job, e.g. when its component unmounts. */
export const cancelLayoutJob = (job: LayoutJob) => {
  pending.delete(job)
}
