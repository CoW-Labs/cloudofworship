import { computed, reactive } from "vue"

/**
 * Shared, app-wide state for in-flight media downloads.
 *
 * `useSlideMediaCache` writes here while it streams media into the active local
 * backend, and components read it to show progress for the slide being edited.
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
const activeMigrations = reactive<Record<string, true>>({})
export type LocalMediaTransferStatus = "pending" | "ready" | "failed"
const localTransfers = reactive<
  Record<
    string,
    {
      status: LocalMediaTransferStatus
      progress: number
      error?: string
    }
  >
>({})

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
    key != null && key in activeDownloads ? activeDownloads[key] ?? null : null

  const isDownloading = (key?: string | null): boolean =>
    key != null && key in activeDownloads

  const beginMigration = (key: string) => {
    activeMigrations[key] = true
  }

  const endMigration = (key: string) => {
    delete activeMigrations[key]
  }

  const migrationCount = computed(
    () => Object.keys(activeMigrations).length
  )

  const beginLocalSave = (key: string) => {
    localTransfers[key] = { status: "pending", progress: 0 }
  }

  const setLocalSaveProgress = (key: string, fraction: number) => {
    localTransfers[key] = {
      status: "pending",
      progress: Number.isFinite(fraction) ? fraction : Number.NaN,
    }
  }

  const completeLocalSave = (key: string) => {
    localTransfers[key] = { status: "ready", progress: 1 }
  }

  const failLocalSave = (key: string, error: unknown) => {
    localTransfers[key] = {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const transferFor = (key?: string | null) =>
    key ? localTransfers[key] || null : null

  const isLocalMediaReady = (key?: string | null) =>
    !key ||
    !localTransfers[key] ||
    localTransfers[key]?.status === "ready"

  return {
    activeDownloads,
    beginDownload,
    setProgress,
    endDownload,
    progressFor,
    isDownloading,
    activeMigrations,
    beginMigration,
    endMigration,
    migrationCount,
    localTransfers,
    beginLocalSave,
    setLocalSaveProgress,
    completeLocalSave,
    failLocalSave,
    transferFor,
    isLocalMediaReady,
  }
}
