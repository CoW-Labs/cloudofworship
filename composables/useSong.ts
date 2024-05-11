import type { Song } from '~/types'
import songsObj from '../public/songs.json'
import useURLFriendlyString from './useURLFriendlyString'

const addIdToReturnedSongs = (songs: Array<Song>) => {
  return songs?.map((song) => ({
    ...song,
    id: useURLFriendlyString(`${song.artist} ${song.title}`),
  }))
}

const useSong = (song: Song, linesPerDisplay: number = 4): Song | null => {
  const toast = useToast()

  try {
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
    toast.add({ title: 'Song not found', icon: 'i-bx-music', color: 'red' })
  }
  return null
}

export default useSong

