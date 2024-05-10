import { useAppStore } from '~/store/app'
import { Scripture } from '~/types'

const useScripture = (label: string = '1:1:1', version: string = ''): Scripture | null => {
  const nuxtApp = useNuxtApp()
  const kjvBible = nuxtApp.$kjvBible
  const nkjvBible = nuxtApp.$nkjvBible
  const nivBible = nuxtApp.$nivBible
  const ampBible = nuxtApp.$ampBible

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
        scripture = nkjvBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'NIV':
        scripture = nivBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      case 'AMP':
        scripture = ampBible?.find((scripture: any) => Number(scripture.book) === book && Number(scripture.chapter) === chapter && Number(scripture.verse) === verse).scripture
        appStore.setDefaultBibleVersion(version)
        break
      default:
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

