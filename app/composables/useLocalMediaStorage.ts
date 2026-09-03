import type {
  LocalMediaBackend,
  LocalMediaCategory,
  LocalMediaFileRecord,
  LocalMediaKind,
  Media,
  MediaCloudSyncReason,
  MediaCloudSyncRecord,
  MediaCloudSyncStatus,
} from "~/types"
import useIndexedDB from "~/composables/useIndexedDB"
import useMediaDownloadProgress from "~/composables/useMediaDownloadProgress"
import { useTauri } from "~/composables/useTauri"
import { useAppStore } from "~/store/app"

const MEDIA_ROOT = "cow-media/v1"
const STORAGE_VERSION = 1 as const
const MIN_HEADROOM_BYTES = 100 * 1024 * 1024
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type CapacityEstimate = {
  backend: LocalMediaBackend
  usage: number
  quota: number
  available: number
  required: number
  enough: boolean
  persistent: boolean | null
}

export type SaveMediaInput = {
  key: string
  groupId?: string
  category: LocalMediaCategory
  kind?: LocalMediaKind
  blob: Blob
  mimeType?: string
  originalName?: string
  remoteUrl?: string
  recoverable?: boolean
  protectedGroupIds?: Iterable<string>
  onProgress?: (fraction: number) => void
  userInitiated?: boolean
}

export type DownloadMediaInput = Omit<SaveMediaInput, "blob"> & {
  url: string
  size?: number
  signal?: AbortSignal
}

