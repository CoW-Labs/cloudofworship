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
    // console.log('song', song)
    // console.log('song', song)
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
    // Divide songs into verses
    const verses = []
    let tempVerse = ''
    let lineCount = 0
    // const lyricLines = song.lyrics?.replaceAll('\n\n', '\n')?.replaceAll('\n \n', '\n')?.split('\n')
    const lyricLines = song.lyrics?.replaceAll('\n \n', '\n\n')?.split('\n')

    for (let i = 0; i < lyricLines.length; i++) {
      let line = lyricLines[i]
      // if (line.toLocaleLowerCase().includes('[verse') || line.toLocaleLowerCase().includes('[intro]') || line.toLocaleLowerCase().includes('[chorus]')) {
      //   continue
      // }

      line = line.replaceAll("â", "'").replaceAll('solo: ', '')?.replaceAll(' ??? ', '')?.replaceAll(' ?? ', '')?.replaceAll('[force-verse-break]', '')
      tempVerse += `${line}\n`
      lineCount += 1


      if (tempVerse.includes('\n\n')) {
        // console.log(lyricLines[i])
        // console.log(lyricLines[i + 1])
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

export default useSong

