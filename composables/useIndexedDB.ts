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

  public constructor() {
    super('WorshipCloudDatabase')
    this.version(2).stores({
      songs: 'id,lyrics,title,album,cover,artist,verses,createdAt,updatedAt',
      media: 'id,content,data,createdAt,updatedAt', // id === slide.id
      library: 'id,type,content,createdAt,updatedAt'
    })
  }

  // LAST UPDATED: When [createdAt, updatedAt] was added to tables
  // TODO: Remove code by June 2024
  public async newSchemaUpdate() {
    const date = '2024-05-01T00:00:00.000Z'
    // Update library tables
    const newLibraryRows = await this.library.where('createdAt').startsWithIgnoreCase('2024').primaryKeys()
    const oldLibraryRows = await this.library.where('id').noneOf(newLibraryRows).primaryKeys()
    this.library.bulkUpdate(oldLibraryRows?.map(row => ({ key: row, changes: { createdAt: date, updatedAt: date } })))

    // Update media tables
    const newMediaRows = await this.media.where('createdAt').startsWithIgnoreCase('2024').primaryKeys()
    const oldMediaRows = await this.media.where('id').noneOf(newMediaRows).primaryKeys()
    this.media.bulkUpdate(oldMediaRows?.map(row => ({ key: row, changes: { createdAt: date, updatedAt: date } })))
  }
}

const useIndexedDB = () => {
  const db = new WorshipCloudDatabase()
  return db
}

export default useIndexedDB

