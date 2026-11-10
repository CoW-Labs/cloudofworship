import { describe, expect, it } from "vitest"
// @ts-expect-error plain .mjs bench helpers have no type declarations
import { normalizeWords, wordErrors, parseReference, matchReferences, simulateAutoLive, termRecall } from "../scripts/transcription-bench/metrics.mjs"

describe("transcription bench metrics", () => {
  it("normalises spoken numbers and ordinals to match numerals output", () => {
    expect(normalizeWords("First Corinthians chapter thirteen, verses four to seven")).toEqual(
      ["1", "corinthians", "chapter", "13", "verses", "4", "to", "7"],
    )
    expect(normalizeWords("Psalm one hundred and nineteen, um, verse 1st")).toEqual(["psalm", "119", "verse", "1"])
    expect(normalizeWords("John 3:16")).toEqual(normalizeWords("John three sixteen"))
  })

  it("counts substitutions, deletions and insertions", () => {
    const r = wordErrors("the lord is my shepherd".split(" "), "the lord is a my good shepherd".split(" "))
    expect(r).toMatchObject({ substitutions: 0, deletions: 0, insertions: 2, refWords: 5 })
    expect(wordErrors(["a", "b", "c"], ["a", "x"]).wer).toBeCloseTo(2 / 3)
  })

  it("reads SRT cues with timings", () => {
    const cues = parseReference("1\n00:01:02,500 --> 00:01:04,000\nHello <i>church</i>\n", ".srt")
    expect(cues).toEqual([{ start: 62.5, end: 64, text: "Hello church" }])
  })

  it("matches scriptures by verse, then by chapter, inside the time window", () => {
    const expected = [
      { t: 10, shortLabel: "43:3:16", displayLabel: "John 3:16" },
      { t: 100, shortLabel: "45:8:28", displayLabel: "Romans 8:28" },
    ]
    const detected = [
      { t: 11, shortLabel: "43:3:16", displayLabel: "John 3:16" },
      { t: 101, shortLabel: "45:8:2", displayLabel: "Romans 8:2" },
      { t: 500, shortLabel: "43:3:16", displayLabel: "John 3:16" },
    ]
    const m = matchReferences(expected, detected)
    expect(m.rows.map((r: { kind: string }) => r.kind)).toEqual(["exact", "chapter"])
    expect(m.spurious).toHaveLength(1)
  })

  it("replays the client's auto-live cooldown", () => {
    const ev = (wallMs: number, label: string, provisional = true) => ({ t: wallMs / 1000, wallMs, provisional, references: [{ shortLabel: label, displayLabel: label }] })
    const fires = simulateAutoLive([ev(0, "a"), ev(500, "a"), ev(800, "b"), ev(900, "c", false), ev(5000, "d")])
    expect(fires.map((f: { shortLabel: string }) => f.shortLabel)).toEqual(["a", "c", "d"])
  })

  it("measures recall of multi-word terms", () => {
    const r = termRecall(normalizeWords("song of solomon and john"), normalizeWords("song of solomon"), ["Song of Solomon", "John"])
    expect(r).toMatchObject({ expected: 2, found: 1 })
  })
})
