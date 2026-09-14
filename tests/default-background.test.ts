import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { createApp } from "vue"

vi.stubGlobal("piniaPluginPersistedstate", {
  localStorage: () => undefined,
})
vi.stubGlobal("usePosthogCapture", vi.fn())

let useAppStore: typeof import("~/store/app")["useAppStore"]
let useResolvedDefaultBackground: typeof import("~/composables/useDefaultBackground")["useResolvedDefaultBackground"]
let mergeBackgroundEntry: typeof import("~/composables/useUserSettings")["mergeBackgroundEntry"]

beforeAll(async () => {
  ;({ useAppStore } = await import("~/store/app"))
  ;({ useResolvedDefaultBackground } = await import(
    "~/composables/useDefaultBackground"
  ))
  ;({ mergeBackgroundEntry } = await import("~/composables/useUserSettings"))
})

const newStore = () => {
  const pinia = createPinia()
  createApp({}).use(pinia)
  setActivePinia(pinia)
  return useAppStore()
}

describe("default slide backgrounds", () => {
  let store: ReturnType<typeof useAppStore>

  beforeEach(() => {
    store = newStore()
    store.$reset()
  })

  it("keeps the legacy songs background as the countdown fallback", () => {
    store.setDefaultSlideBackground(
      "image",
      "legacy-songs.jpg",
      null,
      null,
      "hymn"
    )

    expect(useResolvedDefaultBackground("default")).toMatchObject({
      backgroundType: "image",
      background: "legacy-songs.jpg",
    })
  })

  it("restores a disabled override when it is enabled again", () => {
    store.setDefaultSlideBackground("solid", "global", null, null, "default")
    store.setDefaultSlideBackground("solid", "songs", null, null, "hymn")
    store.clearDefaultSlideBackground("hymn")

    expect(useResolvedDefaultBackground("hymn").background).toBe("global")
    expect(store.currentState.settings.defaultBackground.hymn.custom).toBe(
      false
    )

    store.enableDefaultSlideBackground("hymn")

    expect(useResolvedDefaultBackground("hymn").background).toBe("songs")
    expect(store.currentState.settings.defaultBackground.hymn.custom).toBe(true)
  })

  it("starts an untouched override from the app-wide default", () => {
    store.setDefaultSlideBackground("solid", "global", null, null, "default")

    store.enableDefaultSlideBackground("bible")

    expect(store.currentState.settings.defaultBackground.bible).toMatchObject({
      backgroundType: "solid",
      background: "global",
      custom: true,
    })
  })

  it("preserves an explicitly disabled override when settings are merged", () => {
    const local = {
      backgroundType: "solid",
      background: "songs",
      backgroundVideoKey: null,
      custom: true,
    }
    const { custom: _custom, ...legacyRemote } = local

    expect(mergeBackgroundEntry(local, { ...local, custom: false }).custom).toBe(
      false
    )
    expect(mergeBackgroundEntry(local, legacyRemote).custom).toBeUndefined()
  })
})
