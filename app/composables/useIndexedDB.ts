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

/**
 * Returns the singleton IndexedDB instance.
 * If the database was closed (e.g. browser GC or private-mode restrictions),
 * it re-initialises the connection before returning.
 *
 * All Dexie operations that may throw DatabaseClosedError or ConstraintError
 * should be wrapped with the helpers below for consistent error handling.
 */
const useIndexedDB = () => {
  if (!dbInstance || !dbInstance.isOpen()) {
    dbInstance = new WorshipCloudDatabase()
  }
  return dbInstance
}

/**
 * Safely run a Dexie operation, recovering from DatabaseClosedError by
 * re-opening the database and retrying once.
 *
 * @example
 * await safeDBOperation(() => db.media.delete(slideId))
 */
export const safeDBOperation = async <T>(
  operation: () => Promise<T>
): Promise<T | undefined> => {
  try {
    return await operation()
  } catch (err: any) {
    if (err?.name === 'DatabaseClosedError') {
      // Reset the singleton so the next call to useIndexedDB() opens a fresh connection
      dbInstance = null
      try {
        const db = useIndexedDB()
        return await operation()
      } catch (retryErr: any) {
        console.error('DB operation failed after re-open:', retryErr)
        return undefined
      }
    }
    if (err?.name === 'ConstraintError') {
      // Duplicate key — caller should use put() instead of add()
      console.warn('DB ConstraintError (duplicate key), skipping:', err)
      return undefined
    }
    console.error('DB operation failed:', err)
    return undefined
  }
}

export default useIndexedDB
