import { useAppStore } from "~/store/app"
import type { BibleVersion } from "~/types"

/**
 * Composable for managing Bible versions.
 * BibleVersionSettings.vue is the source of truth for download/populate logic.
 * All other components (SlideSettings, BibleVersionSelect, app.vue) consume from here.
 */
export const useBibleVersionManager = () => {
  const appStore = useAppStore()
  const { currentState } = storeToRefs(appStore)
  const db = useIndexedDB()

  const downloadProgress = ref<string>("0")
  const bibleVersionLoading = ref<string | false>(false)

  /**
   * Check whether a given Bible version ID has been downloaded to IndexedDB.
   */
  const isBibleVersionDownloaded = async (bibleVersionId: string): Promise<boolean> => {
    return (await db.bibleAndHymns.where("id").equals(bibleVersionId).count()) > 0
  }

  /**
   * Populate / refresh the `bibleVersions` array in the store with correct
   * `isDownloaded` flags checked against IndexedDB.
   *
   * Pass an optional `sourceBibleVersions` array (e.g. from the API response
   * in `app.vue`) to override the store's list as the source of truth.
   */
  const populateBibleVersionOptions = async (sourceBibleVersions?: BibleVersion[]) => {
    const tempBibleVersions: BibleVersion[] = sourceBibleVersions?.length
      ? sourceBibleVersions.map((v) => ({ ...v }))
      : currentState.value.settings.bibleVersions.map((v) => ({ ...v }))

    for (const bibleVersion of tempBibleVersions) {
      bibleVersion.isDownloaded = await isBibleVersionDownloaded(bibleVersion.id)
    }
    appStore.setBibleVersions(tempBibleVersions)
  }

  /**
   * Download a Bible version by ID, store it in IndexedDB, and refresh the list.
   */
  const downloadBibleVersion = async (bibleVersionId: string) => {
    const tempBibleVersionRecord = (version: string, data: any) => ({
      id: version,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    bibleVersionLoading.value = bibleVersionId
    try {
      let bibleResponse = await useDetailedFetch(
        `https://d37gopmfkl2m2z.cloudfront.net/open/bible-versions/${bibleVersionId.toLowerCase()}.json`,
        downloadProgress
      )
      bibleResponse = await bibleResponse.json()
      await db.bibleAndHymns.add(tempBibleVersionRecord(bibleVersionId, bibleResponse))
    } finally {
      bibleVersionLoading.value = false
      await populateBibleVersionOptions()
    }
  }

  /**
   * All available Bible versions with their current `isDownloaded` state
   * (driven by the store — already kept in sync via `populateBibleVersionOptions`).
   */
  const bibleVersionOptions = computed<BibleVersion[]>(() =>
    currentState.value.settings.bibleVersions
  )

  /**
   * Select-menu options: only downloaded versions + a "+ More Versions" sentinel
   * appended when at least one version is not yet downloaded.
   */
  const bibleVersionSelectOptions = computed<string[]>(() => {
    const downloaded = bibleVersionOptions.value.filter((v) => v.isDownloaded).map((v) => v.id)
    const hasUndownloaded = bibleVersionOptions.value.some((v) => !v.isDownloaded)
    return hasUndownloaded ? [...downloaded, "+ More Versions"] : downloaded
  })

  return {
    /** Raw list of all Bible versions with isDownloaded flags */
    bibleVersionOptions,
    /** Filtered + formatted list ready for USelectMenu */
    bibleVersionSelectOptions,
    /** Download progress percentage string (for UProgress) */
    downloadProgress,
    /** ID of the version currently being downloaded, or false */
    bibleVersionLoading,
    /** Check whether a version is already in IndexedDB */
    isBibleVersionDownloaded,
    /** Refresh isDownloaded flags and commit to store */
    populateBibleVersionOptions,
    /** Download a version from CDN, save to IndexedDB, refresh store */
    downloadBibleVersion,
  }
}
