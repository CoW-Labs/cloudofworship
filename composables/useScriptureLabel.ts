/**
 * Function to return scripture in format (book:chapter:verse) from format like (Book chapter:verse) and vice versa
 * @param label 
 * @returns 
 */
function useScriptureLabel(label: string, options?: { toLongForm: boolean }) {
  if (options?.toLongForm) {
    const book = Number(label?.split(':')?.[0])

    const bibleChapterAndVerse = label?.slice(label?.indexOf(':') + 1)
    return `${bibleBooks[book - 1]} ${bibleChapterAndVerse}`
  } else {

    const book = label?.slice(0, label?.lastIndexOf(' '))
    const bookIndex = bibleBooks.findIndex(bibleBook => bibleBook.toLowerCase() === book.toLowerCase()) + 1
    const bibleChapterAndVerse = label?.slice(label?.lastIndexOf(' ') + 1)
    return `${bookIndex}:${bibleChapterAndVerse}`
  }
}

export default useScriptureLabel

