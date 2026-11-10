import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { Slide } from "~/types"

// The record write is held open on demand, standing in for a busy IndexedDB.
const writes: { slideId: string | null; release: () => void }[] = []
vi.mock("~/composables/useLiveProjectionRepository", () => ({
  useLiveProjectionRepository: () => ({
    putCurrent: (payload: Slide | null) =>
      new Promise<void>((release) => {
        writes.push({ slideId: payload?.id ?? null, release })
      }),
    getCurrent: async () => undefined,
    clear: async () => {},
  }),
}))

const slide = (id: string, overrides: Partial<Slide> = {}) =>
  ({
    id,
    scheduleId: "sunday",
    index: 0,
    type: "media",
    contents: [],
    ...overrides,
  }) as Slide

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let useBroadcastPost: typeof import("~/composables/useBroadcastPost").default
let flushLiveProjectionBroadcasts: typeof import("~/composables/useBroadcastPost").flushLiveProjectionBroadcasts

beforeAll(async () => {
  ;(globalThis as any).useTauri = () => ({ isTauri: false })
  const module = await import("~/composables/useBroadcastPost")
  useBroadcastPost = module.default
  flushLiveProjectionBroadcasts = module.flushLiveProjectionBroadcasts
})

afterEach(async () => {
  while (writes.length) writes.shift()!.release()
  await flushLiveProjectionBroadcasts()
  writes.length = 0
})

describe("useBroadcastPost", () => {
  it("sends the slide itself while its database record is still being written", async () => {
    const receiver = new BroadcastChannel("cow-live-channel")
    const received = new Promise<any>((resolve) => {
      receiver.onmessage = (event) => resolve(JSON.parse(event.data))
    })

    useBroadcastPost(
      slide("video", {
        background: "blob:http://localhost/abc",
        slideStyle: { isMediaPlaying: false, mediaCommandAt: 42 },
      })
    )
    const envelope = await received
    receiver.close()

    // The write never finished, and the projector already has the slide.
    expect(writes).toHaveLength(1)
    expect(envelope.payload).toMatchObject({
      id: "video",
      slideStyle: { isMediaPlaying: false, mediaCommandAt: 42 },
    })
    // A link that only works in the operator's own tab is blanked on the wire.
    expect(envelope.payload.background).toBe("")
  })

  it("writes only the newest live state once a slow write finishes", async () => {
    useBroadcastPost(slide("first"))
    useBroadcastPost(slide("second"))
    useBroadcastPost(slide("third"))
    await settle()

    // One write in flight, the other two waiting: only the newest is kept.
    expect(writes.map((write) => write.slideId)).toEqual(["first"])
    writes.shift()!.release()
    await settle()
    expect(writes.map((write) => write.slideId)).toEqual(["third"])
  })

  it("records a blank screen too", async () => {
    useBroadcastPost(null)
    await settle()
    expect(writes.map((write) => write.slideId)).toEqual([null])
  })
})

describe("broadcastNoticeKind", () => {
  let broadcastNoticeKind: typeof import("~/composables/useBroadcastMessage").broadcastNoticeKind
  let postCrossWindowNotification: typeof import("~/composables/useBroadcastPost").postCrossWindowNotification

  beforeAll(async () => {
    broadcastNoticeKind = (await import("~/composables/useBroadcastMessage")).broadcastNoticeKind
    postCrossWindowNotification = (await import("~/composables/useBroadcastPost")).postCrossWindowNotification
  })

  const nextMessage = (send: () => void) => {
    const receiver = new BroadcastChannel("cow-live-channel")
    return new Promise<string>((resolve) => {
      receiver.onmessage = (event) => {
        receiver.close()
        resolve(event.data)
      }
      send()
    })
  }

  it("reads a notice's kind from the envelope as it is sent", async () => {
    const data = await nextMessage(() =>
      postCrossWindowNotification({ kind: "media-playback", slideId: "a" })
    )
    expect(broadcastNoticeKind(data)).toBe("media-playback")
  })

  it("says a live slide is not a notice, so listeners skip parsing it", async () => {
    const data = await nextMessage(() => useBroadcastPost(slide("video")))
    expect(broadcastNoticeKind(data)).toBeNull()
  })

  it("leaves a message that is not a string to be inspected", () => {
    expect(broadcastNoticeKind({ payload: { kind: "stage-timer" } })).toBeUndefined()
  })
})
