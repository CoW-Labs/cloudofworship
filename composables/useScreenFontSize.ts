const useScreenFontSize = (content: string, fontSizePercent: number = 100) => {
  // if (content.length <= 150) {
  //   fontSize = 5
  // } else if (content.length < 200) {
  //   fontSize = 4.7
  // } else if (content.length < 250) {
  //   fontSize = 4.4
  // } else if (content.length < 300) {
  //   fontSize = 4.1
  // } else if (content.length < 350) {
  //   fontSize = 3.8
  // } else if (content.length < 400) {
  //   fontSize = 3.5
  // } else if (content.length < 450) {
  //   fontSize = 3.1
  // } else {
  //   fontSize = 2.8
  // }

  /**
   * Using interpolation to estimate font size
   * where 525 is the highest content length and 4.8vw is the corresponding font size
   * and 125 is the lowest content length and 2.8vw is the corresponding font size
   */
  let contentLength = content?.length
  const regex = /\n/g
  let newLineCharacters =
    [...content.matchAll(regex)]?.length
  contentLength += (newLineCharacters * 25)
  const fontSize = 4.9 + (contentLength - 125) * (2.8 - 5) / (525 - 125)
  let percentageIncrease = fontSizePercent / 100

  // console.log(fontSize.toFixed(2))
  // console.log((fontSize * percentageIncrease).toFixed(2))

  return (fontSize * percentageIncrease).toFixed(2)
}

export default useScreenFontSize;