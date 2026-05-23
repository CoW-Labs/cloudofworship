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

const clearOldCaches = async () => {
  if (typeof caches === 'undefined') return

  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch (error) {
    console.warn('Failed to clear browser caches after storage error:', error)
  }
}

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
const isRecoverableDBError = (err: any): boolean => {
  const name = err?.name ?? ''
  const innerName = err?.inner?.name ?? ''
  // DatabaseClosedError: browser closed the connection (tab backgrounded, GC, private mode)
  // UnknownError with "Internal error": browser-level IDB failure (storage pressure, Firefox/iOS quirk)
  if (name === 'DatabaseClosedError') return true
  if (name === 'UnknownError' || innerName === 'UnknownError') return true
  return false
}

export const safeDBOperation = async <T>(
  operation: (db: WorshipCloudDatabase) => Promise<T>
): Promise<T | undefined> => {
  try {
    return await operation(useIndexedDB())
  } catch (err: any) {
    if (isRecoverableDBError(err)) {
      // Reset the singleton so the next call to useIndexedDB() opens a fresh connection
      dbInstance = null
      try {
        return await operation(useIndexedDB())
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
    if (err?.name === 'QuotaExceededError') {
      await clearOldCaches()
      dbInstance = null
      try {
        return await operation(useIndexedDB())
      } catch (retryErr: any) {
        console.error('DB operation failed after storage cleanup:', retryErr)
        return undefined
      }
    }
    console.error('DB operation failed:', err)
    return undefined
  }
}

export const safeDBGet = async <T>(
  table: Table<T, any>,
  key: string | number | undefined | null
): Promise<T | undefined> => {
  if (key === undefined || key === null || key === "") {
    return undefined
  }

  const tableName = table.name
  return safeDBOperation((db) => db.table<T, any>(tableName).get(key)) as Promise<T | undefined>
}

export default useIndexedDB
