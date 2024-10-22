import { useAppStore } from '~/store/app'
import { BibleVerse, Scripture } from '~/types'

const useScripture = async (label: string = '1:1:1', version: string = ''): Promise<Scripture | null> => {
  const db = useIndexedDB()

  // set default version
  const appStore = useAppStore()
  version = version || appStore.currentState.settings.defaultBibleVersion

  const toast = useToast()

  const shortLabelSplitted = label.split(':')
  const book = Number(shortLabelSplitted?.[0] || "1")
  const chapter = Number(shortLabelSplitted?.[1] || "1")
  const verse = Number(shortLabelSplitted?.[2] || "1")
  let scripture = ''

  try {
    async function fetchScripture(version: string, db: any, book: number, chapter: number, verse: number): Promise<string | undefined> {
      const bibleData = (await db.bibleAndHymns.get(version))?.data as unknown as BibleVerse[];
      return bibleData?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse)?.scripture;
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
        scripture = await fetchScripture(version, db, book, chapter, verse) as string;
        appStore.setDefaultBibleVersion(version);
        break;
      default:
        scripture = await fetchScripture('KJV', db, book, chapter, verse) as string;
        appStore.setDefaultBibleVersion('KJV');
        break;
    }
    if (!scripture) {
      throw new Error('Scripture not found')
    }

    return {
      label: `${bibleBooks?.[Number(book) - 1]} ${chapter}:${verse}`,
      content: scripture,
      version,
      labelShortFormat: label
    }
  } catch (err) {
    // console.log(err)
    toast.add({ title: 'Scripture not found', icon: 'i-bx-error', color: 'red' })
  }

  return null
}

export default useScripture

