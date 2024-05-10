function useAbbrScriptureLabel(label: string) {
  let book = label?.slice(0, label?.lastIndexOf(' '))
  book = book.slice(0, 4)
  const bibleChapterAndVerse = label?.slice(label?.lastIndexOf(' ') + 1)
  return `${book}:${bibleChapterAndVerse}`
}

export default useAbbrScriptureLabel

