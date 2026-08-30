import { beforeAll, describe, expect, it, vi } from "vitest"

// `persist` reads this Nuxt auto-import global when the stores that useSong
// pulls in evaluate, so the composable is imported after the stub is in place.
vi.stubGlobal("piniaPluginPersistedstate", {
  localStorage: () => undefined,
})

let useSuggestedSongTitle: (lyrics: string) => string

beforeAll(async () => {
  ;({ useSuggestedSongTitle } = await import("~/composables/useSong"))
})

describe("useSuggestedSongTitle", () => {
  it("picks the line the labelled chorus repeats most", () => {
    const lyrics = `Verse 1
I was lost in the night
Then you came for me

Chorus
You are my rescue, Lord
I will sing of your love
You are my rescue, Lord
Forever I am yours

Verse 2
Nothing can take me now`

    expect(useSuggestedSongTitle(lyrics)).toBe("You are my rescue, Lord")
  })

  it("falls back to the opening chorus line when the chorus is printed once", () => {
    const lyrics = `Verse 1
Morning breaks upon the hill

[Chorus]
Great is your faithfulness, oh God
You never fail me

Verse 2
Evening falls and still you stay

Chorus`

    expect(useSuggestedSongTitle(lyrics)).toBe("Great is your faithfulness, oh God")
  })

  it("counts repeats across the whole song when no section is labelled", () => {
    const lyrics = `Jesus you are worthy
Nothing else compares
Jesus you are worthy!
Every knee will bow`

    expect(useSuggestedSongTitle(lyrics)).toBe("Jesus you are worthy")
  })

  it("ignores wordless filler even when it repeats most", () => {
    const lyrics = `Oh oh oh
Oh oh oh
Yeah yeah
Hallelujah to the King
Oh oh oh
Hallelujah to the King`

    expect(useSuggestedSongTitle(lyrics)).toBe("Hallelujah to the King")
  })

  it("matches lines that differ only by a repeat marker", () => {
    const lyrics = `Chorus:
I love you Lord (x2)
I love you Lord
You are good to me`

    expect(useSuggestedSongTitle(lyrics)).toBe("I love you Lord")
  })

  it("does not shout a title back from ALL CAPS lyrics", () => {
    const lyrics = `CHORUS
WE WILL DANCE IN YOUR PRESENCE
WE WILL DANCE IN YOUR PRESENCE
LORD OF ALL`

    expect(useSuggestedSongTitle(lyrics)).toBe("We Will Dance In Your Presence")
  })

  it("keeps a long line down to title length", () => {
    const line =
      "There is no one else like you in all the earth and in all of heaven above"
    expect(useSuggestedSongTitle(`Chorus\n${line}\n${line}`)).toBe(
      "There is no one else like you in"
    )
  })

  it("treats a pre-chorus as its own section", () => {
    const lyrics = `Pre-Chorus
Lift him higher
Lift him higher

Chorus
Holy is the Lamb of God
Worthy of it all`

    expect(useSuggestedSongTitle(lyrics)).toBe("Holy is the Lamb of God")
  })

  it("returns nothing for empty or label-only lyrics", () => {
    expect(useSuggestedSongTitle("")).toBe("")
    expect(useSuggestedSongTitle("   \n\n  ")).toBe("")
    expect(useSuggestedSongTitle("Chorus\n\nVerse 1\n")).toBe("")
  })
})
