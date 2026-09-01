import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import useIndexedDB from "~/composables/useIndexedDB"
import {
  createLocalMediaStorage,
  type LocalMediaAdapter,
} from "~/composables/useLocalMediaStorage"
import type { LocalMediaBackend } from "~/types"
import { toTransportSafeSlide } from "~/utils/mediaTransport"

vi.mock("~/store/app", () => ({
  useAppStore: () => {
    throw new Error("Pinia is not mounted in adapter contract tests.")
  },
}))

class MemoryMediaAdapter implements LocalMediaAdapter {
  files = new Map<string, Uint8Array>()
  writeCount = 0
  quota = 4 * 1024 * 1024 * 1024
  sizeOffset = 0
  writeDelay = 0
  failNextWriteWithQuota = false
  persistent: boolean | null = true

  constructor(readonly backend: LocalMediaBackend) {}

  async isAvailable() {
    return true
  }

  async write(relativePath: string, stream: ReadableStream<Uint8Array>) {
    this.writeCount += 1
    if (this.failNextWriteWithQuota) {
      this.failNextWriteWithQuota = false
      throw new DOMException("No space left on device", "QuotaExceededError")
    }
    if (this.writeDelay) {
      await new Promise((resolve) => setTimeout(resolve, this.writeDelay))
    }
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.byteLength
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    this.files.set(relativePath, bytes)
    return { relativePath, size: size + this.sizeOffset }
  }

  async getPlaybackUrl(relativePath: string) {
    if (!this.files.has(relativePath)) throw new Error("missing file")
    return `memory://${this.backend}/${relativePath}`
  }

  async delete(relativePath: string) {
    this.files.delete(relativePath)
  }

  async clear() {
    this.files.clear()
  }

  async listFiles() {
    return [...this.files.keys()]
  }

  async capacity() {
    const usage = [...this.files.values()].reduce(
      (total, value) => total + value.byteLength,
      0
    )
    return {
      usage,
      quota: this.quota,
      available: Math.max(0, this.quota - usage),
      persistent: this.persistent,
    }
  }

  async requestPersistence() {
    return this.persistent
  }
}

class CountingMediaAdapter extends MemoryMediaAdapter {
  lastWriteSize = 0

  override async write(
    relativePath: string,
    stream: ReadableStream<Uint8Array>
  ) {
    this.writeCount += 1
    const reader = stream.getReader()
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
    }
    this.lastWriteSize = size
    this.files.set(relativePath, new Uint8Array())
    return { relativePath, size }
  }
}

const syntheticBlob = (size: number, chunkSize = 1024 * 1024) =>
  ({
    size,
    type: "video/mp4",
    stream() {
      let emitted = 0
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (emitted >= size) {
            controller.close()
            return
          }
          const length = Math.min(chunkSize, size - emitted)
          emitted += length
          controller.enqueue(new Uint8Array(length))
        },
      })
    },
  } as Blob)

const resetDatabase = async () => {
  const db = useIndexedDB()
  await Promise.all(db.tables.map((table) => table.clear()))
}

afterEach(() => vi.unstubAllGlobals())

