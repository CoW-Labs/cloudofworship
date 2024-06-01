import { useAppStore } from '~/store/app'
import type { BibleVerse, Scripture } from '~/types'

const useScriptureChapter = async (label: string = '1:1', version: string = ''): Promise<Scripture | null> => {
  const db = useIndexedDB()

  // set default version
  const appStore = useAppStore()
  version = version || appStore.settings.defaultBibleVersion

  const toast = useToast()

  label = useScriptureLabel(label)
  const shortLabelSplitted = label.split(':')
  const book = Number(shortLabelSplitted?.[0] || "1")
  const chapter = Number(shortLabelSplitted?.[1] || "1")
  let verses = []

  try {
    switch (version) {
      case 'NKJV':
        const nkjvBible = (await db.bibleAndHymns.get('NKJV'))?.data as unknown as BibleVerse[]
        verses = nkjvBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      case 'NIV':
        const nivBible = (await db.bibleAndHymns.get('NIV'))?.data as unknown as BibleVerse[]
        verses = nivBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      case 'AMP':
        const ampBible = (await db.bibleAndHymns.get('AMP'))?.data as unknown as BibleVerse[]
        verses = ampBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      default:
        const kjvBible = (await db.bibleAndHymns.get('KJV'))?.data as unknown as BibleVerse[]
        verses = kjvBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
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

