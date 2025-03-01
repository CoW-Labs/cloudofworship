import type { Emitter } from 'mitt'
import { useAppStore } from '~/store/app'
import { Hymn, Slide, Song } from '~/types'

const useGlobalEmit = (type: string, value?: string | boolean | Song | Hymn | Slide | any) => {
  const appStore = useAppStore()
  const toast = useToast()
  const emitter = (useNuxtApp().$emitter || appStore.currentState.emitter) as Emitter<any>

  try {
    /** If action is a newBible action replace undefined with 1 to represent a chapter/verse
     *  This is because we want a Bible slide to be opened even when the user specifies just a book or a book and chapter
     */
    if (type === appWideActions.newBible) {
      value = value?.replaceAll('undefined', 1)
    }
    emitter.emit(type, value)
  } catch (err) {
    console.log(err)
    toast.add({ title: 'An error occurred. Please reload', icon: 'i-bx-error', color: 'red' })
  }
}

export default useGlobalEmit