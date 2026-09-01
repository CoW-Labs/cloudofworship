import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Slide } from "~/types"

const mocks = vi.hoisted(() => ({
  records: [] as any[],
  apiFetch: vi.fn(),
  flushShadowWrites: vi.fn(async () => {}),
  markSlideSyncState: vi.fn(),
  socketOn: vi.fn(),
  capture: vi.fn(),
}))

vi.mock("posthog-js", () => ({
  default: { capture: mocks.capture },
}))

vi.mock("@vueuse/core", () => ({
  useOnline: () => ({ value: true }),
}))

vi.mock("~/store/auth", () => ({
  useAuthStore: () => ({ user: { churchId: "church-one" } }),
}))

vi.mock("~/store/app", () => ({
  useAppStore: () => ({ setLastSynced: vi.fn() }),
}))

vi.mock("~/composables/useSlideRepository", () => ({
  flushSlideShadowWrites: mocks.flushShadowWrites,
  useSlideRepository: () => ({
    getPendingSlides: async () => [...mocks.records],
    markSlideSyncState: mocks.markSlideSyncState,
  }),
}))

const queuedSlide = (): Slide =>
  ({
    _id: "server-slide",
    id: "local-slide",
    scheduleId: "schedule-one",
    churchId: "church-one",
    userId: "user-one",
    index: 0,
    name: "Slide",
    type: "text",
    layout: "full_text",
    contents: ["First revision"],
    backgroundType: "color",
  }) as Slide

describe("slide resync", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.records = []
    vi.stubGlobal("navigator", { onLine: true })
    vi.stubGlobal("watch", vi.fn())
    vi.stubGlobal("useAPIFetch", mocks.apiFetch)
    vi.stubGlobal("useNuxtApp", () => ({
      $socketio: { on: mocks.socketOn },
      runWithContext: (callback: () => Promise<void>) => callback(),
    }))
    mocks.markSlideSyncState.mockImplementation(
      async (
        scheduleId: string,
        slideId: string,
        syncState: "synced" | "pending",
        expectedRevision?: number
      ) => {
        const current = mocks.records.find(
          (record) =>
            record.scheduleId === scheduleId && record.id === slideId
        )
        if (!current) return
        if (
          expectedRevision !== undefined &&
          current.localRevision !== expectedRevision
        ) {
          return
        }
        current.syncState = syncState
        current.resyncRequestedAt = syncState === "pending" ? "queued" : null
        if (syncState === "synced") mocks.records = []
      }
    )
  })

  it("keeps retrying when a newer revision lands during a successful pass", async () => {
    const first = queuedSlide()
    mocks.records = [
      {
        scheduleId: first.scheduleId,
        id: first.id,
        serverId: first._id,
        localRevision: 1,
        syncState: "pending",
        resyncRequestedAt: "queued",
        slide: first,
      },
    ]
    mocks.apiFetch
      .mockImplementationOnce(async () => {
        mocks.records[0] = {
          ...mocks.records[0],
          localRevision: 2,
          slide: { ...first, contents: ["Second revision"] },
        }
        return { error: { value: null } }
      })
      .mockResolvedValue({ error: { value: null } })

    const { flushPendingSlides } = await import(
      "~/composables/useSlideResync"
    )
    await flushPendingSlides()

    expect(mocks.apiFetch).toHaveBeenCalledOnce()
    expect(mocks.records).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(30_000)

    expect(mocks.apiFetch).toHaveBeenCalledTimes(2)
    expect(mocks.records).toEqual([])
  })

  it("flushes the coalesced snapshot before marking a failed slide", async () => {
    const record = queuedSlide()
    mocks.records = [
      {
        scheduleId: record.scheduleId,
        id: record.id,
        serverId: record._id,
        localRevision: 1,
        syncState: "pending",
        slide: record,
      },
    ]

    const { markSlideUnsynced } = await import(
      "~/composables/useSlideResync"
    )
    await markSlideUnsynced(record)

    expect(mocks.flushShadowWrites).toHaveBeenCalledOnce()
    expect(mocks.markSlideSyncState).toHaveBeenCalledWith(
      "schedule-one",
      "local-slide",
      "pending"
    )
    expect(
      mocks.flushShadowWrites.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.markSlideSyncState.mock.invocationCallOrder[0])
  })
})
