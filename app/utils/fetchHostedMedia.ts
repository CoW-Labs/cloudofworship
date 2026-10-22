/**
 * `fetch` for hosted media that survives a poisoned HTTP cache.
 *
 * The media CDN answers with `Vary: Origin` and no `Cache-Control`. An `<img>`
 * or CSS background loads the file without an `Origin` header, so the CDN
 * replies without `Access-Control-Allow-Origin` and the browser keeps that
 * copy. A later CORS `fetch` of the same URL is served from it and fails with
 * a bare `TypeError: Failed to fetch`, even though the CDN would allow it.
 * Retrying with `cache: "reload"` goes to the network and replaces the entry.
 */
export const fetchHostedMediaCors = async (
  url: string,
  init: RequestInit = {}
): Promise<Response> => {
  try {
    return await fetch(url, init)
  } catch (error) {
    // Aborts and non-network failures are not cache problems; surface them.
    if (init.signal?.aborted || !(error instanceof TypeError)) throw error
    return await fetch(url, { ...init, cache: "reload" })
  }
}
