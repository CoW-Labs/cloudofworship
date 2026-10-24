import { translationToText } from "./songTranslation"

/**
 * Songs pasted from elsewhere often carry their English translation typed into
 * the lyrics in brackets, on the same line or on the line below:
 *
 *   Ndum bu nke Chineke (My life belongs to God)
 *
 *   Monyi Yesu Kristo N'ayɛ
 *   (Praise Jesus Christ)
 *
 * This finds those, so the form can move the English out of the lyrics and into
 * a translation. The line tests and safety rules are the ones that vetted the
 * catalogue's own bracket clean-up (handoff/bracket-translations): an English
 * song with a few echoes in brackets ("Look what the Lord has done") must never
 * read as a translation.
 */

const toSet = (list: string) => new Set(list.split("|"))

const ENGLISH_WORDS = toSet(
  "the|and|you|your|of|to|is|my|in|i|we|lord|with|his|him|for|are|on|that|be|it|he|our|from|will|have|when|this|there|who|what|me|all|so|can|let|us|was|now|never|love|heart|name|king|praise|give|come|forever|way|nothing|like|over|great|good|always|they|by|an|at|do|am|thank|thy|thee|thou|o|unto|she|her|before|every|one|life|soul|see|know|power|grace|why|how|mercy|blood|sing|song|light|world|still|could|would|just|been|has|had|more|only|which|here|lift|high|up|down|everything|nobody|somebody|because|cause|faithful|mighty|wonderful|awesome|beautiful|glorious|saviour|savior|father|spirit|holy-ghost|ghost|done|said|says|makes|made|make|take|takes|go|goes|went|walk|stand|fall|rise|hands|eyes|face|feet|wanna|gonna|everyday|day|night|morning|again|alone|other|no|not|don't|won't|can't|i'm|you're|it's|there's|i'll|we'll|you've|i've"
)

