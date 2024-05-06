import { useAppStore } from '~/store/app'
import { Scripture } from '~/types'

const useScriptureChapter = (label: string = '1:1', version: string = ''): Scripture | null => {
  const nuxtApp = useNuxtApp()
  const kjvBible = nuxtApp.$kjvBible
  const nkjvBible = nuxtApp.$nkjvBible
  const nivBible = nuxtApp.$nivBible
  const ampBible = nuxtApp.$ampBible

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
        verses = nkjvBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      case 'NIV':
        verses = nivBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      case 'AMP':
        verses = ampBible?.filter((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter)
        appStore.setDefaultBibleVersion(version)
        break
      default:
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

