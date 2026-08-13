import type { ScheduleTemplate, Song } from "~/types"
import { bibleBooks } from "~/utils/constants"

/**
 * Build the numeric "book:chapter:verse" label that `useScripture` expects from
 * a human-readable reference. Book names must match an entry in `bibleBooks`.
 *
 * @example bibleRef("John", 3, "16-17") // → "43:3:16-17"
 */
export const bibleRef = (
  book: string,
  chapter: number,
  verse: number | string
): string => {
  const bookIndex = bibleBooks.indexOf(book) + 1
  if (bookIndex === 0) {
    console.warn(`[scheduleTemplates] Unknown Bible book: "${book}"`)
  }
  return `${bookIndex}:${chapter}:${verse}`
}

// ── Public-domain songs used across templates ───────────────────────────────
// Verses are separated by a blank line in `lyrics` (how `useSong` divides them)
// and pre-split in `verses` (read directly by `createSongSlide`).
const doxologySong: Song = {
  id: "cow-tmpl-song-doxology",
  title: "Praise God, from Whom All Blessings Flow",
  artist: "Thomas Ken",
  lyrics:
    "Praise God, from whom all blessings flow;\nPraise Him, all creatures here below;\nPraise Him above, ye heavenly host;\nPraise Father, Son, and Holy Ghost. Amen.",
  verses: [
    "Praise God, from whom all blessings flow;\nPraise Him, all creatures here below;\nPraise Him above, ye heavenly host;\nPraise Father, Son, and Holy Ghost. Amen.",
  ],
}

const comeThouFountSong: Song = {
  id: "cow-tmpl-song-come-thou-fount",
  title: "Come Thou Fount of Every Blessing",
  artist: "Robert Robinson",
  lyrics:
    "Come, thou Fount of every blessing,\nTune my heart to sing thy grace;\nStreams of mercy, never ceasing,\nCall for songs of loudest praise.\n\nHere I raise mine Ebenezer;\nHither by thy help I'm come;\nAnd I hope, by thy good pleasure,\nSafely to arrive at home.\n\nO to grace how great a debtor\nDaily I'm constrained to be!\nLet thy goodness, like a fetter,\nBind my wandering heart to thee.",
  verses: [
    "Come, thou Fount of every blessing,\nTune my heart to sing thy grace;\nStreams of mercy, never ceasing,\nCall for songs of loudest praise.",
    "Here I raise mine Ebenezer;\nHither by thy help I'm come;\nAnd I hope, by thy good pleasure,\nSafely to arrive at home.",
    "O to grace how great a debtor\nDaily I'm constrained to be!\nLet thy goodness, like a fetter,\nBind my wandering heart to thee.",
  ],
}

const blessedAssuranceSong: Song = {
  id: "cow-tmpl-song-blessed-assurance",
  title: "Blessed Assurance",
  artist: "Fanny J. Crosby",
  lyrics:
    "Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.\n\nThis is my story, this is my song,\nPraising my Savior all the day long;\nThis is my story, this is my song,\nPraising my Savior all the day long.",
  verses: [
    "Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.",
    "This is my story, this is my song,\nPraising my Savior all the day long;\nThis is my story, this is my song,\nPraising my Savior all the day long.",
  ],
}

/**
 * The three schedule starter templates surfaced in ScheduleModal. Each is a
 * themed sequence of slide seeds resolved into real slides at apply-time.
 */
export const scheduleTemplates: ScheduleTemplate[] = [
  {
    key: "regular-sunday",
    label: "Regular Sunday",
    description: "A full order of service for a typical Sunday worship gathering",
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600",
    slides: [
      {
        type: "text",
        heading: "Welcome",
        subtitle: "We're glad you're here — let's worship together",
      },
      { type: "countdown", time: "00:05:00", label: "Service starts in" },
      {
        type: "bible",
        ref: bibleRef("Psalms", 100, "1-2"),
      },
      { type: "song", song: comeThouFountSong },
      {
        type: "song-setlist",
        songs: [blessedAssuranceSong, comeThouFountSong],
      },
      {
        type: "text",
        heading: "Announcements",
        body: "Midweek service — Wednesday 6:00 PM\nNew members' class — Sunday after service\nStay connected: follow us online",
      },
      {
        type: "text",
        heading: "Tithes & Offering",
        subtitle: "Worship the Lord with your giving",
      },
      { type: "bible", ref: bibleRef("2 Corinthians", 9, 7) },
      {
        type: "text",
        heading: "The Word",
        subtitle: "Open your heart to today's message",
      },
      { type: "hymn", number: "410" }, // Doxology
      { type: "bible", ref: bibleRef("Numbers", 6, "24-26") },
      {
        type: "media",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1740",
        name: "Worship background",
      },
    ],
  },
  {
    key: "communion",
    label: "Communion Service",
    description: "A reflective order of service centered on the Lord's Supper",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600",
    slides: [
      {
        type: "text",
        heading: "Communion Service",
        subtitle: "The Table of the Lord",
      },
      {
        type: "text",
        heading: "Preparation",
        body: "Come with a thankful heart.\nExamine yourself before the Lord.\nReceive His grace afresh.",
      },
      { type: "bible", ref: bibleRef("1 Corinthians", 11, "23-26") },
      { type: "hymn", number: "414" }, // When I Survey the Wondrous Cross
      {
        type: "text",
        heading: "The Bread",
        subtitle: "This is my body, given for you",
      },
      {
        type: "text",
        heading: "The Cup",
        subtitle: "This cup is the new covenant in my blood",
      },
      { type: "hymn", number: "556" }, // Amazing Grace
      {
        type: "media",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1740",
        name: "Communion background",
      },
      { type: "bible", ref: bibleRef("Numbers", 6, "24-26") },
    ],
  },
  {
    key: "christmas",
    label: "Christmas Schedule",
    description: "A joyful celebration of the birth of Christ",
    image:
      "https://images.unsplash.com/photo-1512389142860-9c449e58a543?q=80&w=600",
    slides: [
      {
        type: "text",
        heading: "Merry Christmas",
        subtitle: "Unto us a Child is born",
      },
      { type: "countdown", time: "00:10:00", label: "Celebration begins in" },
      { type: "bible", ref: bibleRef("Luke", 2, "8-14") },
      { type: "hymn", number: "120" }, // Hark! the Herald Angels Sing
      {
        type: "text",
        heading: "The Good News",
        subtitle: "For God so loved the world",
      },
      { type: "bible", ref: bibleRef("John", 3, "16-17") },
      { type: "hymn", number: "305" }, // Joy to the World
      {
        type: "media",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?q=80&w=1740",
        name: "Nativity background",
      },
      { type: "bible", ref: bibleRef("Isaiah", 9, 6) },
    ],
  },
]
