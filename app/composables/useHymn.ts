import type { Hymn } from '~/types'
import { safeDBGet } from './useIndexedDB'

const useHymn = async (number: string): Promise<Hymn | null> => {
  const db = useIndexedDB()
  let hymns: any = await safeDBGet(db.bibleAndHymns, 'hymns')
  hymns = hymns?.data as unknown as Hymn[]
  const toast = useToast()

  try {
    const hymn = hymns.find((hymn: Hymn) => hymn.number === number) as Hymn
    return hymn
  } catch (err) {
    toast.add({ title: 'Hymn not found', icon: 'i-bx-error', color: 'red' })
  }
  return null
}

export default useHymn

export const splitVerseByLines = (text: string, linesPerSlide?: number | string): string[] => {
  if (!text) return ['']
  const n = Number(linesPerSlide)
  const lines = text.split('\n').filter(l => l?.trim() !== '')
  if (!n || n < 1 || n >= lines.length) {
    return [text]
  }
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += n) {
    chunks.push(lines.slice(i, i + n).join('\n'))
  }
  return chunks
}
