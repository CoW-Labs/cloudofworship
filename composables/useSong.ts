import { useAuthStore } from '~/store/auth'
import { useAppStore } from '~/store/app'
import type { Song } from '~/types'
// import songsObj from '../public/songs.json'
import useURLFriendlyString from './useURLFriendlyString'

const addIdToReturnedSongs = (songs: Array<Song>) => {
  return songs?.map((song) => ({
    ...song,
    id: useURLFriendlyString(`${song.artist} ${song.title}`),
  }))
}

// Section marker regex (case-insensitive)
// Matches: verse 1, verse 2, v1, v2, chorus, refrain, bridge, pre-chorus, prechorus, intro, outro, ending, tag
const sectionMarkerRegex = /^(verse\s*\d*|v\d+|chorus|refrain|bridge|pre-?chorus|intro|outro|ending|tag)$/i

/**
 * Normalize section marker to a consistent label format
 */
const normalizeSectionLabel = (marker: string): string => {
  const lower = marker.toLowerCase().trim()

  // Handle "v1", "v2" format
  if (/^v\d+$/.test(lower)) {
    return `Verse ${lower.slice(1)}`
  }

  // Handle "verse 1", "verse2", "verse" format
  if (/^verse\s*\d*$/.test(lower)) {
    const num = lower.match(/\d+/)?.[0] || '1'
    return `Verse ${num}`
  }

  // Map alternative names to standard names
  if (lower === 'refrain') return 'Chorus'
  if (lower === 'ending') return 'Outro'
  if (lower === 'prechorus' || lower === 'pre-chorus') return 'Pre-Chorus'

  // Capitalize first letter for other markers (bridge, chorus, intro, outro, tag)
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}


/**
 *
 * @param song
 * @param linesPerDisplay
 * @returns
 */
const useSong = async (song: Song | string, linesPerDisplay?: number): Promise<Song | null> => {
  // console.log(linesPerDisplay)
  const toast = useToast()
  const authStore = useAuthStore()
  const appStore = useAppStore()

  if (!linesPerDisplay) {
    linesPerDisplay = appStore.currentState.settings.slideStyles.linesPerSlide
  }
  linesPerDisplay = Number(linesPerDisplay)
  appStore.setSlideStyles({ ...appStore.currentState.settings.slideStyles, linesPerSlide: linesPerDisplay })

  try {
    if (typeof song === 'string' && song?.includes('-')) {
      // If [song] param comes as an ID, retrieve song obj from local backend first, if it's not ObjectID string
      const db = useIndexedDB()
      const data = await db.library.get(song)
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
    // Divide songs into verses with section label detection
    const verses: string[] = []
    const sectionLabels: string[] = []
    let tempVerse = ''
    let lineCount = 0
    let verseCounter = 1
    let currentSectionLabel = 'Verse 1'
    let pendingSectionLabel: string | null = null
    // const lyricLines = song.lyrics?.replaceAll('\n\n', '\n')?.replaceAll('\n \n', '\n')?.split('\n')
    const lyricLines = song.lyrics?.replaceAll('\n \n', '\n\n')?.split('\n')

    for (let i = 0; i < lyricLines.length; i++) {
      let line = lyricLines[i]

      // Clean up line
      line = line.replaceAll("â", "'").replaceAll('solo: ', '')?.replaceAll(' ??? ', '')?.replaceAll(' ?? ', '')?.replaceAll('[force-verse-break]', '')

      const trimmedLine = line.trim()

      // Check if line is a section marker (e.g., "Verse 1", "Chorus", "Bridge")
      if (sectionMarkerRegex.test(trimmedLine)) {
        // If we have content accumulated, save it before switching sections
        if (tempVerse.trim()) {
          verses.push(tempVerse.replace('\n\n', ''))
          sectionLabels.push(currentSectionLabel)
          // If current section was a numbered verse, increment for next auto-labeled verse
          if (currentSectionLabel.startsWith('Verse')) {
            verseCounter = Math.max(verseCounter, parseInt(currentSectionLabel.split(' ')[1] || '1') + 1)
          }
        }
        // Set the new section label for the next verse
        pendingSectionLabel = normalizeSectionLabel(trimmedLine)
        lineCount = 0
        tempVerse = ''
        continue
      }

      // Apply pending section label if we have one
      if (pendingSectionLabel) {
        currentSectionLabel = pendingSectionLabel
        pendingSectionLabel = null
      }

      // if line is empty, pick new line and start new verse
      if (trimmedLine === '') {
        if (tempVerse.trim()) {
          verses.push(tempVerse.replace('\n\n', ''))
          sectionLabels.push(currentSectionLabel)
          // If current section was a numbered verse, prepare next verse number
          if (currentSectionLabel.startsWith('Verse')) {
            verseCounter = Math.max(verseCounter, parseInt(currentSectionLabel.split(' ')[1] || '1') + 1)
            currentSectionLabel = `Verse ${verseCounter}`
          }
        }
        lineCount = 0
        tempVerse = ''
        continue
      }

      tempVerse += `${line}\n`
      lineCount += 1

      if (tempVerse.includes('\n\n')) {
        verses.push(tempVerse.replace('\n\n', ''))
        sectionLabels.push(currentSectionLabel)
        if (currentSectionLabel.startsWith('Verse')) {
          verseCounter = Math.max(verseCounter, parseInt(currentSectionLabel.split(' ')[1] || '1') + 1)
          currentSectionLabel = `Verse ${verseCounter}`
        }
        lineCount = 0
        tempVerse = ''
        continue
      }

      if (lineCount === linesPerDisplay) {
        verses.push(tempVerse.replace('\n\n', ''))
        sectionLabels.push(currentSectionLabel)
        if (currentSectionLabel.startsWith('Verse')) {
          verseCounter = Math.max(verseCounter, parseInt(currentSectionLabel.split(' ')[1] || '1') + 1)
          currentSectionLabel = `Verse ${verseCounter}`
        }
        lineCount = 0
        tempVerse = ''
      }

      if ((lyricLines.length - i) === 1 && tempVerse.trim()) {
        verses.push(tempVerse.replace('\n\n', ''))
        sectionLabels.push(currentSectionLabel)
      }
    }

    song.verses = verses.filter(verse => verse !== '')
    // Filter sectionLabels to match filtered verses
    song.sectionLabels = sectionLabels.slice(0, song.verses.length)
    return song
  } catch (err) {
    // console.log(err)
    toast.add({ title: 'Song not found', icon: 'i-bx-music', color: 'red' })
  }
  return null
}

export default useSong