// Common words of the languages our churches sing in. They tell an English
// line from a foreign one; a line that matches none is "unknown", not English.
const LANGUAGE_WORDS: Record<string, Set<string>> = {
  es: toSet(
    "de|que|el|la|los|las|en|por|con|una|es|mi|tu|su|te|lo|del|para|dios|señor|jesús|yo|eres|soy|estás|santo|más|porque|quiero|cuando|tú|él|y|nos|se|al|como|sin|todo|siempre|nadie|amor|vida|corazón|gloria|alabanza|cristo|nombre|rey|tus|mis|hay|aquí|ti|has|ha|mí|nuestro|padre|espíritu|gracia|poder|fiel|digno|alabad|adoramos|bendito|sea"
  ),
  pt: toSet(
    "você|não|meu|minha|teu|tua|senhor|deus|és|com|uma|para|do|da|os|nós|ele|ela|em|eu|que|um|é|está|tudo|vou|seu|sua|pai|santo|nome|amor|vida|coração|glória|louvor|só|mais|quero|porque|quando|como|aqui"
  ),
  fr: toSet(
    "je|tu|le|les|des|est|dans|pour|mon|ton|seigneur|dieu|nous|vous|qui|sur|avec|jésus|il|elle|une|un|tout|mes|ma|ta|tes|ne|pas|que|ce|c'est|et|du|au|toi|moi|gloire|louange|saint|amour|nom|père"
  ),
  yo: toSet(
    "oluwa|olorun|ọlọrun|olúwa|ọlọ́run|baba|jesu|jésù|eledumare|ẹlẹ́dàá|ogo|iyin|ìyìn|eseun|ẹ̀ṣé|ese|oba|ọba|emi|èmi|mo|ṣe|se|wa|ni|ti|fun|ko|kò|mi|re|rẹ|lo|si|je|gbogbo|nitori|ayo|ayọ̀|ife|ìfẹ́|ore|agbara|olugbala|mimo|mímọ́|iwo|ìwọ|o|a|ki|kí|ninu|nínú|aye|ayé|ọkàn|okan|dupe|dúpẹ́|ope|ọpẹ́|yin|e|ẹ|tobi|tóbi|alagbara|kabiyesi|eyin|ẹyin|wọn|won|lati|láti|naa|náà"
  ),
  ig: toSet(
    "chukwu|chineke|jehova|nke|bu|bụ|anyi|anyị|gi|gị|na|ya|ihe|onye|nna|jisos|ekele|ebube|eze|dike|isi|oma|ọma|ndi|ndị|m|ka|obi|otuto|mmuo|mmụọ|ike|di|dị|nyere|nwa|ọ|o|i|ị|nile|niile|kwa|ga|aga|ukwu|eluigwe|uwa|ụwa|nmma|mma|imela|daalu|ihunanya|ịhụnanya"
  ),
  ha: toSet(
    "ubangiji|yesu|ka|na|ya|mai|allah|kai|ni|zan|ina|domin|sarki|ne|ce|da|wa|ga|kuma|yabo|girma|ikon|ƙauna|rai|mu|muna|godiya|alheri|uba|sunan|kana|babu|kamar"
  ),
  sw: toSet(
    "bwana|mungu|yesu|wewe|mimi|ni|na|kwa|sana|wa|ya|upendo|tunakusifu|asante|baba|nguvu|mfalme|wako|wangu|yako|moyo|utukufu|sifa|ndiye|hakuna|kama|tu|sisi|wote|milele|mtakatifu|nakupenda|nitakusifu|roho|jina|ee|nimeona|umenitendea"
  ),
  tl: toSet(
    "ang|ng|mga|sa|ako|ikaw|aking|iyong|panginoon|diyos|mo|ka|po|ay|na|ko|ito|siya|at|aming|walang|higit|ka'y|ika'y|kay|pag|ibig|pagsamba|purihin|banal|hesus|ginoo|ug|nga|imong|kanimo"
  ),
  id: toSet(
    "yang|dan|di|ku|mu|tuhan|yesus|dengan|untuk|ini|aku|kau|engkau|kasih|allah|ada|tidak|dalam|kepada|oleh|nya|bagi|kami|kita|mulia|hatiku|hidupku|bapa|kudus|terpuji|sembah|puji|nama|selamanya|setia"
  ),
  tw: toSet(
    "nyame|onyame|awurade|yesu|aseda|wo|ye|yɛ|na|ne|me|mo|adom|ɔ|ɛ|ɔdɔ|ayeyi|nhyira|ahenfo|ɔhene|w'ase|dawurome"
  ),
  lg: toSet(
    "yesu|mukama|katonda|nkwagala|ggwe|nze|era|nnyo|mu|ku|lya|ye|tu|olw'|okwagala|tukutendereza|kitaffe|ddala|bulijjo"
  ),
  zu: toSet(
    "nkosi|yesu|ngiyabonga|uyingcwele|baba|wena|mina|siyabonga|thixo|nkulunkulu|ngiyakuthanda|siyakudumisa|uyinkosi|wami|yami|ngoba"
  ),
  sn: toSet(
    "mwari|ishe|jesu|tinokurumbidzai|makanaka|baba|imi|ndimi|zvose|kwazvo|rudo|mweya|tenda|ndinokudai"
  ),
}

// Sung the same in every language, so they say nothing about which one a line is.
const NEUTRAL_WORDS = toSet(
  "hallelujah|halleluyah|halleluya|alleluia|aleluya|aleluia|amen|hosanna|hossana|jesus|yesu|jesu|holy|glory|gloria|oh|ooh|oo|o|yeah|eh|ehh|ah|aah|ay|hey|yahweh|jehovah|elohim|adonai|emmanuel|immanuel|worthy|abba|yeshua|messiah|shalom|na|la|da|mm|mmm|hmm|x2|x3|x4|2x|3x|4x|repeat|chorus|verse|bridge"
)

// Each word's languages, so a line is read in one pass rather than once per
// language. A word English shares counts for English only.
const LANGUAGES_OF = new Map<string, string[]>()
for (const [key, set] of Object.entries(LANGUAGE_WORDS)) {
  for (const word of set) {
    if (ENGLISH_WORDS.has(word)) continue
    LANGUAGES_OF.set(word, [...(LANGUAGES_OF.get(word) || []), key])
  }
}

