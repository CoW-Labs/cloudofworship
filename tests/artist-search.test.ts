import { describe, expect, it } from "vitest"

import { useArtistSearch } from "~/composables/useArtistSearch"
import { songArtists } from "~/utils/songArtists"

const { searchArtists } = useArtistSearch()

describe("useArtistSearch", () => {
  it("offers the most-used artists when nothing is typed", async () => {
    const results = await searchArtists("")

    expect(results).toEqual(songArtists.slice(0, results.length))
    expect(results[0]).toBe("Hillsong Worship")
  })

  it("never returns more rows than the dropdown should render", async () => {
    // "a" matches hundreds of names; the menu must still get a short list.
    const results = await searchArtists("a")

    expect(results.length).toBeLessThanOrEqual(8)
  })

  it("ranks a name starting with the query above a mid-word match", async () => {
    const results = await searchArtists("sinach")

    expect(results[0]).toBe("Sinach")
  })

  it("matches on a word in the middle of a name", async () => {
    expect(await searchArtists("chinwo")).toContain("Mercy Chinwo")
  })

  it("ignores case, accents and punctuation", async () => {
    expect(await searchArtists("helio borges")).toContain("Hélio Borges")
    expect(await searchArtists("d'clario")).toContain("Christine D’Clario")
    expect(await searchArtists("michael w smith")).toContain("Michael W. Smith")
  })

  it("returns nothing for a name the library has never seen", async () => {
    expect(await searchArtists("zzzz nobody")).toEqual([])
  })

  it("holds one spelling per artist", () => {
    // The whole point of the list is consistent credits, so two spellings of
    // the same name must never both be suggestible.
    const seen = new Map<string, string>()

    for (const artist of songArtists) {
      const key = artist
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "")

      expect(seen.get(key), `duplicate of "${seen.get(key)}"`).toBeUndefined()
      seen.set(key, artist)
    }
  })

  it("holds no placeholder names, so none can be suggested", async () => {
    const placeholders = ["idk", "TBA", "unknow", "Unkown", "No se"]

    for (const placeholder of placeholders) {
      expect(songArtists).not.toContain(placeholder)
    }
  })
})
