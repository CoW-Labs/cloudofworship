/**
 * Shared, app-wide state for in-flight media downloads.
 *
 * `useSlideMediaCache` writes here while it fetches a slide's video/media into
 * IndexedDB (see `useDetailedFetch`), and components (e.g. EditLiveContent) read
 * it to show a download progress bar for the slide currently being edited.
 *
 * Keys mirror the id used to cache the bytes:
 *   • media slides → `slide.id`
 *   • background videos → `slide.backgroundVideoKey`
 *
 * A missing key means "not downloading". A value of `NaN` means the download is
 * in progress but its total size is unknown (no `content-length`), so the UI
 * should fall back to an indeterminate bar.
 */
const activeDownloads = reactive<Record<string, number>>({})

export default function useMediaDownloadProgress() {
  const beginDownload = (key: string) => {
    activeDownloads[key] = 0
  }

  const setProgress = (key: string, percent: number) => {
    activeDownloads[key] = percent
  }

  const endDownload = (key: string) => {
    delete activeDownloads[key]
  }

  // Current percent for a key, or `null` when nothing is downloading for it.
  const progressFor = (key?: string | null): number | null =>
    key != null && key in activeDownloads ? activeDownloads[key] : null

  const isDownloading = (key?: string | null): boolean =>
    key != null && key in activeDownloads

  return {
    activeDownloads,
    beginDownload,
    setProgress,
    endDownload,
    progressFor,
    isDownloading,
  }
}
