export class MediaDownloadHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Media download failed with status ${status}.`)
    this.name = "MediaDownloadHttpError"
    this.status = status
  }
}

/** Only failures that can plausibly recover without changing the URL. */
export const isRetryableMediaDownloadError = (error: unknown): boolean => {
  if (error instanceof MediaDownloadHttpError) {
    return (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    )
  }

  const name = (error as { name?: string } | null)?.name
  if (name === "QuotaExceededError") return false
  if (
    name === "AbortError" ||
    name === "NetworkError" ||
    name === "TimeoutError"
  ) {
    return true
  }

  // Browser fetch reports DNS, connection, and CORS transport failures as a
  // TypeError. CORS can be permanent, but the browser exposes no finer signal.
  return error instanceof TypeError
}
