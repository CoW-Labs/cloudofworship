// Typeahead over the ~650 known song artists (`~/utils/songArtists`).
//
// The list is long enough that the naive approach — hand every name to the
// combobox and let it filter — would build 650 DOM nodes on open and re-run a
// regex per name per keystroke. On a low-end machine that is a visibly janky
// field. So instead:
//
//   1. the list is fetched with a dynamic import, on first search, and cached
//      for the rest of the session — it costs nothing until the field is used;
//   2. each name is normalised once, at load, so a keystroke is one `indexOf`
//      per name over plain ASCII (no regex, no allocation, no `toLowerCase`);
//   3. at most MAX_RESULTS names are ever returned, so the dropdown renders a
//      handful of nodes no matter how broad the query is.

const MAX_RESULTS = 8

let artists: string[] = []
let normalized: string[] = []
let loader: Promise<void> | null = null

// Lowercase, strip accents, and flatten every punctuation run to a single
// space, so "Christine D’Clario" is stored as "christine d clario" — the curly
// apostrophe, a straight one and a plain space all find it.
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const load = () => {
  if (!loader) {
    loader = import("~/utils/songArtists").then(({ songArtists }) => {
      artists = songArtists
      normalized = songArtists.map(normalize)
    })
  }
  return loader
}

export const useArtistSearch = () => {
  const searchArtists = async (query: string): Promise<string[]> => {
    await load()

    const q = normalize(query || "")
    // Nothing typed: the list is ordered by usage, so the head of it is the
    // most useful thing to show.
    if (!q) return artists.slice(0, MAX_RESULTS)

    // Three buckets, best first: name starts with the query, a *word* in the
    // name starts with it, the query appears anywhere. Bucketing in list order
    // keeps ties ranked by usage and avoids sorting a long match array.
    const startsWith: string[] = []
    const wordStart: string[] = []
    const contains: string[] = []

    for (let i = 0; i < normalized.length; i++) {
      const at = normalized[i]!.indexOf(q)
      if (at === -1) continue

      const bucket =
        at === 0
          ? startsWith
          : normalized[i]![at - 1] === " "
          ? wordStart
          : contains

      if (bucket.length < MAX_RESULTS) bucket.push(artists[i]!)
      // A full bucket of prefix matches can't be improved on by scanning further.
      if (startsWith.length === MAX_RESULTS) break
    }

    return [...startsWith, ...wordStart, ...contains].slice(0, MAX_RESULTS)
  }

  return { searchArtists }
}