export type EnsureLocalSource = {
  url?: string
  category?: LocalMediaCategory
  kind?: LocalMediaKind
  groupId?: string
  mimeType?: string
  originalName?: string
  recoverable?: boolean
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

type PhysicalFile = {
  relativePath: string
  size: number
}

export interface LocalMediaStorage {
  readonly backend: LocalMediaBackend
  isAvailable(): Promise<boolean>
  requestPersistence(): Promise<boolean | null>
  estimateCapacity(incomingBytes?: number): Promise<CapacityEstimate>
  saveBlob(input: SaveMediaInput): Promise<LocalMediaFileRecord>
  downloadToLocal(input: DownloadMediaInput): Promise<LocalMediaFileRecord>
  ensureLocal(
    key: string,
    source?: EnsureLocalSource
  ): Promise<string | null>
  getPlaybackUrl(key: string): Promise<string | null>
  releasePlaybackUrl(url?: string | null): void
  deleteFile(key: string): Promise<void>
  deleteGroup(groupId: string): Promise<void>
  clearAll(): Promise<void>
  evictRecoverable(
    requiredBytes: number,
    protectedGroupIds?: Iterable<string>
  ): Promise<number>
  migrateLegacyRecord(key: string): Promise<LocalMediaFileRecord | null>
  reconcileOrphans(): Promise<void>
  listRecords(): Promise<LocalMediaFileRecord[]>
  getCloudSyncState(key: string): Promise<MediaCloudSyncRecord | undefined>
  setCloudSyncState(
    key: string,
    input: {
      groupId?: string
      status: MediaCloudSyncStatus
      reason?: MediaCloudSyncReason
      remoteUrl?: string
      error?: unknown
    }
  ): Promise<MediaCloudSyncRecord>
}

export interface LocalMediaAdapter {
  readonly backend: LocalMediaBackend
  isAvailable(): Promise<boolean>
  write(
    relativePath: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<PhysicalFile>
  /** Resolves to null when the bytes are no longer on disk. */
  getPlaybackUrl(relativePath: string): Promise<string | null>
  delete(relativePath: string): Promise<void>
  clear(): Promise<void>
  listFiles(): Promise<string[]>
  capacity(): Promise<{
    usage: number
    quota: number
    available: number
    persistent: boolean | null
  }>
  requestPersistence(): Promise<boolean | null>
}

const activeOperations = new Map<string, Promise<LocalMediaFileRecord | null>>()
const playbackUrls = new Map<
  string,
  { relativePath: string; url: string; backend: LocalMediaBackend }
>()
let persistenceRequested = false
let largeTransferTail: Promise<void> = Promise.resolve()

const nowISO = () => new Date().toISOString()

const splitPath = (path: string) => path.split("/").filter(Boolean)

const parentPath = (path: string) => {
  const parts = splitPath(path)
  parts.pop()
  return parts.join("/")
}

const basename = (path: string) => splitPath(path).at(-1) || ""

const groupIdFromKey = (key: string) =>
  key.includes("-page-") ? key.split("-page-")[0] || key : key

const categoryFromKey = (key: string): LocalMediaCategory => {
  if (key.includes("-page-")) return "presentation-page"
  if (
    key.startsWith("/video-bg-") ||
    key.startsWith("/preset-image-bg-")
  )
    return "preset"
  if (key.includes("-bg-")) return "background"
  return "slide"
}

const kindFromMime = (
  mimeType = "",
  category?: LocalMediaCategory
): LocalMediaKind => {
  if (mimeType.startsWith("audio")) return "audio"
  if (mimeType.startsWith("video")) return "video"
  if (category === "presentation-page") return "image"
  return "image"
}

const isExternalVideo = (value: unknown) => {
  if (!value || typeof value !== "object") return false
  const type = (value as any).type
  return type === "youtube" || type === "vimeo"
}

const hashKey = async (value: string) => {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

const createRelativePath = async (
  category: LocalMediaCategory,
  key: string
) => {
  const hash = await hashKey(key)
  const random =
    crypto.randomUUID?.() ||
    `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  return `${MEDIA_ROOT}/${category}/${hash}/${Date.now()}-${random}`
}

const withProgress = (
  source: ReadableStream<Uint8Array>,
  total: number,
  onProgress?: (fraction: number) => void
) => {
  if (!onProgress) return source
  let loaded = 0
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength
        onProgress(total > 0 ? Math.min(1, loaded / total) : Number.NaN)
        controller.enqueue(chunk)
      },
      flush() {
        onProgress(1)
      },
    })
  )
}

const serializeLargeTransfer = async <T>(
  size: number,
  operation: () => Promise<T>
) => {
  if (size <= 100 * 1024 * 1024) return await operation()
  const previous = largeTransferTail
  let release = () => {}
  largeTransferTail = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

export class BrowserOPFSAdapter implements LocalMediaAdapter {
  readonly backend = "opfs" as const

  async root() {
    return await navigator.storage.getDirectory()
  }

  async isAvailable() {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.storage?.getDirectory !== "function"
    ) {
      return false
    }
    try {
      await this.root()
      return true
    } catch {
      return false
    }
  }

  private async directory(path: string, create = false) {
    let directory = await this.root()
    for (const part of splitPath(path)) {
      directory = await directory.getDirectoryHandle(part, { create })
    }
    return directory
  }

  async write(relativePath: string, stream: ReadableStream<Uint8Array>) {
    const directory = await this.directory(parentPath(relativePath), true)
    const handle = await directory.getFileHandle(basename(relativePath), {
      create: true,
    })
    const writable = await handle.createWritable()
    try {
      await stream.pipeTo(writable)
      const file = await handle.getFile()
      return { relativePath, size: file.size }
    } catch (error) {
      await writable.abort(error).catch(() => {})
      await directory.removeEntry(basename(relativePath)).catch(() => {})
      throw error
    }
  }

  async getPlaybackUrl(relativePath: string) {
    // The Dexie row can outlive the bytes — the browser evicts OPFS under
    // storage pressure, and an interrupted write leaves metadata behind. Both
    // surface as NotFoundError from getDirectoryHandle/getFileHandle/getFile.
    // Report "not on disk" the way this signature already allows instead of
    // throwing a raw DOMException at every caller (`delete`, `clear` and
    // `listFiles` below already swallow the same condition).
    try {
      const directory = await this.directory(parentPath(relativePath))
      const handle = await directory.getFileHandle(basename(relativePath))
      return URL.createObjectURL(await handle.getFile())
    } catch (error: any) {
      if (error?.name === "NotFoundError") return null
      throw error
    }
  }

  async delete(relativePath: string) {
    try {
      const directory = await this.directory(parentPath(relativePath))
      await directory.removeEntry(basename(relativePath))
    } catch (error: any) {
      if (error?.name !== "NotFoundError") throw error
    }
  }

  async clear() {
    const root = await this.root()
    await root.removeEntry("cow-media", { recursive: true }).catch((error) => {
      if (error?.name !== "NotFoundError") throw error
    })
  }

  async listFiles() {
    const files: string[] = []
    const walk = async (
      directory: FileSystemDirectoryHandle,
      prefix: string
    ) => {
      for await (const [name, handle] of (directory as any).entries()) {
        const path = `${prefix}/${name}`
        if (handle.kind === "directory") {
          await walk(handle, path)
        } else {
          files.push(path)
        }
      }
    }
    try {
      const root = await this.root()
      const cowMedia = await root.getDirectoryHandle("cow-media")
      await walk(cowMedia, "cow-media")
    } catch (error: any) {
      if (error?.name !== "NotFoundError") throw error
    }
    return files
  }

  async capacity() {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const persistent =
      typeof navigator.storage.persisted === "function"
        ? await navigator.storage.persisted()
        : null
    return {
      usage,
      quota,
      available: Math.max(0, quota - usage),
      persistent,
    }
  }

  async requestPersistence() {
    if (typeof navigator.storage.persist !== "function") return null
    return await navigator.storage.persist()
  }
}

export class TauriNativeMediaAdapter implements LocalMediaAdapter {
  readonly backend = "tauri-fs" as const

  private async fs() {
    return await import("@tauri-apps/plugin-fs")
  }

  async isAvailable() {
    try {
      const { exists, BaseDirectory } = await this.fs()
      await exists("cow-media", { baseDir: BaseDirectory.AppLocalData })
      return true
    } catch {
      return false
    }
  }

  async write(relativePath: string, stream: ReadableStream<Uint8Array>) {
    const { mkdir, writeFile, stat, BaseDirectory } = await this.fs()
    const directory = parentPath(relativePath)
    await mkdir(directory, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    })
    try {
      await writeFile(relativePath, stream, {
        baseDir: BaseDirectory.AppLocalData,
      })
      const info = await stat(relativePath, {
        baseDir: BaseDirectory.AppLocalData,
      })
      return { relativePath, size: info.size }
    } catch (error) {
      await this.delete(relativePath).catch(() => {})
      throw error
    }
  }

  async getPlaybackUrl(relativePath: string) {
    const [{ appLocalDataDir, join }, { convertFileSrc }] = await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/api/core"),
    ])
    const absolute = await join(await appLocalDataDir(), relativePath)
    return convertFileSrc(absolute)
  }

  async delete(relativePath: string) {
    const { remove, BaseDirectory } = await this.fs()
    await remove(relativePath, {
      baseDir: BaseDirectory.AppLocalData,
    }).catch((error: any) => {
      const message = String(error)
      if (!message.includes("not found") && !message.includes("No such file")) {
        throw error
      }
    })
  }

  async clear() {
    const { remove, BaseDirectory } = await this.fs()
    await remove("cow-media", {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    }).catch((error: any) => {
      const message = String(error)
      if (!message.includes("not found") && !message.includes("No such file")) {
        throw error
      }
    })
  }

  async listFiles() {
    const { readDir, BaseDirectory } = await this.fs()
    const files: string[] = []
    const walk = async (path: string) => {
      const entries = await readDir(path, {
        baseDir: BaseDirectory.AppLocalData,
      })
      for (const entry of entries) {
        const entryPath = `${path}/${entry.name}`
        if (entry.isDirectory) await walk(entryPath)
        else if (entry.isFile) files.push(entryPath)
      }
    }
    try {
      await walk(MEDIA_ROOT)
    } catch (error: any) {
      const message = String(error)
      if (!message.includes("not found") && !message.includes("No such file")) {
        throw error
      }
    }
    return files
  }

  async capacity() {
    const { invoke } = await import("@tauri-apps/api/core")
    const stats = await invoke<{
      freeBytes: number
      totalBytes: number
      mediaBytes: number
    }>("media_storage_stats")
    return {
      usage: stats.mediaBytes,
      quota: stats.totalBytes,
      available: stats.freeBytes,
      persistent: true,
    }
  }

  async requestPersistence() {
    return true
  }
}

const getAdapter = (): LocalMediaAdapter => {
  const { isTauri } = useTauri()
  return isTauri ? new TauriNativeMediaAdapter() : new BrowserOPFSAdapter()
}

export const createLocalMediaStorage = (
  adapter: LocalMediaAdapter
): LocalMediaStorage => {
  const getCloudSyncState = async (key: string) =>
    await useIndexedDB().mediaCloudSync.get(key)

  const setCloudSyncState: LocalMediaStorage["setCloudSyncState"] = async (
    key,
    input
  ) => {
    const db = useIndexedDB()
    const existing = await db.mediaCloudSync.get(key)
    const timestamp = nowISO()
    const record: MediaCloudSyncRecord = {
      key,
      groupId: input.groupId || existing?.groupId || groupIdFromKey(key),
      status: input.status,
      reason: input.reason,
      remoteUrl: input.remoteUrl || existing?.remoteUrl,
      error:
        input.error == null
          ? undefined
          : input.error instanceof Error
          ? input.error.message
          : String(input.error),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      uploadedAt:
        input.status === "uploaded"
          ? existing?.uploadedAt || timestamp
          : existing?.uploadedAt,
    }
    await db.mediaCloudSync.put(record)
    if (input.status === "uploaded" && record.remoteUrl) {
      await db.localMediaFiles.update(key, {
        remoteUrl: record.remoteUrl,
        recoverable: true,
        updatedAt: timestamp,
      })
    }
    return record
  }

  const requestPersistence = async () => {
    if (persistenceRequested) {
      return (await adapter.capacity()).persistent
    }
    persistenceRequested = true
    return await adapter.requestPersistence()
  }

  const estimateCapacity = async (
    incomingBytes = 0
  ): Promise<CapacityEstimate> => {
    const capacity = await adapter.capacity()
    const required =
      incomingBytes +
      Math.max(MIN_HEADROOM_BYTES, Math.ceil(incomingBytes * 0.1))
    return {
      backend: adapter.backend,
      ...capacity,
      required,
      enough: capacity.available >= required,
    }
  }

  const releasePlaybackUrl = (url?: string | null) => {
    if (!url) return
    if (url.startsWith("blob:")) URL.revokeObjectURL(url)
    for (const [key, cached] of playbackUrls.entries()) {
      if (cached.url === url) playbackUrls.delete(key)
    }
  }

  const invalidatePlaybackUrl = (key: string) => {
    const cached = playbackUrls.get(key)
    if (!cached) return
    releasePlaybackUrl(cached.url)
    playbackUrls.delete(key)
  }

  const deletePhysicalRecord = async (record: LocalMediaFileRecord) => {
    invalidatePlaybackUrl(record.key)
    const targetAdapter =
      record.backend === adapter.backend
        ? adapter
        : record.backend === "opfs"
        ? new BrowserOPFSAdapter()
        : new TauriNativeMediaAdapter()
    await targetAdapter.delete(record.relativePath)
  }

  const isReferencedBySlideOrLibrary = async (
    key: string,
    groupId: string
  ) => {
    const db = useIndexedDB()
    const activeSlides = (() => {
      try {
        return useAppStore().activeSlides
      } catch {
        return []
      }
    })()
    const librarySlides = (await db.library
      .where("type")
      .equals("slide")
      .toArray())
      .map((item) => item.content as any)
    return [...activeSlides, ...librarySlides].some(
      (slide: any) =>
        slide?.id === groupId ||
        slide?._id === groupId ||
        slide?.id === key ||
        slide?.backgroundVideoKey === key ||
        slide?.backgroundImageKey === key ||
        slide?.backgroundVideoKey === groupId ||
        slide?.backgroundImageKey === groupId
    )
  }

  const deleteFile = async (key: string) => {
    const db = useIndexedDB()
    const record = await db.localMediaFiles.get(key)
    if (
      record &&
      (await isReferencedBySlideOrLibrary(record.key, record.groupId))
    ) {
      throw new Error("This media is still used by an active or library slide.")
    }
    if (record) await deletePhysicalRecord(record)
    await db.localMediaFiles.delete(key)
    await db.mediaCloudSync.delete(key)
    await Promise.all([db.media.delete(key), db.cached.delete(key)])
  }

  const deleteGroup = async (groupId: string) => {
    const db = useIndexedDB()
    const records = await db.localMediaFiles
      .where("groupId")
      .equals(groupId)
      .toArray()
    for (const record of records) {
      if (await isReferencedBySlideOrLibrary(record.key, record.groupId)) {
        throw new Error(
          "This media is still used by an active or library slide."
        )
      }
    }
    for (const record of records) await deletePhysicalRecord(record)
    await db.localMediaFiles.where("groupId").equals(groupId).delete()
    await db.mediaCloudSync.where("groupId").equals(groupId).delete()
    const legacyKeys = new Set([groupId, ...records.map((record) => record.key)])
    await Promise.all([
      db.media.bulkDelete([...legacyKeys]),
      db.cached.bulkDelete([...legacyKeys]),
      db.media.where("id").startsWith(`${groupId}-page-`).delete(),
      db.cached.where("id").startsWith(`${groupId}-page-`).delete(),
    ])
  }

  const evictRecoverable = async (
    requiredBytes: number,
    protectedGroupIds: Iterable<string> = []
  ) => {
    const protectedIds = new Set(protectedGroupIds)
    const db = useIndexedDB()
    const candidates = (await db.localMediaFiles
      .orderBy("lastAccessedAt")
      .toArray())
      .filter(
        (record) =>
          record.recoverable &&
          record.backend === adapter.backend &&
          !protectedIds.has(record.groupId) &&
          !activeOperations.has(record.key)
      )
    let reclaimed = 0
    for (const record of candidates) {
      if (await isReferencedBySlideOrLibrary(record.key, record.groupId)) {
        continue
      }
      await deleteFile(record.key)
      reclaimed += record.size
      if (reclaimed >= requiredBytes) break
    }
    return reclaimed
  }

  const ensureCapacity = async (
    incomingBytes: number,
    protectedGroupIds: Iterable<string> = []
  ) => {
    const protectedIds = new Set(protectedGroupIds)
    try {
      const appStore = useAppStore()
      for (const slide of appStore.activeSlides) {
        protectedIds.add(slide.id)
        if (slide.backgroundVideoKey) {
          protectedIds.add(slide.backgroundVideoKey)
        }
        if (slide.backgroundImageKey) {
          protectedIds.add(slide.backgroundImageKey)
        }
      }
    } catch {
      // The service can also be used before Pinia is mounted.
    }
    let estimate = await estimateCapacity(incomingBytes)
    if (estimate.enough) return estimate
    await evictRecoverable(estimate.required - estimate.available, protectedIds)
    estimate = await estimateCapacity(incomingBytes)
    if (!estimate.enough) {
      throw new DOMException(
        "There is not enough local storage for this media file.",
        "QuotaExceededError"
      )
    }
    return estimate
  }

  const commitStream = async (
    input: Omit<SaveMediaInput, "blob"> & {
      size: number
      streamFactory: () =>
        | ReadableStream<Uint8Array>
        | Promise<ReadableStream<Uint8Array>>
    }
  ) => {
    if (!(await adapter.isAvailable())) {
      throw new Error(
        adapter.backend === "opfs"
          ? "This browser does not support durable local media storage."
          : "The desktop media folder is unavailable."
      )
    }

    await ensureCapacity(input.size, input.protectedGroupIds)
    let relativePath = ""
    let physical: PhysicalFile | null = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      relativePath = await createRelativePath(input.category, input.key)
      const stream = withProgress(
        await input.streamFactory(),
        input.size,
        input.onProgress
      )
      try {
        physical = await adapter.write(relativePath, stream)
        break
      } catch (error: any) {
        await adapter.delete(relativePath).catch(() => {})
        const outOfSpace =
          error?.name === "QuotaExceededError" ||
          /quota|disk full|no space|not enough space/i.test(String(error))
        if (!outOfSpace || attempt > 0) throw error
        const retryBytes =
          input.size +
          Math.max(MIN_HEADROOM_BYTES, Math.ceil(input.size * 0.1))
        await evictRecoverable(retryBytes, input.protectedGroupIds)
      }
    }
    if (!physical) {
      throw new DOMException(
        "There is not enough local storage for this media file.",
        "QuotaExceededError"
      )
    }
    if (input.size > 0 && physical.size !== input.size) {
      await adapter.delete(relativePath).catch(() => {})
      throw new Error(
        `Local media verification failed: expected ${input.size} bytes, wrote ${physical.size}.`
      )
    }

    const db = useIndexedDB()
    const previous = await db.localMediaFiles.get(input.key)
    const timestamp = nowISO()
    const record: LocalMediaFileRecord = {
      key: input.key,
      groupId: input.groupId || groupIdFromKey(input.key),
      backend: adapter.backend,
      category: input.category,
      kind: input.kind || kindFromMime(input.mimeType, input.category),
      relativePath,
      mimeType: input.mimeType || "application/octet-stream",
      size: physical.size,
      originalName: input.originalName,
      remoteUrl: input.remoteUrl,
      recoverable: input.recoverable ?? !!input.remoteUrl,
      lastAccessedAt: timestamp,
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp,
      storageVersion: STORAGE_VERSION,
    }

    try {
      await db.localMediaFiles.put(record)
    } catch (error) {
      await adapter.delete(relativePath).catch(() => {})
      throw error
    }

    invalidatePlaybackUrl(input.key)
    if (previous && previous.relativePath !== relativePath) {
      await deletePhysicalRecord(previous).catch((error) =>
        console.warn("Failed to remove replaced local media:", error)
      )
    }
    return record
  }

  const saveBlob = async (input: SaveMediaInput) => {
    const record = await serializeLargeTransfer(input.blob.size, () =>
      commitStream({
        ...input,
        size: input.blob.size,
        mimeType: input.mimeType || input.blob.type,
        streamFactory: () => input.blob.stream(),
      })
    )
    if (input.userInitiated && !persistenceRequested) {
      await requestPersistence().catch(() => null)
    }
    if (input.userInitiated) {
      const offline = globalThis.navigator?.onLine === false
      await setCloudSyncState(input.key, {
        groupId: input.groupId,
        status: offline ? "local-only" : "pending",
        reason: offline ? "offline" : undefined,
      })
    }
    return record
  }

  const downloadToLocal = async (input: DownloadMediaInput) => {
    let response: Response | null = await fetch(input.url, {
      signal: input.signal,
    })
    if (!response.ok || !response.body) {
      throw new Error(`Media download failed with status ${response.status}.`)
    }
    const headerSize = Number(response.headers.get("content-length") || 0)
    const size = input.size || headerSize
    const responseMimeType =
      response.headers.get("content-type") || "application/octet-stream"
    const suppliedMimeType =
      input.mimeType?.includes("/") && !input.mimeType.endsWith("/*")
        ? input.mimeType
        : undefined
    const streamFactory = async () => {
      const activeResponse =
        response ||
        (await fetch(input.url, {
          signal: input.signal,
        }))
      response = null
      if (!activeResponse.ok || !activeResponse.body) {
        throw new Error(
          `Media download failed with status ${activeResponse.status}.`
        )
      }
      return activeResponse.body as ReadableStream<Uint8Array>
    }
    const record = await serializeLargeTransfer(size, () =>
      commitStream({
        ...input,
        remoteUrl: input.url,
        recoverable: true,
        mimeType:
          suppliedMimeType ||
          responseMimeType,
        size,
        streamFactory,
      })
    )
    await setCloudSyncState(input.key, {
      groupId: input.groupId,
      status: "uploaded",
      remoteUrl: input.url,
    })
    // A device that only ever receives a teammate's media never reaches the
    // request in `saveBlob` — no user-initiated save ever happens on it — so
    // its bucket stayed evictable, and a projection machine that only
    // downloads is exactly where losing the bytes mid-service hurts most.
    // Persistence is per-origin and asked for once.
    if (!persistenceRequested) await requestPersistence().catch(() => null)
    return record
  }

  const getPlaybackUrl = async (key: string) => {
    const db = useIndexedDB()
    const record = await db.localMediaFiles.get(key)
    if (!record || record.backend !== adapter.backend) return null

    const cached = playbackUrls.get(key)
    if (
      cached &&
      cached.relativePath === record.relativePath &&
      cached.backend === record.backend
    ) {
      return cached.url
    }
    if (cached) releasePlaybackUrl(cached.url)

    const url = await adapter.getPlaybackUrl(record.relativePath)
    if (!url) {
      // Metadata without bytes. Drop the row so the caller falls back to the
      // cloud copy (or reports the media as unavailable on this device) instead
      // of retrying a path that will never resolve.
      await db.localMediaFiles.delete(key)
      return null
    }

    playbackUrls.set(key, {
      relativePath: record.relativePath,
      url,
      backend: adapter.backend,
    })
    await db.localMediaFiles.update(key, { lastAccessedAt: nowISO() })
    return url
  }

  const legacyPlaybackUrl = (legacy: Media | undefined) => {
    const value = legacy?.data as any
    if (value instanceof Blob) return URL.createObjectURL(value)
    if (value instanceof ArrayBuffer) {
      return URL.createObjectURL(
        new Blob([value], { type: legacy?.content?.type })
      )
    }
    if (typeof value === "string" && value.startsWith("http")) return value
    return null
  }

  const migrateLegacyRecord = async (
    key: string
  ): Promise<LocalMediaFileRecord | null> => {
    const existingOperation = activeOperations.get(key)
    if (existingOperation) return await existingOperation
    const { beginMigration, endMigration } = useMediaDownloadProgress()
    beginMigration(key)

    const operation = (async () => {
      const db = useIndexedDB()
      const current = await db.localMediaFiles.get(key)
      if (current?.backend === adapter.backend) return current

      const mediaRecord = await db.media.get(key)
      const cachedRecord = mediaRecord ? undefined : await db.cached.get(key)
      const legacy = mediaRecord || cachedRecord
      if (!legacy || isExternalVideo(legacy.data)) return null

      const category = categoryFromKey(key)
      const content =
        typeof legacy.content === "object" ? legacy.content : undefined
      const mimeType =
        content?.type ||
        ((legacy.data as Blob)?.type ?? "") ||
        (category === "presentation-page" ? "image/png" : "")
      const remoteUrl =
        legacy.remoteUrl ||
        (typeof legacy.data === "string" &&
        /^https?:\/\//.test(legacy.data)
          ? legacy.data
          : undefined)
      const raw = legacy.data as any
      let blob: Blob | null = null
      if (raw instanceof Blob) blob = raw
      else if (raw instanceof ArrayBuffer) {
        blob = new Blob([raw], { type: mimeType })
      }

      let record: LocalMediaFileRecord | null = null
      if (blob) {
        try {
          record = await saveBlob({
            key,
            groupId: groupIdFromKey(key),
            category,
            kind: kindFromMime(mimeType, category),
            blob,
            mimeType,
            remoteUrl,
            recoverable: !!remoteUrl || category === "preset",
          })
        } catch (error: any) {
          const outOfSpace =
            error?.name === "QuotaExceededError" ||
            /quota|disk|space/i.test(String(error))
          if (!outOfSpace) throw error

          if (remoteUrl && navigator.onLine) {
            if (mediaRecord) await db.media.delete(key)
            else await db.cached.delete(key)
            record = await downloadToLocal({
              key,
              groupId: groupIdFromKey(key),
              category,
              kind: kindFromMime(mimeType, category),
              url: remoteUrl,
              mimeType,
              recoverable: true,
            })
          } else {
            console.warn(
              `Legacy media ${key} could not be migrated until local space is freed.`
            )
            return null
          }
        }
      } else if (remoteUrl) {
        record = await downloadToLocal({
          key,
          groupId: groupIdFromKey(key),
          category,
          kind: kindFromMime(mimeType, category),
          url: remoteUrl,
          mimeType,
          recoverable: true,
        })
      }

      if (record) {
        if (mediaRecord) await db.media.delete(key)
        else await db.cached.delete(key)
      }
      return record
    })()

    activeOperations.set(key, operation)
    try {
      return await operation
    } finally {
      activeOperations.delete(key)
      endMigration(key)
    }
  }

  const ensureLocal = async (
    key: string,
    source: EnsureLocalSource = {}
  ) => {
    const db = useIndexedDB()
    let record: LocalMediaFileRecord | null | undefined =
      await db.localMediaFiles.get(key)
    if (record?.backend !== adapter.backend) {
      record = await migrateLegacyRecord(key)
    }
    if (record) {
      try {
        return await getPlaybackUrl(key)
      } catch (error) {
        console.warn(`Local media file for ${key} is missing:`, error)
        invalidatePlaybackUrl(key)
        await db.localMediaFiles.delete(key)
        source.url ||= record.remoteUrl
        record = null
      }
    }
    if (!record && source.url) {
      record = await downloadToLocal({
        key,
        groupId: source.groupId || groupIdFromKey(key),
        category: source.category || categoryFromKey(key),
        kind: source.kind,
        url: source.url,
        mimeType: source.mimeType,
        originalName: source.originalName,
        recoverable: source.recoverable ?? true,
        signal: source.signal,
        onProgress: source.onProgress,
      })
    }
    if (record) return await getPlaybackUrl(key)

    // A legacy read is permitted only as a migration bridge. New writes never
    // store binary data in IndexedDB.
    const legacy = (await db.media.get(key)) || (await db.cached.get(key))
    return legacyPlaybackUrl(legacy)
  }

  const clearAll = async () => {
    for (const cached of playbackUrls.values()) releasePlaybackUrl(cached.url)
    playbackUrls.clear()
    await adapter.clear()
    await useIndexedDB().localMediaFiles.clear()
    await useIndexedDB().mediaCloudSync.clear()
  }

  const reconcileOrphans = async () => {
    if (!(await adapter.isAvailable())) return
    const db = useIndexedDB()
    const records = await db.localMediaFiles
      .where("backend")
      .equals(adapter.backend)
      .toArray()
    const physicalFiles = await adapter.listFiles()
    const physicalSet = new Set(physicalFiles)
    for (const record of records) {
      if (!physicalSet.has(record.relativePath)) {
        invalidatePlaybackUrl(record.key)
        await db.localMediaFiles.delete(record.key)
      }
    }
    const referenced = new Set(records.map((record) => record.relativePath))
    const cutoff = Date.now() - ORPHAN_MAX_AGE_MS
    for (const path of physicalFiles) {
      if (referenced.has(path)) continue
      const timestamp = Number(basename(path).split("-")[0])
      if (Number.isFinite(timestamp) && timestamp < cutoff) {
        await adapter.delete(path).catch(() => {})
      }
    }
  }

  const listRecords = async () =>
    await useIndexedDB().localMediaFiles
      .where("backend")
      .equals(adapter.backend)
      .toArray()

  const isAvailable = () => adapter.isAvailable()

  return {
    backend: adapter.backend,
    isAvailable,
    requestPersistence,
    estimateCapacity,
    saveBlob,
    downloadToLocal,
    ensureLocal,
    getPlaybackUrl,
    releasePlaybackUrl,
    deleteFile,
    deleteGroup,
    clearAll,
    evictRecoverable,
    migrateLegacyRecord,
    reconcileOrphans,
    listRecords,
    getCloudSyncState,
    setCloudSyncState,
  }
}

export default function useLocalMediaStorage(): LocalMediaStorage {
  return createLocalMediaStorage(getAdapter())
}