// The form scans the lyrics again whenever they change, and a line is read by
// several of the tests below, so what a line says is remembered by its text.
// Cleared rather than grown without bound across a long session of typing.
const MAX_REMEMBERED = 5000
const remembered = <T>(read: (text: string) => T) => {
  const seen = new Map<string, T>()
  return (text: string): T => {
    if (seen.has(text)) return seen.get(text)!
    if (seen.size >= MAX_REMEMBERED) seen.clear()
    const value = read(text)
    seen.set(text, value)
    return value
  }
}

const wordsOf = remembered((text: string) =>
  (text.toLowerCase().normalize("NFC").match(/[\p{L}\p{M}']+/gu) || [])
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
)

/** "en", a language key of LANGUAGE_WORDS, "x" (not English, language unknown) or "?" (can't tell). */
const labelText = remembered((text: string) => {
  const words = wordsOf(text).filter((word) => !NEUTRAL_WORDS.has(word))
  if (words.length < 2) return "?"
  const english = words.filter((word) => ENGLISH_WORDS.has(word)).length
  const hitsByLanguage = new Map<string, number>()
  for (const word of words) {
    for (const key of LANGUAGES_OF.get(word) || []) {
      hitsByLanguage.set(key, (hitsByLanguage.get(key) || 0) + 1)
    }
  }
  // In LANGUAGE_WORDS order, so a tie goes to the same language as before.
  let best = ""
  let bestHits = 0
  for (const key of Object.keys(LANGUAGE_WORDS)) {
    const hits = hitsByLanguage.get(key) || 0
    if (hits > bestHits) {
      bestHits = hits
      best = key
    }
  }
  const total = words.length
  if (english / total >= 0.3 && english > bestHits) return "en"
  if (bestHits / total >= 0.3 && bestHits > english) return best
  if (english === 0 && total >= 4) return "x"
  if (english === 0 && bestHits >= 1 && total >= 2) return best
  return "?"
})

// A line that is only a bracket is a section label ("[Chorus]", "(x2)") unless
// it holds English words.
const SECTION_WORD =
  /^(pre-?chorus|chorus|verse|bridge|intro|outro|refrain|interlude|instrumental|solo|tag|vamp|hook|ending|turnaround|repeat|coro|estribillo|verso|puente|part|call|response|spoken|x?\d+x?|\d+x)\b/i
const isSectionLine = (line: string) => {
  const bracketed = line.match(/^[\[(]\s*([^\])]*?)\s*[\])]\s*:?$/)
  if (bracketed && SECTION_WORD.test(bracketed[1]!.trim())) return true
  return /^(pre-?chorus|chorus|verse|bridge|intro|outro|refrain|tag|vamp|coro|estribillo)\s*\d*\s*:?$/i.test(
    line
  )
}

// A translator's remark in brackets ("[Unclear in the spelling provided]") is
// not a translation.
const NOTE = /^\s*(unclear|unknown|unsure|not sure|illegible|inaudible|note\b|\?+\s*$)/i

const isEnglishText = (text: string) => {
  if (NOTE.test(text)) return false
  const words = wordsOf(text).filter((word) => !NEUTRAL_WORDS.has(word))
  if (words.length >= 2) return labelText(text) === "en"
  return words.length === 1 && ENGLISH_WORDS.has(words[0]!) && words[0]!.length > 3
}

// Any letter outside A-Z (ị, ụ, ɛ, é, ñ...). English doesn't use them, and a
// short line like "I nweghị atụ" reads as English by its words alone ("I").
const hasNonEnglishLetters = (text: string) =>
  /(?![\x00-\x7F])\p{L}/u.test(text.normalize("NFC"))

const isForeignText = (text: string) => {
  const words = wordsOf(text).filter((word) => !NEUTRAL_WORDS.has(word))
  return (
    words.length >= 2 &&
    (labelText(text) !== "en" || hasNonEnglishLetters(text))
  )
}

// Without a positive sign of another language, an English line with an echo
// ("Alright y'all" / "(Look what the Lord has done)") would read as a translation.
const showsForeign = (text: string) => {
  const label = labelText(text)
  return (label !== "en" && label !== "?") || hasNonEnglishLetters(text)
}

// A line that is only a bracket, and any bracket group inside a line.
const WHOLE_BRACKET = /^[(\[]\s*([^()\[\]]{2,})\s*[)\]][.,!;:]*$/
const BRACKET_GROUP = /[(\[]\s*([^()\[\]]{2,}?)\s*[)\]]/g

// A name or short phrase with no English word in it ("Jehovah Rapha",
// "El Eylon") that the word lists can't place in any language. Only believed
// when English is bracketed after it, and never when every word is a neutral
// one ("Ooh yeah (sing it)").
const isNameLike = (text: string) => {
  const words = wordsOf(text)
  return (
    words.length >= 1 &&
    words.length <= 4 &&
    !words.some((word) => ENGLISH_WORDS.has(word)) &&
    words.some((word) => !NEUTRAL_WORDS.has(word))
  )
}

// A short bracketed phrase the word lists can't place ("God Almighty"). Taken
// as a meaning only after a name-like phrase, never after a foreign sentence,
// where it could just as well be another language.
const looksLikeMeaning = (text: string) => {
  const words = wordsOf(text).filter((word) => !NEUTRAL_WORDS.has(word))
  return (
    isEnglishText(text) ||
    (words.length >= 2 &&
      words.length <= 6 &&
      !hasNonEnglishLetters(text) &&
      labelText(text) === "?")
  )
}

// A line with the brackets `accepts` takes cut out of it, and what they held:
// "Elshaddai (God Almighty), El" → "Elshaddai, El" and ["God Almighty"].
// Other brackets, like "(x2)", stay.
const pullGlosses = (text: string, accepts: (inner: string) => boolean) => {
  const glosses: string[] = []
  const stripped = text.replace(BRACKET_GROUP, (group, inner: string) => {
    if (!accepts(inner)) return group
    glosses.push(inner.trim())
    return ""
  })
  const base = stripped
    .replace(/\s+([,.;:!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
  return { base, glosses }
}

const similarity = (a: string, b: string) => {
  const left = new Set(wordsOf(a))
  const right = new Set(wordsOf(b))
  if (!left.size || !right.size) return 0
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / (left.size + right.size - shared)
}

const sameText = (text: string) => wordsOf(text).join(" ")

const MAX_GLOSS_LENGTH = 500
const MIN_GLOSSED_LINES = 3

interface Gloss {
  row: number // the foreign line's row in the lyrics
  gloss: string
  nextRow?: number // the row holding the gloss, when it sits below the line
  base: string // the line without its same-line English brackets
}

export interface BracketTranslation {
  /** The lyrics with the bracketed English taken out. */
  lyrics: string
  /** The English, one line per sung line, as the translation box takes it. */
  text: string
  /** How many lines carried a translation. */
  glossed: number
}

/**
 * The English translation written into a song's lyrics in brackets, and the
 * lyrics without it. Null unless the song clearly is one: most of its
 * non-English lines are glossed, each gloss is English and not an echo of its
 * own line, and there are enough of them to rule out a stray parenthesis.
 */
export const extractBracketTranslation = (
  lyrics: string
): BracketTranslation | null => {
  if (!/[(\[]/.test(lyrics || "")) return null

  const rows = lyrics.split(/\r?\n/)
  const trimmed = rows.map((row) => row.trim())
  const nextFilled = (from: number) => {
    for (let i = from + 1; i < trimmed.length; i++) if (trimmed[i]) return i
    return -1
  }

  let foreignLines = 0
  let glossedLines = 0
  let positiveLines = 0
  const candidates: Gloss[] = []
  // Glossed lines that read as English by their words ("I ma m [I know]"). Only
  // believed inside a song that is clearly not English.
  const codeSwitched: Gloss[] = []

  trimmed.forEach((text, row) => {
    if (!text || isSectionLine(text) || WHOLE_BRACKET.test(text)) return
    // English brackets on the line itself, one or several ("Elshaddai (God
    // Almighty), El Eylon (God Most High)"). Other brackets, like "(x2)", stay.
    const strict = pullGlosses(text, isEnglishText)
    const loose = pullGlosses(text, looksLikeMeaning)
    const looseName = loose.glosses.length > 0 && isNameLike(loose.base)
    const { base, glosses } = looseName ? loose : strict
    const sameGloss = glosses.join(", ")

    const nextRow = nextFilled(row)
    const below = nextRow >= 0 ? trimmed[nextRow]!.match(WHOLE_BRACKET) : null
    const nextAccepts = isNameLike(base) ? looksLikeMeaning : isEnglishText
    const nextGloss =
      below && nextAccepts(below[1]!) && !isSectionLine(trimmed[nextRow]!)
        ? below[1]!.trim()
        : ""

    const plainForeign = isForeignText(base)
    // A name with its meaning after it is a gloss, not a foreign sentence;
    // unglossed, it's just a line, and must not drag the share down.
    const nameGlossed =
      (looseName || (!plainForeign && (sameGloss || nextGloss))) &&
      isNameLike(base)
    if (!plainForeign && !nameGlossed) {
      if ((sameGloss || nextGloss) && !(sameGloss && nextGloss)) {
        const gloss = sameGloss || nextGloss
        if (
          wordsOf(base).length <= 8 &&
          similarity(base, gloss) < 0.3 &&
          gloss.length <= MAX_GLOSS_LENGTH
        ) {
          codeSwitched.push({
            row,
            gloss,
            nextRow: sameGloss ? undefined : nextRow,
            base,
          })
        }
      }
      return
    }
    foreignLines++
    if (!sameGloss && !nextGloss) return

    glossedLines++
    const foreign = nameGlossed || showsForeign(base)
    if (foreign) positiveLines++
    // One gloss per line: a bracket on the line and another under it is a
    // two-wording mess to sort out by hand.
    if (sameGloss && nextGloss) return
    const gloss = sameGloss || nextGloss
    if (!foreign || similarity(base, gloss) >= 0.5) return
    if (gloss.length > MAX_GLOSS_LENGTH) return
    candidates.push({
      row,
      gloss,
      nextRow: sameGloss ? undefined : nextRow,
      base,
    })
  })

  // The same English under three different lines is a refrain ("Praise the
  // Lord"), not a translation of any of them. Spelling variants of one line
  // ("Dansaki re" / "Dansaki re o") are one line.
  const withoutRefrains = (list: Gloss[]) => {
    const basesByGloss = new Map<string, string[]>()
    for (const { gloss, base } of list) {
      const key = sameText(gloss)
      const distinct = basesByGloss.get(key) || []
      if (!distinct.some((other) => similarity(other, base) >= 0.5)) {
        distinct.push(base)
      }
      basesByGloss.set(key, distinct)
    }
    return list.filter(
      ({ gloss }) => basesByGloss.get(sameText(gloss))!.length < 3
    )
  }
  const accepted = withoutRefrains(candidates)

  const share = foreignLines ? glossedLines / foreignLines : 0
  const fullyGlossed = glossedLines >= MIN_GLOSSED_LINES && share >= 0.7
  const looksForeign = glossedLines && positiveLines / glossedLines >= 0.6
  const enough =
    accepted.length >= MIN_GLOSSED_LINES &&
    accepted.length >= glossedLines * 0.6
  if (!(fullyGlossed || looksForeign) || !enough) return null

  // Songs that are plainly not English: the odd line of English-looking words
  // inside is a line of the song too, so its bracket is its translation.
  const plainlyForeign = positiveLines / glossedLines >= 0.8
  const usable =
    plainlyForeign && codeSwitched.length
      ? withoutRefrains([...candidates, ...codeSwitched])
      : accepted

  const byRow = new Map(usable.map((entry) => [entry.row, entry]))
  const removed = new Set(
    usable.flatMap((entry) =>
      entry.nextRow === undefined ? [] : [entry.nextRow]
    )
  )
  const cleanRows: string[] = []
  const glosses: string[] = []
  rows.forEach((row, index) => {
    if (removed.has(index)) return
    const entry = byRow.get(index)
    cleanRows.push(entry && entry.nextRow === undefined ? entry.base : row)
    glosses.push(entry?.gloss || "")
  })

  const cleanLyrics = cleanRows.join("\n")
  return {
    lyrics: cleanLyrics,
    text: translationToText(cleanLyrics, glosses),
    glossed: usable.length,
  }
}
