import { describe, expect, it } from "vitest"
import { remapChunkIndex, splitVerseByLines } from "~/composables/useHymn"

/**
 * Changing "lines per slide" must keep the operator on the line they are
 * reading, not on the same slide *number*. These tests pin that behaviour for
 * both chunkers: splitVerseByLines (hymns) and useSong's verse builder (songs).
 */

// useSong's chunking loop, kept in sync with app/composables/useSong.ts
const songVerses = (lyrics: string, linesPerDisplay: number): string[] => {
  const verses: string[] = []
  let tempVerse = ""
  let lineCount = 0
  const lyricLines = lyrics.replaceAll("\n \n", "\n\n").split("\n")

  for (let i = 0; i < lyricLines.length; i++) {
    const line = lyricLines[i] as string
    if (line?.trim() === "") {
      verses.push(tempVerse?.replace("\n\n", ""))
      lineCount = 0
      tempVerse = ""
      continue
    }
    tempVerse += `${line}\n`
    lineCount += 1
    if (tempVerse.includes("\n\n")) {
      verses.push(tempVerse?.replace("\n\n", ""))
      lineCount = 0
      tempVerse = ""
      continue
    }
    if (lineCount === linesPerDisplay) {
      verses.push(tempVerse?.replace("\n\n", ""))
      lineCount = 0
      tempVerse = ""
    }
    if (lyricLines.length - i === 1) {
      verses.push(tempVerse?.replace("\n\n", ""))
    }
  }
  return verses.filter((verse) => verse !== "")
}

const firstLineOf = (chunk?: string) =>
  chunk?.split("\n")?.filter(Boolean)?.[0]

const eightLines = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join(
  "\n"
)

describe("remapChunkIndex — songs", () => {
  const at1 = songVerses(eightLines, 1)
  const at2 = songVerses(eightLines, 2)
  const at3 = songVerses(eightLines, 3)
  const at6 = songVerses(eightLines, 6)

  it("chunks an 8-line song as expected", () => {
    expect(at2).toHaveLength(4)
    expect(at1).toHaveLength(8)
  })

  it("follows the reader when slides get smaller", () => {
    // slide 2 at 2/slide holds lines 3-4 → at 1/slide the reader is on line 3
    expect(firstLineOf(at1[remapChunkIndex(at2, 1, at1)])).toBe("line 3")
    expect(firstLineOf(at1[remapChunkIndex(at2, 3, at1)])).toBe("line 7")
    expect(firstLineOf(at3[remapChunkIndex(at1, 3, at3)])).toBe("line 4")
  })

  it("follows the reader when slides get bigger", () => {
    expect(firstLineOf(at2[remapChunkIndex(at1, 6, at2)])).toBe("line 7")
    // 8 chunks → 2 chunks: the old code indexed past the end and blanked the slide
    expect(remapChunkIndex(at1, 7, at6)).toBe(at6.length - 1)
    expect(firstLineOf(at6[remapChunkIndex(at1, 7, at6)])).toBe("line 7")
  })

  it("respects stanza breaks, which chunk independently of the line count", () => {
    const multi = ["a1", "a2", "a3", "", "b1", "b2", "b3", "b4", "b5"].join("\n")
    const m1 = songVerses(multi, 1)
    const m2 = songVerses(multi, 2) // [a1 a2] [a3] [b1 b2] [b3 b4] [b5]
    const m4 = songVerses(multi, 4) // [a1 a2 a3] [b1..b4] [b5]

    expect(firstLineOf(m1[remapChunkIndex(m2, 3, m1)])).toBe("b3")
    expect(firstLineOf(m4[remapChunkIndex(m2, 3, m4)])).toBe("b1")
    expect(firstLineOf(m4[remapChunkIndex(m1, 7, m4)])).toBe("b5")
  })
})

describe("remapChunkIndex — hymns", () => {
  const verseText = Array.from({ length: 8 }, (_, i) => `h${i + 1}`).join("\n")
  const h1 = splitVerseByLines(verseText, 1)
  const h2 = splitVerseByLines(verseText, 2)

  it("follows the reader across sub-verse chunks", () => {
    expect(firstLineOf(h1[remapChunkIndex(h2, 2, h1)])).toBe("h5")
  })

  it("handles a chunk size that swallows the whole verse", () => {
    const whole = splitVerseByLines(verseText, 8)
    expect(whole).toHaveLength(1)
    expect(remapChunkIndex(h2, 2, whole)).toBe(0)
    expect(firstLineOf(h2[remapChunkIndex(whole, 0, h2)])).toBe("h1")
  })
})

describe("remapChunkIndex — degenerate input", () => {
  const at1 = songVerses(eightLines, 1)
  const at2 = songVerses(eightLines, 2)

  it("returns an in-range index for empty or out-of-bounds input", () => {
    expect(remapChunkIndex([], 3, at1)).toBe(0)
    expect(remapChunkIndex(at2, 3, [])).toBe(0)
    expect(remapChunkIndex(at2, -5, at1)).toBe(0)
    expect(remapChunkIndex(at2, 99, at1)).toBe(6)
  })
})
