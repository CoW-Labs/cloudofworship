import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Church, User } from "~/store/auth"

const posthog = vi.hoisted(() => ({
  __loaded: true,
  distinctId: "anon-1",
  identify: vi.fn(),
  get_distinct_id() {
    return this.distinctId
  },
}))

vi.mock("posthog-js", () => ({ default: posthog }))

const user = {
  _id: "user-1",
  email: "a@b.com",
  fullname: "Ada",
  role: "admin",
  createdAt: "2026-11-04",
} as User

const church = (plan: "free" | "teams") =>
  ({ _id: "church-1", name: "Grace", subscriptionPlan: plan }) as Church

describe("identifyPosthogUser", () => {
  let identifyPosthogUser: typeof import("~/utils/posthogIdentity").identifyPosthogUser

  beforeEach(async () => {
    vi.resetModules()
    posthog.__loaded = true
    posthog.distinctId = "anon-1"
    posthog.identify.mockClear()
    ;({ identifyPosthogUser } = await import("~/utils/posthogIdentity"))
  })

  it("identifies a user who has just signed in, before the church loads", () => {
    identifyPosthogUser(user, null)
    expect(posthog.identify).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ email: "a@b.com", church: undefined })
    )
  })

  it("updates the profile when the church and plan arrive or change", () => {
    identifyPosthogUser(user, null)
    identifyPosthogUser(user, church("free"))
    identifyPosthogUser(user, church("teams"))
    expect(posthog.identify).toHaveBeenCalledTimes(3)
    expect(posthog.identify).toHaveBeenLastCalledWith(
      "user-1",
      expect.objectContaining({
        church: "Grace",
        church_id: "church-1",
        subscription_plan: "teams",
        is_teams: true,
      })
    )
  })

  it("skips a repeat with nothing new", () => {
    identifyPosthogUser(user, church("free"))
    identifyPosthogUser(user, church("free"))
    expect(posthog.identify).toHaveBeenCalledTimes(1)
  })

  it("identifies again after a sign-out resets the distinct id", () => {
    identifyPosthogUser(user, church("free"))
    posthog.distinctId = "anon-2"
    identifyPosthogUser(user, church("free"))
    expect(posthog.identify).toHaveBeenCalledTimes(2)
  })

  it("does nothing without a user or before PostHog has started", () => {
    identifyPosthogUser(null, church("free"))
    posthog.__loaded = false
    identifyPosthogUser(user, church("free"))
    expect(posthog.identify).not.toHaveBeenCalled()
  })
})
