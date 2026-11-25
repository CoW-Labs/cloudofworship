import { afterEach, expect, it, vi } from "vitest"

const transport = vi.hoisted(() => ({
  listen: vi.fn(),
  post: vi.fn(),
}))

vi.mock("~/composables/useBroadcastMessage", () => ({
  default: transport.listen,
  broadcastNoticeKind: () => undefined,
}))
vi.mock("~/composables/useBroadcastPost", () => ({
  postCrossWindowNotification: transport.post,
}))

afterEach(() => vi.unstubAllGlobals())

it("ignores its own notice across module reloads and delivers a foreign notice", async () => {
  vi.stubGlobal("window", {})
  const sender = await import("~/composables/useSlideDatabaseNotifications")
  sender.notifySlideDatabaseChanged()
  const ownNotice = transport.post.mock.calls[0]![0]

  vi.resetModules()
  const receiver = await import("~/composables/useSlideDatabaseNotifications")
  const reload = vi.fn()
  receiver.useSlideDatabaseNotifications(reload)
  const deliver = transport.listen.mock.calls[0]![0]

  deliver({ payload: ownNotice })
  expect(reload).not.toHaveBeenCalled()
  deliver({ payload: { ...ownNotice, sourceId: "another-window" } })
  expect(reload).toHaveBeenCalledOnce()
})
