import { useAuthStore } from '~/store/auth'
import { useAppStore } from '~/store/app'
import type { Song } from '~/types'
import { safeDBGet } from './useIndexedDB'
// import songsObj from '../public/songs.json'
import useURLFriendlyString from './useURLFriendlyString'

const addIdToReturnedSongs = (songs: Array<Song>) => {
  return songs?.map((song) => ({
    ...song,
    id: useURLFriendlyString(`${song.artist} ${song.title}`),
  }))
}


/**
 * Resolves a song (object or id) and re-chunks its lyrics into verses.
 *
 * @param song
 * @param linesPerDisplay how many lyric lines make up one verse. Falls back to
 *   the app-wide default when omitted.
 * @param options `persistLinesPerSlide: false` chunks at the given value
 *   without promoting it to the app-wide default — for callers that chunk at a
 *   slide-scoped value (a setlist) and must not stomp the global setting.
 * @returns
 */
const useSong = async (
  song: Song | string,
  linesPerDisplay?: number,
  options?: { persistLinesPerSlide?: boolean }
): Promise<Song | null> => {
  // console.log(linesPerDisplay)
  const toast = useToast()
  const authStore = useAuthStore()
  const appStore = useAppStore()

  if (!linesPerDisplay) {
    linesPerDisplay = appStore.currentState.settings.slideStyles.linesPerSlide
  }
  linesPerDisplay = Number(linesPerDisplay)
  if (options?.persistLinesPerSlide !== false) {
    appStore.setSlideStyles({ ...appStore.currentState.settings.slideStyles, linesPerSlide: linesPerDisplay })
  }

  try {
    if (typeof song === 'string' && song?.includes('-')) {
      // If [song] param comes as an ID, retrieve song obj from local backend first, if it's not ObjectID string
      const db = useIndexedDB()
      const data = await safeDBGet(db.library, song)
      song = (data?.content as Song)
    } else if (typeof song === 'string') {
      // If [song] param comes as an ID, retrieve song obj from remote backend first
      const { data, error } = await useAPIFetch(`/church/${authStore?.user?.churchId}/songs/${song}`)
      if (error.value) {
        throw new Error(error.value?.message)
      } else {
        song = (data.value as Song)
      }
    }
    // console.log('song', song)

    // If [song] param, comes as an object, begin division process immediately
    // Divide songs into verses
    const verses = []
    let tempVerse = ''
    let lineCount = 0
    // const lyricLines = song.lyrics?.replaceAll('\n\n', '\n')?.replaceAll('\n \n', '\n')?.split('\n')
    const lyricLines = song.lyrics?.replaceAll('\n \n', '\n\n')?.split('\n')

    for (let i = 0; i < lyricLines.length; i++) {
      let line = lyricLines[i]

      // Clean up line
      line = line?.replaceAll("â", "'").replaceAll('solo: ', '')?.replaceAll(' ??? ', '')?.replaceAll(' ?? ', '')?.replaceAll('[force-verse-break]', '')

      // if line is empty, pick new line and start new verse
      if (line?.trim() === '') {
        verses.push(tempVerse?.replace('\n\n', ''))
        lineCount = 0
        tempVerse = ''
        continue
      }

      tempVerse += `${line}\n`
      lineCount += 1

      if (tempVerse.includes('\n\n')) {
        verses.push(tempVerse?.replace('\n\n', ''))
        lineCount = 0
        tempVerse = ''
        continue
      }

      if (lineCount === linesPerDisplay) {
        verses.push(tempVerse?.replace('\n\n', ''))
        lineCount = 0
        tempVerse = ''
        // }
      }

      if ((lyricLines.length - i) === 1) {
        verses.push(tempVerse?.replace('\n\n', ''))
      }
    }

    song.verses = verses?.filter(verse => verse !== '')
    return song
  } catch (err) {
    // console.log(err)
    toast.add({ title: 'Song not found', icon: 'i-bx-music', color: 'red' })
  }
  return null
}

/**
 * Guesses a song title from its lyrics: the line the chorus repeats the most.
 *
 * Lyrics pasted into the app rarely carry the title inside the text, but the
 * chorus almost always repeats the hook — so the most-repeated line is the best
 * guess. When the lyrics label their sections ('Chorus', '[Pre-Chorus 2]') only
 * the chorus sections are considered; otherwise the whole song is.
 */

