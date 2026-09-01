import { describe, expect, it } from "vitest"
import useBibleReferenceParser from "~/composables/useBibleReferenceParser"

/** Convenience: the human-readable labels the parser found, in order. */
const labels = (text: string) =>
  useBibleReferenceParser(text).map((ref) => ref.displayLabel)

describe("useBibleReferenceParser — singular book names", () => {
  it("resolves a numbered book whose plural 's' was dropped", () => {
    expect(labels("1 king 4 7")).toEqual(["1 Kings 4:7"])
    expect(labels("2 king 4 7")).toEqual(["2 Kings 4:7"])
    expect(labels("1 chronicle 16 34")).toEqual(["1 Chronicles 16:34"])
  })

  it("resolves singulars spoken as ordinals", () => {
    // normalizeSpokenNumbers rewrites the prefix before the lookup runs
    expect(labels("first king 4 7")).toEqual(["1 Kings 4:7"])
    expect(labels("second corinthian 5 17")).toEqual(["2 Corinthians 5:17"])
  })

  it("resolves unnumbered plural books in the singular", () => {
    expect(labels("roman 8 28")).toEqual(["Romans 8:28"])
    expect(labels("philippian 4 13")).toEqual(["Philippians 4:13"])
    expect(labels("galatian 5 22")).toEqual(["Galatians 5:22"])
    expect(labels("ephesian 2 8")).toEqual(["Ephesians 2:8"])
    expect(labels("colossian 3 23")).toEqual(["Colossians 3:23"])
    expect(labels("hebrew 11 1")).toEqual(["Hebrews 11:1"])
    expect(labels("judge 6 12")).toEqual(["Judges 6:12"])
    expect(labels("lamentation 3 22")).toEqual(["Lamentations 3:22"])
  })

  it("handles singulars in every reference format, not just bare numbers", () => {
    expect(labels("1 king 4:7")).toEqual(["1 Kings 4:7"])
    expect(labels("1 king chapter 4 verse 7")).toEqual(["1 Kings 4:7"])
    expect(labels("turn to 1 king 4 verse 7")).toEqual(["1 Kings 4:7"])
    expect(labels("the book of roman chapter 8 verse 28 to 30")).toEqual([
      "Romans 8:28-30",
    ])
  })

  it("still resolves the spelled-out numbers a transcript produces", () => {
    expect(labels("first king four verse seven")).toEqual(["1 Kings 4:7"])
    expect(labels("roman eight twenty eight")).toEqual(["Romans 8:28"])
  })

  it("keeps the plural forms working", () => {
    expect(labels("1 kings 4 7")).toEqual(["1 Kings 4:7"])
    expect(labels("first kings 4:7")).toEqual(["1 Kings 4:7"])
    expect(labels("romans 8 28")).toEqual(["Romans 8:28"])
    expect(labels("1 kgs 4 7")).toEqual(["1 Kings 4:7"])
  })

  it("does not singularise names where the trailing 's' is not a plural", () => {
    // "Exodu", "Titu", "Jame" are not things anyone says
    expect(labels("exodu 20 3")).toEqual([])
    expect(labels("titu 2 11")).toEqual([])
    expect(labels("jame 1 5")).toEqual([])
    // ...and the full names are unaffected
    expect(labels("exodus 20 3")).toEqual(["Exodus 20:3"])
    expect(labels("james 1 5")).toEqual(["James 1:5"])
  })

  it("does not singularise books whose singular is an everyday word", () => {
    // Deliberately excluded: "number" would fire on ordinary speech such as
    // "point number 2 3 times".
    expect(labels("number 6 24")).toEqual([])
    // The plural spelling still resolves
    expect(labels("numbers 6 24")).toEqual(["Numbers 6:24"])
    // "act" is a long-standing hand-registered alias, left as-is
    expect(labels("act 2 38")).toEqual(["Acts of the Apostles 2:38"])
  })

  it("finds singular references inside a full sentence", () => {
    expect(
      labels("let's turn together to 1 king 4 7 and then over to roman 8 28")
    ).toEqual(["1 Kings 4:7", "Romans 8:28"])
  })

  it("points startIndex/endIndex at the original text", () => {
    const raw = "please open 1 king 4 7 with me"
    const [ref] = useBibleReferenceParser(raw)
    expect(ref).toBeDefined()
    expect(raw.slice(ref!.startIndex, ref!.endIndex)).toContain("1 king 4 7")
    expect(ref!.shortLabel).toBe("11:4:7")
  })
})
