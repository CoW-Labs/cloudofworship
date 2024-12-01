import { useAppStore } from '~/store/app'
import type { BibleVerse, Scripture } from '~/types'

const useScriptureChapter = async (label: string = '1:1', version: string = ''): Promise<Scripture | null> => {
  const db = useIndexedDB()

  // set default version
  const appStore = useAppStore()
  version = version || appStore.currentState.settings.defaultBibleVersion

  const toast = useToast()

  label = useScriptureLabel(label)
  const shortLabelSplitted = label.split(':')
  const book = Number(shortLabelSplitted?.[0] || "1")
  const chapter = Number(shortLabelSplitted?.[1] || "1")
  let verses = []

  try {
    async function fetchVerses(version: string, db: any, book: number, chapter: number): Promise<any[]> {
      const bibleData = (await db.bibleAndHymns.get(version))?.data as unknown as BibleVerse[];
      return bibleData?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter);
    }

    switch (version) {
      case 'NKJV':
      case 'NIV':
      case 'AMP':
      case 'NLT':
      case 'CEV':
      case 'YLT':
      case 'ASV':
      case 'MSG':
      case 'WEB':
      case 'NASB':
      case 'TPT':
      case 'ESV':
        verses = await fetchVerses(version, db, book, chapter) as any[];
        appStore.setDefaultBibleVersion(version);
        break;
      default:
        verses = await fetchVerses('KJV', db, book, chapter) as any[];
        appStore.setDefaultBibleVersion('KJV');
        break;
    }

    return {
      label: `${bibleBooks?.[Number(book) - 1]} ${chapter}`,
      content: verses,
      version,
      labelShortFormat: label
    }
  } catch (err) {
    // console.log(err)
    toast.add({ title: 'Scripture not found', icon: 'i-bx-error', color: 'red' })
  }

  return null
}

export default useScriptureChapter