// Structural markers ('Chorus', 'Chorus:', '[Verse 1]', '(Bridge)') — never a title.
const SECTION_LABEL =
  /^[\[\(]?\s*(pre[-\s]?chorus|chorus|refrain|verse|bridge|tag|intro|outro|interlude|instrumental|vamp|hook|ending|coda|solo)\b[^A-Za-z]*$/i

// Wordless filler ('Oh oh oh', 'Yeah yeah') repeats a lot but makes a poor title.
const FILLER_WORD = 'oh+|ooh+|woah+|whoa+|ah+|aah+|eh+|hey+|yeah+|yea+|la+|na+|mmm+|hmm+|mm+'
const FILLER = new RegExp(`^(?:${FILLER_WORD})(?:[\\s,]+(?:${FILLER_WORD}))*$`, 'i')

// Repeat markers ('x2', '(x3)') trail a line without being part of it.
const REPEAT_MARKER = /[\(\[]?\s*[x×]\s*\d+\s*[\)\]]?$/i

const MAX_TITLE_WORDS = 8
const MAX_TITLE_CHARS = 60

interface LyricLine {
  raw: string
  key: string
  inChorus: boolean
}

// Punctuation and casing differ between repeats of the same line, so compare on
// a stripped-down key rather than the raw text.
const normaliseLyricLine = (line: string): string =>
  line
    .replace(REPEAT_MARKER, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isFillerLine = (key: string): boolean => FILLER.test(key)

const mostRepeatedLine = (lines: LyricLine[]): LyricLine | null => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (isFillerLine(line.key)) continue
    counts.set(line.key, (counts.get(line.key) || 0) + 1)
  }

  let best: LyricLine | null = null
  let bestCount = 1 // A line that never repeats isn't evidence of a hook.
  for (const line of lines) {
    const count = counts.get(line.key) || 0
    if (count > bestCount) {
      best = line
      bestCount = count
    }
  }
  return best
}

const firstSubstantialLine = (lines: LyricLine[]): LyricLine | undefined =>
  lines.find((line) => !isFillerLine(line.key)) || lines[0]

const formatSongTitle = (raw: string): string => {
  let title = raw
    .replace(REPEAT_MARKER, '')
    .replace(/^["'“”‘’\[\(]+|["'“”‘’\]\)]+$/g, '')
    .replace(/[\s,;:.!\-–—]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = title.split(' ')
  if (words.length > MAX_TITLE_WORDS) title = words.slice(0, MAX_TITLE_WORDS).join(' ')
  if (title.length > MAX_TITLE_CHARS) {
    const cut = title.slice(0, MAX_TITLE_CHARS)
    const lastSpace = cut.lastIndexOf(' ')
    title = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
  }

  // Lyrics pasted in ALL CAPS would otherwise shout from the title field.
  if (title && title === title.toUpperCase() && /\p{L}/u.test(title)) {
    title = title
      .toLowerCase()
      .replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase())
  }

  return title.charAt(0).toUpperCase() + title.slice(1)
}

export const useSuggestedSongTitle = (lyrics: string): string => {
  if (!lyrics?.trim()) return ''

  const lines: LyricLine[] = []
  let inChorus = false

  for (const rawLine of lyrics.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const label = line.match(SECTION_LABEL)
    if (label) {
      // A bare label re-sections everything that follows it.
      inChorus = /^(chorus|refrain)/i.test(label[1] as string)
      continue
    }

    const key = normaliseLyricLine(line)
    if (!key) continue
    lines.push({ raw: line, key, inChorus })
  }

  if (!lines.length) return ''

  // Prefer the chorus when the lyrics say where it is. A chorus printed only
  // once has no repeats to count, so its opening line stands in as the hook.
  const chorus = lines.filter((line) => line.inChorus)
  const pool = chorus.length ? chorus : lines
  const best = mostRepeatedLine(pool) || firstSubstantialLine(pool)

  return best ? formatSongTitle(best.raw) : ''
}

export default useSong
