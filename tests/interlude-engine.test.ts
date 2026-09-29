import { describe, expect, it } from "vitest"
import {
  INTRO,
  LOOP,
  TEXT_MOTION,
  WIPE,
  frameState,
  getInterludeVariant,
  interludeVariants,
  renderInterludeFrame,
  scrimAmount,
  textMotion,
  wipeState,
} from "~/utils/interlude/engine"

// A 2D context that accepts every call and records nothing. Enough to prove
// each variant's draw code runs for any time and either palette.
const stubContext = () => {
  const gradient = { addColorStop: () => {} }
  const target: Record<string | symbol, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  return new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : () => {}),
    set: (t, key, value) => {
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

describe("interlude variants", () => {
  it("lists CoW Original first, then Gathering, Selah and Open Heavens", () => {
    expect(interludeVariants.map((v) => v.id)).toEqual([
      "cow-original",
      "gathering",
      "selah",
      "open-heavens",
      "still-waters",
      "lilies",
      "jubilee",
      "fellowship",
    ])
  })

  it("falls back to CoW Original for an unknown or missing variant", () => {
    expect(getInterludeVariant("retired-variant").id).toBe("cow-original")
    expect(getInterludeVariant(undefined).id).toBe("cow-original")
  })

  it("draws every variant through the intro, the loop and both palettes", () => {
    const ctx = stubContext()
    for (const variant of interludeVariants) {
      for (let T = 0; T < INTRO + LOOP * 2; T += 0.37) {
        expect(() =>
          renderInterludeFrame(ctx, 1280, 720, T, variant, 0.5)
        ).not.toThrow()
      }
    }
  })
})

describe("interlude timeline", () => {
  it("holds the first palette through the intro and the first half-loop", () => {
    for (const T of [0, 1, INTRO, INTRO + LOOP / 2 - 0.01]) {
      expect(wipeState(T)).toMatchObject({ base: 0, wp: 0 })
    }
  })

  it("wipes to the drop palette halfway through the loop", () => {
    const mid = wipeState(INTRO + LOOP / 2 + WIPE / 2)
    expect(mid).toMatchObject({ base: 0, top: 1 })
    expect(mid.wp).toBeGreaterThan(0)
    expect(wipeState(INTRO + LOOP / 2 + WIPE + 0.01)).toMatchObject({
      base: 1,
      wp: 0,
    })
  })

  it("does not wipe at the first loop start, only on later ones", () => {
    expect(wipeState(INTRO + 0.1).wp).toBe(0)
    const back = wipeState(INTRO + LOOP + 0.1)
    expect(back).toMatchObject({ base: 1, top: 0 })
    expect(back.wp).toBeGreaterThan(0)
  })

  it("repeats exactly every loop once the first loop has passed", () => {
    // Offset so no sample lands exactly on a loop boundary, where float
    // rounding can put the same instant at the end of one loop or the start
    // of the next (both draw the same frame).
    for (let T = INTRO + LOOP + 0.013; T < INTRO + LOOP * 2; T += 0.29) {
      const w1 = wipeState(T)
      const w2 = wipeState(T + LOOP)
      expect([w2.base, w2.top]).toEqual([w1.base, w1.top])
      expect(w2.wp).toBeCloseTo(w1.wp, 9)
      expect(w2.since).toBeCloseTo(w1.since, 9)
      const a = frameState(T, 1920, 1080)
      const b = frameState(T + LOOP, 1920, 1080)
      expect(b.osc(1, 0.3)).toBeCloseTo(a.osc(1, 0.3), 9)
      expect(b.osc(2)).toBeCloseTo(a.osc(2), 9)
      expect(b.kick).toBeCloseTo(a.kick, 9)
    }
  })

  it("has no seam where the intro hands over to the loop", () => {
    const before = frameState(INTRO - 1e-6, 1920, 1080)
    const after = frameState(INTRO + 1e-6, 1920, 1080)
    expect(after.osc(1)).toBeCloseTo(before.osc(1), 4)
    expect(Math.cos(after.spin(1))).toBeCloseTo(Math.cos(before.spin(1)), 4)
    expect(Math.sin(after.spin(1))).toBeCloseTo(Math.sin(before.spin(1)), 4)
  })
})

describe("interlude text motion", () => {
  const M = TEXT_MOTION

  it("starts hidden, blurred and zoomed in, then settles", () => {
    expect(textMotion(0, 0, null, 0)).toEqual({ o: 0, s: M.zoomIn, b: 1 })
    const settled = textMotion(M.inAt + M.inDur, 0, null, 0)
    expect(settled).toEqual({ o: 1, s: 1, b: 0 })
  })

  it("brings the sub text in after the heading", () => {
    const t = M.inAt + 0.2
    expect(textMotion(t, 0, null, M.subLag).o).toBeLessThan(
      textMotion(t, 0, null, 0).o
    )
  })

  it("blurs and zooms out on exit, sub text first", () => {
    const out = 10
    const done = textMotion(out + M.outDur + 0.2, 0, out, 0)
    expect(done.o).toBeCloseTo(0, 6)
    expect(done.s).toBeCloseTo(M.zoomOut, 6)
    expect(done.b).toBe(1)
    const t = out + M.outDur / 2
    expect(textMotion(t, 0, out, M.subLag).o).toBeLessThan(
      textMotion(t, 0, out, 0).o
    )
  })

  it("eases the centre scrim in with the text and out with it", () => {
    expect(scrimAmount(0, 0, null)).toBeCloseTo(0, 9)
    expect(scrimAmount(5, 0, null)).toBeCloseTo(1, 9)
    expect(scrimAmount(10, 0, 9)).toBeCloseTo(0, 9)
  })
})
