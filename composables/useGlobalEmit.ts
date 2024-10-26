import type { Emitter } from 'mitt'
import { useAppStore } from '~/store/app'
import { Hymn, Slide, Song } from '~/types'

const useGlobalEmit = (type: string, value?: string | boolean | Song | Hymn | Slide | any) => {
  const appStore = useAppStore()
  const toast = useToast()
  const emitter = (useNuxtApp().$emitter || appStore.currentState.emitter) as Emitter<any>

  try {
    emitter.emit(type, value)
  } catch (err) {
    console.log(err)
    toast.add({ title: 'An error occurred. Please reload', icon: 'i-bx-error', color: 'red' })
  }
}

export default useGlobalEmit