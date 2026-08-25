import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { createApp } from "vue"
import type { Slide } from "~/types"

// `persist` reads this Nuxt auto-import global when the store module evaluates.
vi.stubGlobal("piniaPluginPersistedstate", {
  localStorage: () => undefined,
})

const slide = (id: string, scheduleId: string, over: Record<string, any> = {}) =>
  ({ id, scheduleId, type: "text", contents: [id], ...over } as unknown as Slide)

const newStore = async () => {
  const pinia = createPinia()
  createApp({}).use(pinia)
  setActivePinia(pinia)
  const { useAppStore } = await import("~/store/app")
  return useAppStore()
}

describe("active schedule slide derivation", () => {
  let store: Awaited<ReturnType<typeof newStore>>

  beforeEach(async () => {
    store = await newStore()
    store.$reset()
  })

  const useSchedule = (id: string) => {
    store.currentState.activeSchedule = { _id: id } as any
  }

  it("follows the active schedule", () => {
    store.setActiveSlides([
      slide("a", "sch1"),
      slide("b", "sch2"),
      slide("c", "sch1"),
    ])
    useSchedule("sch1")
    expect(store.activeScheduleSlides?.map((s) => s.id)).toEqual(["a", "c"])
    useSchedule("sch2")
    expect(store.activeScheduleSlides?.map((s) => s.id)).toEqual(["b"])
  })

  // Regression: PreviewContent synced a local mirror behind an
  // `if (tempSlides.length > 0)` guard, so an emptied schedule kept rendering
  // the previous schedule's slides and the empty state never appeared.
  it("goes empty when the active schedule has no slides", () => {
    store.setActiveSlides([slide("a", "sch1")])
    useSchedule("sch1")
    expect(store.activeScheduleSlides).toHaveLength(1)

    useSchedule("sch-empty")
    expect(store.activeScheduleSlides).toEqual([])
  })

  it("goes empty when the last slide of a schedule is removed", () => {
    const only = slide("a", "sch1")
    store.setActiveSlides([only])
    useSchedule("sch1")

    store.removeActiveSlide(only)
    expect(store.activeScheduleSlides).toEqual([])
  })
})

describe("countdown replacement", () => {
  let store: Awaited<ReturnType<typeof newStore>>

  beforeEach(async () => {
    store = await newStore()
    store.$reset()
    store.currentState.activeSchedule = { _id: "sch1" } as any
  })

  // Regression: the old handler filtered a local copy and never touched the
  // store, so appending the replacement re-derived the grid from `activeSlides`
  // and the superseded countdown slides came back.
  it("replacing a countdown leaves exactly one countdown slide", () => {
    const stale = slide("old", "sch1", { type: "countdown" })
    const overlay = slide("ov", "sch1", {
      type: "countdown",
      slideMode: "overlay",
    })
    store.setActiveSlides([stale, overlay, slide("text", "sch1")])

    // What PreviewContent now does on "new-countdown".
    const doomed = (store.activeScheduleSlides ?? []).filter(
      (s: any) => s.type === "countdown" && s.slideMode !== "overlay"
    )
    doomed.forEach((s: Slide) => store.removeActiveSlide(s))

    store.appendActiveSlide(slide("new", "sch1", { type: "countdown" }))

    const countdowns = (store.activeScheduleSlides ?? []).filter(
      (s: any) => s.type === "countdown" && s.slideMode !== "overlay"
    )
    expect(countdowns.map((s) => s.id)).toEqual(["new"])
    // the overlay countdown is deliberately preserved
    expect(store.activeScheduleSlides?.map((s) => s.id)).toContain("ov")
  })
})

describe("updateSlideInActiveSlides", () => {
  let store: Awaited<ReturnType<typeof newStore>>

  beforeEach(async () => {
    store = await newStore()
    store.$reset()
  })

  // Regression: the old call sites did `splice(slideIndex || 0, 1, updated)`.
  // findIndex returns -1 on a miss, and -1 is truthy, so a slide that was not
  // in the list overwrote the *last* slide instead of being ignored.
  it("is a no-op when the slide is not present", () => {
    store.setActiveSlides([slide("a", "sch1"), slide("b", "sch1")])

    store.updateSlideInActiveSlides(
      slide("missing", "sch1", { contents: ["clobbered"] })
    )

    expect(store.currentState.activeSlides.map((s) => s.id)).toEqual(["a", "b"])
    expect(store.currentState.activeSlides[1].contents).toEqual(["b"])
  })

  it("replaces the matching slide in place", () => {
    store.setActiveSlides([slide("a", "sch1"), slide("b", "sch1")])
    store.updateSlideInActiveSlides(slide("b", "sch1", { contents: ["edited"] }))

    expect(store.currentState.activeSlides.map((s) => s.id)).toEqual(["a", "b"])
    expect(store.currentState.activeSlides[1].contents).toEqual(["edited"])
  })
})
