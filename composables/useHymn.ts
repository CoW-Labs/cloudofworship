import type { Hymn } from '~/types'

const useHymn = async (number: string): Promise<Hymn | null> => {
  const db = useIndexedDB()
  let hymns: any = await db.bibleAndHymns.get('hymns')
  hymns = hymns?.data as unknown as Hymn[]
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

