import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Slide } from "~/types"

const mocks = vi.hoisted(() => ({
  records: [] as any[],
  apiFetch: vi.fn(),
  flushShadowWrites: vi.fn(async () => {}),
  markSlideSyncState: vi.fn(),
  replacePendingSlide: vi.fn(),
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
  useAppStore: () => ({ setLastSynced: vi.fn(), activeSlidesById: new Map() }),
}))

vi.mock("~/composables/useSlideRepository", () => ({
  flushSlideShadowWrites: mocks.flushShadowWrites,
  useSlideRepository: () => ({
    getPendingSlides: async () => [...mocks.records],
    getStoredSlide: async (scheduleId: string, id: string) =>
      mocks.records.find(
        (record) => record.scheduleId === scheduleId && record.id === id
      ),
    markSlideSyncState: mocks.markSlideSyncState,
    replacePendingSlide: mocks.replacePendingSlide,
  }),
}))

const queuedSlide = (overrides: Partial<Slide> = {}): Slide =>
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
    ...overrides,
  } as Slide)

const pendingRecord = (slide: Slide) => ({
  scheduleId: slide.scheduleId,
  id: slide.id,
  serverId: slide._id,
  localRevision: 1,
  syncState: "pending",
  resyncRequestedAt: "queued",
  slide,
})

const conflictResponse = (slide: Slide) => ({
  error: {
    value: { statusCode: 409, data: { code: "SLIDE_CONFLICT", slide } },
  },
})

describe("slide resync", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    mocks.records = []
    mocks.replacePendingSlide.mockResolvedValue(true)
    vi.stubGlobal("navigator", { onLine: true })
    vi.stubGlobal("watch", vi.fn())
    vi.stubGlobal("useAPIFetch", mocks.apiFetch)
    vi.stubGlobal("usePosthogCapture", vi.fn())
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
          (record) => record.scheduleId === scheduleId && record.id === slideId
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

    const { flushPendingSlides } = await import("~/composables/useSlideResync")
    await flushPendingSlides()

    expect(mocks.apiFetch).toHaveBeenCalledOnce()
    expect(mocks.records).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(30_000)

    expect(mocks.apiFetch).toHaveBeenCalledTimes(2)
    expect(mocks.records).toEqual([])
  })

  it("keeps an offline draft queued until the connection recovers", async () => {
    const mine = queuedSlide({ _id: "offline-slide", rev: 2 })
    mocks.records = [pendingRecord(mine)]
    vi.stubGlobal("navigator", { onLine: false })
    const { flushPendingSlides } = await import("~/composables/useSlideResync")

    await flushPendingSlides()
    expect(mocks.flushShadowWrites).toHaveBeenCalledOnce()
    expect(mocks.apiFetch).not.toHaveBeenCalled()
    expect(mocks.records).toHaveLength(1)

    mocks.apiFetch.mockResolvedValue({
      data: { value: { ...mine, rev: 3 } },
      error: { value: null },
    })
    vi.stubGlobal("navigator", { onLine: true })
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mocks.apiFetch).toHaveBeenCalledOnce()
    expect(mocks.records).toEqual([])
  })

  it("opens a conflict on the first 409 and writes the server copy for an unloaded slide", async () => {
    const mine = queuedSlide({
      _id: "unloaded-slide",
      rev: 3,
      contents: ["Mine"],
    })
    const theirs = { ...mine, rev: 4, contents: ["Theirs"] }
    mocks.records = [pendingRecord(mine)]
    mocks.apiFetch.mockResolvedValueOnce(conflictResponse(theirs))
    const { savePendingSlide, useSlideConflicts } = await import(
      "~/composables/useSlideResync"
    )

    const result = await savePendingSlide(
      mine.churchId,
      mine.scheduleId,
      mine.id,
      mine._id!
    )
    expect(result.status).toBe("conflict")
    expect(mocks.apiFetch).toHaveBeenCalledOnce()

    const { conflicts, resolveKeepTheirs } = useSlideConflicts()
    expect(conflicts.value[0]).toMatchObject({
      localSlide: mine,
      serverSlide: theirs,
    })
    await expect(resolveKeepTheirs(mine._id!)).resolves.toBe(true)
    expect(mocks.replacePendingSlide).toHaveBeenCalledWith(theirs, 1)
    expect(mocks.markSlideSyncState).not.toHaveBeenCalled()
    expect(conflicts.value).toEqual([])
  })

  it("keeps the conflict open if the server moves again after Keep mine", async () => {
    const mine = queuedSlide({ _id: "concurrent-slide", rev: 3 })
    const theirs = { ...mine, rev: 4, contents: ["Changed"] }
    const latest = { ...theirs, rev: 5, contents: ["Changed again"] }
    mocks.records = [pendingRecord(mine)]
    mocks.apiFetch
      .mockResolvedValueOnce(conflictResponse(theirs))
      .mockResolvedValueOnce(conflictResponse(latest))
      .mockResolvedValueOnce({
        data: { value: { ...mine, rev: 6 } },
        error: { value: null },
      })
    const { savePendingSlide, useSlideConflicts } = await import(
      "~/composables/useSlideResync"
    )
    await savePendingSlide(mine.churchId, mine.scheduleId, mine.id, mine._id!)

    const { conflicts, resolveKeepMine } = useSlideConflicts()
    await expect(resolveKeepMine(mine._id!)).resolves.toBe(false)
    expect(conflicts.value[0]?.serverSlide).toMatchObject(latest)
    expect(mocks.markSlideSyncState).not.toHaveBeenCalled()

    await expect(resolveKeepMine(mine._id!)).resolves.toBe(true)
    expect(
      mocks.apiFetch.mock.calls.map(([, options]) => options.body.baseRev)
    ).toEqual([3, 4, 5])
    expect(mocks.markSlideSyncState).toHaveBeenCalledWith(
      mine.scheduleId,
      mine.id,
      "synced",
      1,
      6
    )
    expect(conflicts.value).toEqual([])
  })

  it("skips a retry that was already delivered while it waited for the lock", async () => {
    const slide = queuedSlide({ _id: "delivered-slide", rev: 3 })
    mocks.records = [pendingRecord(slide)]
    const { runSlideSave } = await import("~/utils/slideRev")
    const { savePendingSlide } = await import("~/composables/useSlideResync")
    let finishEditorSave!: () => void
    const editorSave = runSlideSave(
      slide._id!,
      () =>
        new Promise<void>((resolve) => {
          finishEditorSave = resolve
        })
    )
    const retry = savePendingSlide(
      slide.churchId,
      slide.scheduleId,
      slide.id,
      slide._id!
    )

    mocks.records = []
    finishEditorSave()
    await editorSave

    await expect(retry).resolves.toEqual({ status: "skipped" })
    expect(mocks.apiFetch).not.toHaveBeenCalled()
  })
})
