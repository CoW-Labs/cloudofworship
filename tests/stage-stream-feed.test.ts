import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  computed, effectScope, nextTick, onScopeDispose, reactive, ref, toRef, watch,
} from "vue"
import { useStageStreamFeed } from "~/composables/useStageStreamFeed"
import { useOperatorSession } from "~/composables/useOperatorSession"
import { defaultStageTimerState } from "~/utils/stageTimer"
import { slideTypes } from "~/utils/constants"

const mocks = vi.hoisted(() => ({ store: null as any, chapter: vi.fn() }))
vi.mock("~/store/app", () => ({ useAppStore: () => mocks.store }))
vi.mock("~/composables/useScripture", () => ({ getChapterVerseCount: mocks.chapter }))
vi.mock("~/composables/useHymn", () => ({ splitVerseByLines: (text: string) => [text] }))

let scope: ReturnType<typeof effectScope>
const textSlide = () => ({
  id: "text", scheduleId: "schedule", name: "Welcome",
  type: slideTypes.text, contents: ["Welcome"],
})
const bibleSlide = () => ({
  id: "bible", scheduleId: "schedule", type: slideTypes.bible,
  name: "Genesis", title: "Genesis 1:1", contents: ["Current verse"],
})

beforeEach(() => {
  vi.useFakeTimers()
  mocks.chapter.mockReset()
  mocks.chapter.mockResolvedValue(31)
  for (const [name, value] of Object.entries({
    computed, ref, watch, onScopeDispose, slideTypes,
    storeToRefs: (store: any) => ({ currentState: toRef(store, "currentState") }),
    useScriptureLabel: (label: string) => label.replace("Genesis ", "1:"),
    useScripture: async () => ({ label: "Genesis 1:2", content: "Next verse" }),
    useToast: () => ({ add: vi.fn() }),
    onMounted: vi.fn(),
    onBeforeUnmount: vi.fn(),
  })) vi.stubGlobal(name, value)
  mocks.store = reactive({
    activeSlides: [textSlide()],
    get activeScheduleSlides() { return this.activeSlides },
    setOnlineUsers: vi.fn(),
    currentState: {
      liveSlideId: "text",
      activeSchedule: { _id: "schedule" },
      stageTimer: defaultStageTimerState(),
      settings: { defaultBibleVersion: "KJV" },
    },
  })
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(200)
}

const createFeed = () => {
  const sent: any[] = []
  const socket = {
    isConnected: () => true,
    sendStageState: (state: any) => { sent.push(state); return true },
  }
  const feed = scope.run(() => useStageStreamFeed({
    getSocket: () => socket,
    hasRemoteTarget: ref(false),
  }))!
  return { feed, sent }
}

describe("stage stream feed lifecycle", () => {
  it("does no NEXT lookup or sending while there are no viewers", async () => {
    mocks.store.activeSlides = [bibleSlide()]
    mocks.store.currentState.liveSlideId = "bible"
    const { sent } = createFeed()
    await settle()
    expect(mocks.chapter).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it("blanks immediately when intermission cancels NEXT and still sends timer changes", async () => {
    const { feed, sent } = createFeed()
    feed.handleMessage("stage-viewers", { count: 1 })
    await settle()
    expect(sent.at(-1).isLive).toBe(true)

    let finish!: (value: number) => void
    mocks.chapter.mockImplementationOnce(() => new Promise<number>((resolve) => {
      finish = resolve
    }))
    mocks.store.activeSlides = [bibleSlide()]
    mocks.store.currentState.liveSlideId = "bible"
    await settle()
    mocks.store.currentState.liveSlideId = ""
    await settle()
    // The lookup has not finished: blanking must not wait for it.
    expect(sent.at(-1)).toMatchObject({ isLive: false, now: { text: "" } })
    mocks.store.currentState.stageTimer = { ...defaultStageTimerState(), elapsedMs: 5000 }
    await settle()
    expect(sent.at(-1).timer.elapsedMs).toBe(5000)
    const messageCount = sent.length
    finish(31)
    await settle()
    expect(sent).toHaveLength(messageCount)
    expect(sent.at(-1).isLive).toBe(false)
  })

  it("resolves NEXT again after the last viewer leaves during a lookup", async () => {
    mocks.store.activeSlides = [bibleSlide()]
    mocks.store.currentState.liveSlideId = "bible"
    let finish!: (value: number) => void
    mocks.chapter.mockImplementationOnce(() => new Promise<number>((resolve) => {
      finish = resolve
    }))
    const { feed, sent } = createFeed()
    feed.handleMessage("stage-viewers", { count: 1 })
    await settle()
    feed.handleMessage("stage-viewers", { count: 0 })
    await settle()
    finish(31)
    await settle()
    feed.handleMessage("stage-viewers", { count: 1 })
    await settle()
    expect(sent.at(-1)).toMatchObject({ isLive: true, next: { text: "Next verse" } })
  })

  it("republishes after an operator reconnect with the same viewer count", async () => {
    const sent: any[] = []
    let callbacks: any
    const manager = {
      connect: vi.fn(), disconnect: vi.fn(), isConnected: () => true,
      sendStageState: (state: any) => { sent.push(state); return true },
    }
    vi.stubGlobal("useStageStreamFeed", useStageStreamFeed)
    vi.stubGlobal("useNuxtApp", () => ({ $emitter: { on: vi.fn() } }))
    vi.stubGlobal("useLiveOutputControl", () => ({
      hasRemoteTarget: ref(false), announce: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }))
    vi.stubGlobal("useRealtimeSlides", () => ({
      handleWebSocketMessage: vi.fn(), updateOnlineUsers: vi.fn(), cleanup: vi.fn(),
    }))
    vi.stubGlobal("useSocketIO", (options: any) => { callbacks = options; return manager })
    const session = scope.run(() => useOperatorSession())!
    await session.connectSocket()
    callbacks.onConnected()
    callbacks.onMessage("stage-viewers", { data: { count: 1 } })
    await settle()
    expect(sent).toHaveLength(1)
    // The new server lost its snapshot, and the existing viewer rejoined first.
    sent.length = 0
    callbacks.onDisconnected()
    await settle()
    callbacks.onConnected()
    callbacks.onMessage("stage-viewers", { data: { count: 1 } })
    await settle()
    expect(sent).toHaveLength(1)
    expect(sent[0].now.text).toBe("Welcome")
  })
})
