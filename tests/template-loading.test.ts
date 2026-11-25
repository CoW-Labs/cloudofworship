import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"

const mocks = vi.hoisted(() => ({
  auth: { user: { _id: "user-a", churchId: "church-a" } },
  fetch: vi.fn(),
}))
vi.mock("~/store/auth", () => ({ useAuthStore: () => mocks.auth }))

import useTemplates from "~/composables/useTemplates"
import { useTemplateStore } from "~/store/template"

const template = { _id: "template-a", design: { boxes: [{}] } }

describe("church template loading", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.auth.user = { _id: "user-a", churchId: "church-a" }
    mocks.fetch.mockReset()
    vi.stubGlobal("useAPIFetch", mocks.fetch)
  })

  it("retries after a failed request instead of caching an empty result", async () => {
    mocks.fetch
      .mockResolvedValueOnce({ data: { value: null }, error: { value: new Error("offline") } })
      .mockResolvedValueOnce({ data: { value: [template] }, error: { value: null } })
    const store = useTemplateStore()
    const { loadChurchTemplates } = useTemplates()
    await loadChurchTemplates()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe(true)
    await loadChurchTemplates()
    expect(store.loaded).toBe(true)
    expect(store.error).toBe(false)
    expect(store.church[0]?._id).toBe("template-a")
  })

  it("ignores an old request after the session changes", async () => {
    let finish!: (value: unknown) => void
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const store = useTemplateStore()
    const pending = useTemplates().loadChurchTemplates()
    store.clear()
    mocks.auth.user = { _id: "user-b", churchId: "church-b" }
    finish({ data: { value: [template] }, error: { value: null } })
    await pending
    expect(store.loaded).toBe(false)
    expect(store.church).toEqual([])
  })
})
