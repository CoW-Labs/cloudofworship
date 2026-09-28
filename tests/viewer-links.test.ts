import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computed, effectScope, ref } from "vue"
import { useLivestreamLink, useStageStreamLink } from "~/composables/useLivestreamLink"

vi.mock("~/store/app", () => ({ useAppStore: () => ({}) }))
let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  for (const [name, value] of Object.entries({
    computed, ref,
    storeToRefs: () => ({ currentState: ref({ activeSchedule: { _id: "schedule" } }) }),
    useSubscription: () => ({ hasAccessToFeature: () => true, isTeamsPlan: ref(true) }),
    useRuntimeConfig: () => ({ public: { APP_URL: "https://app.cloudofworship.com/" } }),
    useToast: () => ({ add: vi.fn() }),
  })) vi.stubGlobal(name, value)
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

describe("public viewer links", () => {
  it.each([
    ["tauri://localhost", "https://app.cloudofworship.com"],
    ["http://tauri.localhost", "https://app.cloudofworship.com"],
    ["https://tauri.localhost", "https://app.cloudofworship.com"],
    ["null", "https://app.cloudofworship.com"],
    ["http://localhost:3000", "http://localhost:3000"],
    ["https://preview.cloudofworship.com", "https://preview.cloudofworship.com"],
  ])("uses a reachable origin from %s", (origin, expectedOrigin) => {
    vi.stubGlobal("window", { location: { origin } })
    const stage = scope.run(() => useStageStreamLink())!
    const livestream = scope.run(() => useLivestreamLink())!
    expect(stage.stageStreamURL.value).toBe(`${expectedOrigin}/stagestream/schedule`)
    expect(livestream.livestreamURL.value).toBe(`${expectedOrigin}/livestream/schedule`)
  })
})
