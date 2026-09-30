import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { effectScope } from "vue"
import { useSocketIO } from "~/composables/useSocketIO"
import { getLiveSourceId } from "~/utils/socketSource"

const mocks = vi.hoisted(() => ({ connections: [] as any[] }))
vi.mock("socket.io-client", () => ({
  Socket: class {},
  io: vi.fn((_url, options) => {
    const socket = {
      connected: false,
      on: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn(),
    }
    mocks.connections.push({ options, socket })
    return socket
  }),
}))
vi.mock("@vueuse/core", async () => {
  const { ref } = await import("vue")
  return { useOnline: () => ref(true) }
})
vi.mock("~/store/auth", () => ({
  useAuthStore: () => ({ user: { _id: "user", fullname: "Operator" }, church: { _id: "church" } }),
}))

let scope: ReturnType<typeof effectScope>
let managers: ReturnType<typeof useSocketIO>[]

beforeEach(() => {
  mocks.connections.length = 0
  managers = []
  scope = effectScope()
  vi.stubGlobal("useRuntimeConfig", () => ({ public: { BASE_URL: "http://localhost:4500/api/v1" } }))
  vi.stubGlobal("useAuthToken", () => ({ getToken: () => "test-token" }))
  vi.stubGlobal("useNuxtApp", () => ({ provide: vi.fn() }))
})

afterEach(() => {
  managers.forEach(manager => manager.disconnect())
  scope.stop()
  vi.unstubAllGlobals()
})

describe("operator socket source identity", () => {
  it("recovers the same source after a reload and gives separate sessions distinct sources", () => {
    const session = new Map<string, string>()
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
    })
    const original = getLiveSourceId()
    expect(getLiveSourceId()).toBe(original)
    session.clear() // A separate browser session has its own sessionStorage.
    expect(getLiveSourceId()).not.toBe(original)
  })

  it("can identify a window with sessionStorage disabled", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("Storage disabled") },
    })
    expect(getLiveSourceId()).toEqual(expect.any(String))
  })

  it("sends the same authenticated source id after socket recreation and schedule switches", () => {
    const manager = scope.run(() => useSocketIO({ scheduleId: "schedule" }))!
    managers.push(manager)
    manager.connect()
    manager.reconnect()
    const otherSchedule = scope.run(() => useSocketIO({ scheduleId: "other-schedule" }))!
    managers.push(otherSchedule)
    otherSchedule.connect()

    const identities = mocks.connections.map(({ options }) => options.auth)
    expect(identities).toHaveLength(3)
    expect(identities[0].liveSourceId).toEqual(expect.any(String))
    expect(identities[0].liveSourceId.length).toBeGreaterThan(0)
    expect(identities.every(auth => auth.liveSourceId === identities[0].liveSourceId)).toBe(true)
    expect(identities.every(auth => auth.token === "test-token")).toBe(true)
  })

  it.each(["livestream", "stagestream"] as const)("does not advertise an operator source from %s", client => {
    const manager = scope.run(() => useSocketIO({ scheduleId: "schedule", client }))!
    managers.push(manager)
    manager.connect()
    expect(mocks.connections[0].options.auth).not.toHaveProperty("liveSourceId")
  })
})
