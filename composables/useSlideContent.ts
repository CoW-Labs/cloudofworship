import { useAppStore } from "~/store/app"
import type { Countdown, Hymn, Scripture, Slide, Song } from "~/types/index"

/**
 * 
 * @param slide 
 * @param data 
 * @param nextVerse 
 * @returns an array of Strings representing content/text box for each slide
 */
const useSlideContent = (slide: Slide, data: Scripture | Hymn | Song | Countdown, nextVerse: string = '') => {
  const appStore = useAppStore()

  // Remove unwanted sequences from string
  nextVerse = nextVerse?.replaceAll('[Refrain]', '')

  switch (slide?.type) {
    case slideTypes.bible:
      data = data as Scripture
      if (appStore.currentState.settings.footnotes) {
        return [
        `<p class="scripture-content">${data?.content}</>`,
        `<p class="scripture-label"><b>${data?.label}</b> • ${data?.version}</p>
        <p class="copyright-content">${appStore.currentState.settings.bibleVersions?.find(version => version.id === data?.version)?.copyrightContent}</p>`
        ]
      }
      return [
          `<p class="scripture-content">${data?.content}</>`,
          `<p class="scripture-label"><b>${data?.label}</b> • ${data?.version}</p>`,
      ]
    case slideTypes.hymn:
      data = data as Hymn
      return [
        `<p class="song-content">${nextVerse?.replaceAll("\n", "<br>")}</>`,
        `<p class="song-label"><b>${data?.title}</b> • HYMN</p>
        <p class="copyright-content">${data?.source?.replace('undefined -', '').trim()}</p>`,
      ]
    case slideTypes.song:
      data = data as Song
      return [
        `<p class="song-content">${nextVerse?.replaceAll("\n", '<br class="mt-3">')}</>`,
        `<p class="song-label"><b>${data?.title}</b> • ${data.artist}</p>`,
      ]
    case slideTypes.countdown:
      data = data as Countdown
      return [
        '',
        `<p class="countdown-label" style="line-height: 0;">${data?.content}</p>`,
        `<p class="countdown-content opacity-75 leading-[1]">${data?.timeLeft?.replace('00:', '')}</>`,
      ]
  }

  return ["", ""]
}

export default useSlideContent