describe.each(["opfs", "tauri-fs"] as const)(
  "%s LocalMediaStorage adapter contract",
  (backend) => {
    let adapter: MemoryMediaAdapter

    beforeEach(async () => {
      await resetDatabase()
      adapter = new MemoryMediaAdapter(backend)
    })

    it("streams a write, verifies it, and records metadata only in localMediaFiles", async () => {
      const storage = createLocalMediaStorage(adapter)
      const progress: number[] = []
      const record = await storage.saveBlob({
        key: "slide-1",
        groupId: "slide-1",
        category: "slide",
        kind: "video",
        blob: new Blob(["streamed-video"], { type: "video/mp4" }),
        recoverable: false,
        onProgress: (value) => progress.push(value),
      })

      expect(record.backend).toBe(backend)
      expect(record.relativePath).toMatch(
        /^cow-media\/v1\/slide\/[a-f0-9]{64}\/\d+-/
      )
      expect(adapter.files.get(record.relativePath)).toHaveLength(14)
      expect(progress.at(-1)).toBe(1)
      expect(await useIndexedDB().media.count()).toBe(0)
      expect(await useIndexedDB().localMediaFiles.get("slide-1")).toEqual(
        record
      )
    })

    it("keeps cloud sync history after the physical-file record is lost", async () => {
      const storage = createLocalMediaStorage(adapter)
      await storage.setCloudSyncState("offline-image", {
        groupId: "offline-image",
        status: "local-only",
        reason: "offline",
      })

      await useIndexedDB().localMediaFiles.delete("offline-image")

      expect(await storage.getCloudSyncState("offline-image")).toMatchObject({
        status: "local-only",
        reason: "offline",
      })
    })

    it("records user-created media as pending online and local-only offline", async () => {
      const storage = createLocalMediaStorage(adapter)
      vi.stubGlobal("navigator", { onLine: true })

      await storage.saveBlob({
        key: "online-image",
        groupId: "online-image",
        category: "slide",
        kind: "image",
        blob: new Blob(["online"]),
        userInitiated: true,
      })
      expect(await storage.getCloudSyncState("online-image")).toMatchObject({
        status: "pending",
      })

      vi.stubGlobal("navigator", { onLine: false })
      await storage.saveBlob({
        key: "offline-image",
        groupId: "offline-image",
        category: "slide",
        kind: "image",
        blob: new Blob(["offline"]),
        userInitiated: true,
      })
      expect(await storage.getCloudSyncState("offline-image")).toMatchObject({
        status: "local-only",
        reason: "offline",
      })

    })

    it("marks uploaded media recoverable and clears the previous failure", async () => {
      const storage = createLocalMediaStorage(adapter)
      await storage.saveBlob({
        key: "retry-image",
        groupId: "retry-image",
        category: "slide",
        kind: "image",
        blob: new Blob(["retry"]),
      })
      await storage.setCloudSyncState("retry-image", {
        status: "failed",
        reason: "upload-error",
        error: new Error("Network request failed"),
      })

      const uploaded = await storage.setCloudSyncState("retry-image", {
        status: "uploaded",
        remoteUrl: "https://cdn.example.com/retry.png",
      })

      expect(uploaded).toMatchObject({
        status: "uploaded",
        remoteUrl: "https://cdn.example.com/retry.png",
      })
      expect(uploaded.reason).toBeUndefined()
      expect(uploaded.error).toBeUndefined()
      expect(
        await useIndexedDB().localMediaFiles.get("retry-image")
      ).toMatchObject({
        remoteUrl: "https://cdn.example.com/retry.png",
        recoverable: true,
      })
    })

    it("removes cloud sync history when its media group is deleted", async () => {
      const storage = createLocalMediaStorage(adapter)
      await storage.saveBlob({
        key: "presentation-1-page-1",
        groupId: "presentation-1",
        category: "presentation-page",
        kind: "image",
        blob: new Blob(["page"]),
      })
      await storage.setCloudSyncState("presentation-1-page-1", {
        groupId: "presentation-1",
        status: "uploaded",
        remoteUrl: "https://cdn.example.com/page-1.png",
      })

      await storage.deleteGroup("presentation-1")

      expect(
        await storage.getCloudSyncState("presentation-1-page-1")
      ).toBeUndefined()
    })

    it("atomically replaces a file and removes the previous path after commit", async () => {
      const storage = createLocalMediaStorage(adapter)
      const first = await storage.saveBlob({
        key: "replace-me",
        category: "slide",
        kind: "image",
        blob: new Blob(["old"]),
      })
      const second = await storage.saveBlob({
        key: "replace-me",
        category: "slide",
        kind: "image",
        blob: new Blob(["new-version"]),
      })

      expect(second.relativePath).not.toBe(first.relativePath)
      expect(adapter.files.has(first.relativePath)).toBe(false)
      expect(adapter.files.has(second.relativePath)).toBe(true)
    })

    it("retains the previous metadata when verification of a replacement fails", async () => {
      const storage = createLocalMediaStorage(adapter)
      const first = await storage.saveBlob({
        key: "verify-me",
        category: "slide",
        kind: "audio",
        blob: new Blob(["valid"]),
      })
      adapter.sizeOffset = -1

      await expect(
        storage.saveBlob({
          key: "verify-me",
          category: "slide",
          kind: "audio",
          blob: new Blob(["incomplete"]),
        })
      ).rejects.toThrow("verification failed")

      expect(await useIndexedDB().localMediaFiles.get("verify-me")).toEqual(
        first
      )
      expect(adapter.files.has(first.relativePath)).toBe(true)
    })

    it("deletes every presentation page in a group", async () => {
      const storage = createLocalMediaStorage(adapter)
      for (const page of [1, 2, 3]) {
        await storage.saveBlob({
          key: `deck-page-${page}`,
          groupId: "deck",
          category: "presentation-page",
          kind: "image",
          blob: new Blob([String(page)]),
        })
      }

      await storage.deleteGroup("deck")
      expect(await useIndexedDB().localMediaFiles.count()).toBe(0)
      expect(adapter.files.size).toBe(0)
    })
  }
)

