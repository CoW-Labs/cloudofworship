import { useAppStore } from '~/store/app'
import { BibleVerse, Scripture } from '~/types'

const useScripture = async (label: string = '1:1:1', version: string = ''): Promise<Scripture | null> => {
  const db = useIndexedDB()

  // set default version
  const appStore = useAppStore()
  version = version || appStore.settings.defaultBibleVersion

  const toast = useToast()

  const shortLabelSplitted = label.split(':')
  const book = Number(shortLabelSplitted?.[0] || "1")
  const chapter = Number(shortLabelSplitted?.[1] || "1")
  const verse = Number(shortLabelSplitted?.[2] || "1")
  let scripture = ''

  try {
    switch (version) {
      case 'NKJV':
        const nkjvBible = (await db.bibleAndHymns.get('NKJV'))?.data as unknown as BibleVerse[]
        scripture = nkjvBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'NIV':
        const nivBible = (await db.bibleAndHymns.get('NIV'))?.data as unknown as BibleVerse[]
        scripture = nivBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'AMP':
        const ampBible = (await db.bibleAndHymns.get('AMP'))?.data as unknown as BibleVerse[]
        scripture = ampBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'NLT':
        const nltBible = (await db.bibleAndHymns.get('NLT'))?.data as unknown as BibleVerse[]
        scripture = nltBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'CEV':
        const cevBible = (await db.bibleAndHymns.get('CEV'))?.data as unknown as BibleVerse[]
        scripture = cevBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      default:
        const kjvBible = (await db.bibleAndHymns.get('KJV'))?.data as unknown as BibleVerse[]
        scripture = kjvBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
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

