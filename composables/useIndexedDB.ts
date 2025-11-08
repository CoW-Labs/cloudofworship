import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Song, Media, LibraryItem, Scripture, Hymn } from '~/types'


class WorshipCloudDatabase extends Dexie {
  public songs!: Table<Song>
  public media!: Table<Media>
  public library!: Table<LibraryItem, string>
  public cached!: Table<Media>
  public bibleAndHymns!: Table<{
    id: string
    data: Array<Scripture | Hymn>
    createdAt: string
    updatedAt: string
  }>

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

// Singleton instance to avoid creating multiple connections
let dbInstance: WorshipCloudDatabase | null = null

const useIndexedDB = () => {
  if (!dbInstance) {
    dbInstance = new WorshipCloudDatabase()
  }
  return dbInstance
}

export default useIndexedDB

