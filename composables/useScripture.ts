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
  const verse = shortLabelSplitted?.[2]?.includes('-') ? shortLabelSplitted?.[2] : Number(shortLabelSplitted?.[2])
  const verses = []

  // If verse contains hyphen
  if (verse.toString().includes('-')) {
    const verseSplitted = verse.toString().split('-')
    const verseStart = Number(verseSplitted?.[0] || "1")
    const verseEnd = Number(verseSplitted?.[1] || "1")

    for (let i = verseStart; i <= verseEnd; i++) {
      verses.push(i)
    }
  } else {
    verses.push(verse)
  }

  let scripture = ''

  try {
    async function fetchScripture(version: string, db: any, book: number, chapter: number, verses: number[]): Promise<string | undefined> {
      const bibleData = (await db.bibleAndHymns.get(version))?.data as unknown as BibleVerse[];
      
      // Since verses are sequential, we can optimize by finding start index
      const startIndex = bibleData?.findIndex((scripture: any) => 
        Number(scripture.book) === book && 
        Number(scripture.chapter) === chapter && 
        Number(scripture.verse) === verses[0]
      );

      if (startIndex === -1) return undefined;

      // Get all verses in sequence and join them
      return bibleData
        ?.slice(startIndex, startIndex + verses.length)
        .map(scripture => scripture.scripture)
        .join(' ');
    }
    // console.log('verse', verse)
    // console.log('verses', verses)

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
        scripture = await fetchScripture(version, db, book, chapter, verses) as string;
        appStore.setDefaultBibleVersion(version);
        break;
      default:
        scripture = await fetchScripture('KJV', db, book, chapter, verses) as string;
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
    console.log(err)
    toast.add({ title: 'Scripture not found', icon: 'i-bx-error', color: 'red' })
  }

  return null
}

export default useScripture