describe("legacy migration, capacity, and cleanup", () => {
  let adapter: MemoryMediaAdapter

  beforeEach(async () => {
    await resetDatabase()
    adapter = new MemoryMediaAdapter("opfs")
    vi.restoreAllMocks()
  })

  it.each([
    new Blob(["blob-shape"], { type: "image/png" }),
    new File(["file-shape"], "legacy.png", { type: "image/png" }),
    new Uint8Array([1, 2, 3, 4]).buffer,
  ])("migrates legacy binary shape %# and removes the old bytes", async (data) => {
    await useIndexedDB().media.put({
      id: "legacy",
      content: { type: "image/png" },
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const record =
      await createLocalMediaStorage(adapter).migrateLegacyRecord("legacy")
    expect(record?.size).toBeGreaterThan(0)
    expect(await useIndexedDB().media.get("legacy")).toBeUndefined()
  })

  it("coalesces simultaneous migrations for the same logical key", async () => {
    adapter.writeDelay = 10
    await useIndexedDB().media.put({
      id: "concurrent",
      content: { type: "video/mp4" },
      data: new Blob(["one-write"], { type: "video/mp4" }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const storage = createLocalMediaStorage(adapter)

    const [first, second] = await Promise.all([
      storage.migrateLegacyRecord("concurrent"),
      storage.migrateLegacyRecord("concurrent"),
    ])
    expect(first).toEqual(second)
    expect(adapter.writeCount).toBe(1)
  })

  it("downloads a legacy URL on demand without storing the URL as binary", async () => {
    await useIndexedDB().cached.put({
      id: "remote",
      content: { type: "audio/mpeg" },
      data: "https://cdn.example/media.mp3",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("remote-bytes", {
          headers: {
            "content-type": "audio/mpeg",
            "content-length": "12",
          },
        })
      )
    )

    const url = await createLocalMediaStorage(adapter).ensureLocal("remote")
    expect(url).toContain("memory://opfs/")
    expect((await useIndexedDB().localMediaFiles.get("remote"))?.remoteUrl).toBe(
      "https://cdn.example/media.mp3"
    )
    expect(await useIndexedDB().cached.get("remote")).toBeUndefined()
  })

  it("evicts only unprotected recoverable LRU files when capacity is low", async () => {
    const storage = createLocalMediaStorage(adapter)
    const twoMb = new Blob([new Uint8Array(2 * 1024 * 1024)])
    await storage.saveBlob({
      key: "old-recoverable",
      groupId: "old-group",
      category: "slide",
      kind: "video",
      blob: twoMb,
      recoverable: true,
      remoteUrl: "https://cdn.example/old",
    })
    await storage.saveBlob({
      key: "protected-recoverable",
      groupId: "protected-group",
      category: "slide",
      kind: "video",
      blob: twoMb,
      recoverable: true,
      remoteUrl: "https://cdn.example/protected",
    })
    adapter.quota = adapter.files.size * 0 + 103 * 1024 * 1024

    await storage.saveBlob({
      key: "incoming",
      groupId: "incoming",
      category: "slide",
      kind: "image",
      blob: new Blob(["x"]),
      protectedGroupIds: ["protected-group"],
    })

    expect(
      await useIndexedDB().localMediaFiles.get("old-recoverable")
    ).toBeUndefined()
    expect(
      await useIndexedDB().localMediaFiles.get("protected-recoverable")
    ).toBeDefined()
  })

  it("evicts recoverable media and retries once after a disk-full write", async () => {
    const storage = createLocalMediaStorage(adapter)
    await storage.saveBlob({
      key: "retry-cache",
      groupId: "retry-cache",
      category: "slide",
      kind: "video",
      blob: new Blob(["recoverable"]),
      recoverable: true,
      remoteUrl: "https://cdn.example/retry-cache",
    })
    adapter.failNextWriteWithQuota = true

    await storage.saveBlob({
      key: "retry-target",
      groupId: "retry-target",
      category: "slide",
      kind: "video",
      blob: new Blob(["target"]),
    })

    expect(adapter.writeCount).toBe(3)
    expect(
      await useIndexedDB().localMediaFiles.get("retry-cache")
    ).toBeUndefined()
    expect(
      await useIndexedDB().localMediaFiles.get("retry-target")
    ).toBeDefined()
  })

  it("removes unreferenced physical files older than 24 hours", async () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000
    const path = `cow-media/v1/slide/hash/${oldTimestamp}-orphan`
    adapter.files.set(path, new Uint8Array([1]))

    await createLocalMediaStorage(adapter).reconcileOrphans()
    expect(adapter.files.has(path)).toBe(false)
  })

  it("does not delete bytes while a library slide still references the key", async () => {
    const storage = createLocalMediaStorage(adapter)
    await storage.saveBlob({
      key: "library-media",
      groupId: "library-media",
      category: "slide",
      kind: "image",
      blob: new Blob(["library"]),
    })
    await useIndexedDB().library.put({
      id: "library-media",
      type: "slide",
      content: { id: "library-media" } as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    await expect(storage.deleteGroup("library-media")).rejects.toThrow(
      "still used"
    )
    expect(
      await useIndexedDB().localMediaFiles.get("library-media")
    ).toBeDefined()

    await useIndexedDB().library.delete("library-media")
    await storage.deleteGroup("library-media")
    expect(
      await useIndexedDB().localMediaFiles.get("library-media")
    ).toBeUndefined()
  })

  it("clearAll removes both metadata and the managed physical root", async () => {
    const storage = createLocalMediaStorage(adapter)
    await storage.saveBlob({
      key: "clear-me",
      category: "slide",
      kind: "image",
      blob: new Blob(["clear"]),
    })

    await storage.clearAll()
    expect(adapter.files.size).toBe(0)
    expect(await useIndexedDB().localMediaFiles.count()).toBe(0)
  })

  it("replaces document-scoped URLs with cloud recovery URLs for transport", async () => {
    const storage = createLocalMediaStorage(adapter)
    await storage.saveBlob({
      key: "transport-slide",
      groupId: "transport-slide",
      category: "slide",
      kind: "video",
      blob: new Blob(["video"]),
      remoteUrl: "https://cdn.example/video.mp4",
      recoverable: true,
    })
    await storage.setCloudSyncState("transport-slide", {
      groupId: "transport-slide",
      status: "uploaded",
      remoteUrl: "https://cdn.example/video.mp4",
    })

    const safe = await toTransportSafeSlide({
      id: "transport-slide",
      index: 0,
      name: "Video",
      type: "media",
      layout: "empty",
      userId: "user",
      churchId: "church",
      scheduleId: "schedule",
      contents: [],
      backgroundType: "video",
      background: "blob:operator-only",
      data: {
        name: "video.mp4",
        type: "video",
        url: "blob:operator-only",
        blob: new Blob(["video"]),
      } as any,
    })

    expect(safe.background).toBe("https://cdn.example/video.mp4")
    expect((safe.data as any).url).toBe("https://cdn.example/video.mp4")
    expect((safe.data as any).blob).toBeUndefined()
    expect(safe.mediaCloudSync?.["transport-slide"]).toMatchObject({
      status: "uploaded",
      remoteUrl: "https://cdn.example/video.mp4",
    })
  })

  it("transports cloud recovery history after local metadata is lost", async () => {
    const storage = createLocalMediaStorage(adapter)
    await storage.setCloudSyncState("remote-only-slide", {
      groupId: "remote-only-slide",
      status: "uploaded",
      remoteUrl: "https://cdn.example.com/remote-only.mp4",
    })

    const safe = await toTransportSafeSlide({
      id: "remote-only-slide",
      index: 0,
      name: "Remote-only video",
      type: "media",
      layout: "empty",
      userId: "user",
      churchId: "church",
      scheduleId: "schedule",
      contents: [],
      backgroundType: "video",
      background: "blob:missing-local-metadata",
      data: {
        name: "remote-only.mp4",
        type: "video",
        url: "blob:missing-local-metadata",
      } as any,
    })

    expect(safe.background).toBe("")
    expect((safe.data as any).url).toBe("")
    expect(safe.mediaCloudSync?.["remote-only-slide"]).toMatchObject({
      status: "uploaded",
      remoteUrl: "https://cdn.example.com/remote-only.mp4",
    })
  })
})

describe("large streamed media release gates", () => {
  beforeEach(resetDatabase)

  it("streams the normal 64 MB CI fixture without an ArrayBuffer conversion", async () => {
    const adapter = new CountingMediaAdapter("opfs")
    const storage = createLocalMediaStorage(adapter)
    const size = 64 * 1024 * 1024
    await storage.saveBlob({
      key: "ci-64mb",
      category: "slide",
      kind: "video",
      blob: syntheticBlob(size),
    })
    expect(adapter.lastWriteSize).toBe(size)
  })

  const oneGbTest =
    process.env.COW_MEDIA_1GB_TEST === "1" ? it : it.skip
  oneGbTest(
    "streams a synthetic 1 GB file through both release backends",
    async () => {
      const size = 1024 * 1024 * 1024
      for (const backend of ["opfs", "tauri-fs"] as const) {
        const adapter = new CountingMediaAdapter(backend)
        const storage = createLocalMediaStorage(adapter)
        await storage.saveBlob({
          key: `release-1gb-${backend}`,
          category: "slide",
          kind: "video",
          blob: syntheticBlob(size),
        })
        expect(adapter.lastWriteSize).toBe(size)
      }
    },
    120_000
  )
})
