import { expect, it } from "vitest"
import { ref } from "vue"
import type { Slide, SongSetlistData } from "~/types"
import { preserveActiveVerse, trackActiveVerseNavigation } from "~/utils/activeVerseNavigation"

const saved: Slide = {
  id: "slide",
  scheduleId: "schedule",
  churchId: "church",
  userId: "operator",
  index: 0,
  name: "Saved name",
  type: "song",
  layout: "full-text",
  title: "Verse 5",
  contents: ["Verse 5 lyrics"],
  slideStyle: { linesPerSlide: 2, fontSize: 90, font: "Inter" },
}

it.each(["song", "bible", "hymn", "song-setlist"])("merges a stale %s snapshot with the rendered verse", (type) => {
  const item = { id: "item", songId: "song", verseIndex: 4 }
  const incoming = {
    ...saved, type,
    data: type === "song-setlist" ? { songs: [item], activeSongIndex: 0 } : undefined,
  }
  const current: Slide = {
    ...incoming,
    name: "Old name",
    title: "Verse 7",
    contents: ["Verse 7 lyrics"],
    layout: "bible",
    slideStyle: { linesPerSlide: 2, fontSize: 120 },
    hymnSubVerseIndex: 2,
    data: type === "song-setlist"
      ? { songs: [{ ...item, verseIndex: 6 }], activeSongIndex: 0 }
      : undefined,
  }
  const restored = preserveActiveVerse(incoming, current)
  expect(restored).toMatchObject({
    name: "Saved name",
    title: "Verse 7",
    contents: ["Verse 7 lyrics"],
    layout: "bible",
    slideStyle: { linesPerSlide: 2, fontSize: 120, font: "Inter" },
    hymnSubVerseIndex: 2,
  })
  if (type === "song-setlist") {
    expect((restored.data as SongSetlistData).songs[0]?.verseIndex).toBe(6)
  }
})

it("uses the saved slide when a content edit invalidates the rendered verse", () => {
  const current = { ...saved, slideStyle: { linesPerSlide: 3 } }
  expect(preserveActiveVerse(saved, current)).toBe(saved)
})

it("keeps the cursor through storage reloads and releases it on new selections or incoming verses", () => {
  const current = { ...saved, title: "Verse 7", contents: ["Verse 7 lyrics"] }
  const activeSlide = ref<Slide | undefined>(current)
  const navigation = trackActiveVerseNavigation(activeSlide)
  navigation.remember()

  activeSlide.value = preserveActiveVerse(saved, navigation.current!)
  expect(navigation.current?.title).toBe("Verse 7")

  activeSlide.value = { ...current, contents: ["An accepted incoming update"] }
  expect(navigation.current).toBeUndefined()

  activeSlide.value = current
  navigation.remember()
  activeSlide.value = { ...saved, id: "another-slide" }
  activeSlide.value = current
  expect(navigation.current).toBeUndefined()
})
