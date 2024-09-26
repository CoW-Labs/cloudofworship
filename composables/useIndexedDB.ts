import Dexie from 'dexie'
import useURLFriendlyString from './useURLFriendlyString'
import type { Table } from 'dexie'
import type { Slide, Song, Media, LibraryItem } from '~/types'

const addIdToReturnedSongs = (songs: Array<Song>) => {
  return songs?.map((song) => ({
    ...song,
    id: useURLFriendlyString(`${song.artist} ${song.title}`),
  }))
}


class WorshipCloudDatabase extends Dexie {
  public songs!: Table<Song>
  public media!: Table<Media>
  public library!: Table<LibraryItem, string>
  public cached!: Table<Media>
  public bibleAndHymns!: Table<Media>

  public constructor() {
    super('WorshipCloudDatabase')
    this.version(2).stores({
      songs: 'id,lyrics,title,album,cover,artist,verses,createdAt,updatedAt',
      media: 'id,content,data,createdAt,updatedAt', // id === slide.id
      library: 'id,type,content,createdAt,updatedAt',
      cached: 'id,content,data,createdAt,updatedAt',
      bibleAndHymns: 'id,data,createdAt,updatedAt'
    })
  }

  // REMOVED A CODE BLOCK FROM HERE IN SEPTEMBER 2024, GOD IS GOOD, REMEMBER :)
}

const useIndexedDB = () => {
  const db = new WorshipCloudDatabase()
  return db
}

export default useIndexedDB

