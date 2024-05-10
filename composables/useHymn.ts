import { Hymn } from '~/types'

const useHymn = (number: string): Hymn | null => {
  const nuxtApp = useNuxtApp()
  const hymns = nuxtApp.$hymns as Array<Hymn>
  const toast = useToast()

  try {
    const hymn = hymns.find(hymn => hymn.number === number) as Hymn
    return hymn
  } catch (err) {
    toast.add({ title: 'Hymn not found', icon: 'i-bx-error', color: 'red' })
  }
  return null
}

export default useHymn

