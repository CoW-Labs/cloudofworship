import { useAppStore } from "~/store/app"
import type { Hymn, Scripture, Slide, Song } from "~/types/index"

const useSlideContent = (slide: Slide, data: Scripture | Hymn | Song, size: string, nextVerse: string = '') => {
  const appStore = useAppStore()

  // Remove unwanted sequences from string
  nextVerse = nextVerse?.replaceAll('[Refrain]', '')

  switch (slide?.type) {
    case slideTypes.bible:
      data = data as Scripture
      return [
        `<p class="scripture-content" style="font-size: ${size}vw">${data?.content}</>`,
        `<p class="scripture-label"><b>${data?.label}</b> • ${data?.version}</p>
        <p class="copyright-content">${appStore.copyrightContent[data?.version]}</p>`,
      ]
    case slideTypes.hymn:
      data = data as Hymn
      return [
        `<p class="song-content" style="font-size: ${size}vw">${nextVerse?.replaceAll("\n", "<br>")}</>`,
        `<p class="song-label"><b>${data?.title}</b> • HYMN</p>
        <p class="copyright-content">${data?.source?.replace('undefined -', '').trim()}</p>`,
      ]
    case slideTypes.song:
      data = data as Song
      return [
        `<p class="song-content" style="font-size: ${size}vw">${nextVerse?.replaceAll("\n", '<br class="mt-3">')}</>`,
        `<p class="song-label"><b>${data?.title}</b> • ${data.artist}</p>`,
      ]
  }

  return ["", ""]
}

export default useSlideContent