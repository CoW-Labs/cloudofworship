export const getAPIErrorStatus = (error: unknown): number | undefined => {
  const err = error as any
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

export const getAPIErrorMessage = (error: unknown, fallback: string) => {
  const err = error as any
  return err?.data?.message ?? err?.message ?? fallback
}

export const isForbiddenError = (error: unknown) => getAPIErrorStatus(error) === 403

export const isNotFoundError = (error: unknown) => getAPIErrorStatus(error) === 404

/**
 * True when the request never reached the server — flaky wifi, a backgrounded
 * tab, DNS, a dropped connection. ofetch surfaces these with no status code and
 * a `<no response>` message, unlike an API error which always carries one.
 *
 * These are expected on a mobile hotspot in a church hall and are not worth
 * throwing over: the caller usually just skips its "synced" bookkeeping and
 * lets the next edit (or realtime reconciliation) catch up.
 */
export const isNetworkError = (error: unknown) => {
  if (getAPIErrorStatus(error) !== undefined) return false
  const message = String((error as any)?.message || "")
  return (
    message.includes("<no response>") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed") || // Safari's wording
    message.includes("network error") ||
    message.includes("No internet connection")
  )
}
