import type {
  MediaCloudSyncReason,
  MediaCloudSyncRecord,
} from "~/types"

export const mediaCloudFailureReason = (
  error: unknown
): MediaCloudSyncReason =>
  /quota|storage limit|storage full/i.test(String(error))
    ? "quota"
    : "upload-error"

/**
 * How long to wait after the nth background re-upload in a row has failed.
 * A dropped connection usually recovers within minutes, so the early waits
 * are short; a page still failing after that is tried a few times a day
 * rather than on every reconnect. It is never abandoned: the bytes exist
 * only on the device that added them.
 */
export const CLOUD_RETRY_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
]

/**
 * How old a "pending" upload must be before another tab treats it as
 * stranded. Gives an upload still running in a second tab on this device
 * time to finish; a single page uploads well inside this.
 */
export const STRANDED_PENDING_AFTER_MS = 2 * 60_000

/**
 * A "pending" record written before this page loaded is an upload that a
 * closed or reloaded tab never finished. Nothing else would ever move it on:
 * only the tab that started an upload records how it ended.
 */
export const isStrandedPending = (
  record: Pick<MediaCloudSyncRecord, "status" | "updatedAt">,
  pageLoadedAt = performance.timeOrigin
) => record.status === "pending" && Date.parse(record.updatedAt) < pageLoadedAt

type CloudRetryTiming = Pick<
  MediaCloudSyncRecord,
  "status" | "updatedAt" | "retryAttempts" | "lastRetryAt"
>

/** When a stranded page may next be re-uploaded in the background. */
export const cloudRetryDueAt = (record: CloudRetryTiming) => {
  if (record.status === "pending") {
    return Date.parse(record.updatedAt) + STRANDED_PENDING_AFTER_MS
  }
  const attempts = record.retryAttempts ?? 0
  const lastTried = record.lastRetryAt ? Date.parse(record.lastRetryAt) : NaN
  if (!attempts || Number.isNaN(lastTried)) return 0
  const wait =
    CLOUD_RETRY_BACKOFF_MS[
      Math.min(attempts, CLOUD_RETRY_BACKOFF_MS.length) - 1
    ]!
  return lastTried + wait
}

/** Whether a stranded page's backoff has run out. */
export const isCloudRetryDue = (record: CloudRetryTiming, now = Date.now()) =>
  cloudRetryDueAt(record) <= now

/**
 * A reconnect is a fresh chance, so it skips the backoff for any page not
 * tried in the last minute. Flaky Wi-Fi can reconnect every few seconds, and
 * this keeps it from resending media on each one.
 */
export const RECONNECT_RETRY_AFTER_MS = 60_000

/** Whether a stranded page should be retried now that the connection is back. */
export const isCloudRetryDueOnReconnect = (
  record: CloudRetryTiming,
  now = Date.now()
) => {
  if (isCloudRetryDue(record, now)) return true
  // A pending upload's wait is for another tab to finish, not a backoff.
  if (record.status === "pending") return false
  const lastTried = record.lastRetryAt ? Date.parse(record.lastRetryAt) : NaN
  return Number.isNaN(lastTried) || now - lastTried >= RECONNECT_RETRY_AFTER_MS
}

export const unavailableMediaCopy = (
  record?: MediaCloudSyncRecord | null,
  label = "Media"
) => {
  if (record?.status === "pending") {
    return {
      title: `${label} is waiting to upload`,
      description:
        "Keep the device that added it open and online until the cloud upload finishes, then try again.",
    }
  }

  if (record?.reason === "offline") {
    return {
      title: `${label} was added offline`,
      description:
        "No cloud copy was created. Reconnect the device that added it and upload or replace the file before taking this slide live.",
    }
  }

  if (record?.reason === "quota") {
    return {
      title: "Cloud storage was full",
      description:
        "This file remained only on the device that added it. Free cloud storage there, then upload or replace the file.",
    }
  }

  if (record?.reason === "disabled") {
    return {
      title: "Cloud upload was turned off",
      description:
        "This file remained only on the device that added it. Enable cloud uploads and upload or replace the file.",
    }
  }

  if (record?.status === "failed") {
    return {
      title: `${label} upload failed`,
      description:
        "The cloud copy was not created. Retry from the device that added it, or replace the file.",
    }
  }

  if (record?.status === "uploaded") {
    return {
      title: `${label} could not be downloaded`,
      description:
        "A cloud copy exists, but this device could not open it. Check the connection and try again.",
    }
  }

  return {
    title: `${label} is unavailable`,
    description:
      "This device has no local copy and the slide has no recoverable cloud copy. Re-add the file before taking it live.",
  }
}
