import type { Slide, Song, SongSetlistData, SongTranslation } from "~/types"

/** The song a song or setlist slide is showing right now. */
export const songOnSlide = (slide?: Slide | null): Song | null => {
  if (slide?.type === slideTypes.song) return (slide.data as Song) || null
  if (slide?.type === slideTypes.songSetlist) {
    const data = slide.data as SongSetlistData | undefined
    return data?.songs?.[data.activeSongIndex || 0]?.song || null
  }
  return null
}

/**
 * The translation to show for a song: the first one with any translated line,
 * preferring one nobody has flagged for review. Null when there is none.
 */
export const getSongTranslation = (
  song?: Song | null
): SongTranslation | null => {
  const usable = (song?.translations || []).filter((t) =>
    t.lines?.some((line) => line?.trim())
  )
  return usable.find((t) => t.status === "ok") || usable[0] || null
}

/**
 * Key a lyric line the way it reaches the slide. useSong cleans each line and
 * useSlideContent drops "[Refrain]", so the raw lyric and the rendered line
 * only match after the same clean-up.
 */
const lineKey = (line = "") =>
  line
    .replaceAll("â", "'")
    .replaceAll("solo: ", "")
    .replaceAll(" ??? ", "")
    .replaceAll(" ?? ", "")
    .replaceAll("[force-verse-break]", "")
    .replaceAll("[Refrain]", "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/**
 * Lyric line → its translation. `translation.lines[i]` translates lyric line
 * `i`, so a line is looked up by its text: a slide only stores the verse it
 * shows, not where that verse sits in the song. Repeated lines (a chorus) keep
 * the first translation they had.
 */
export const buildTranslationLookup = (
  song: Song,
  translation: SongTranslation
) => {
  const lookup = new Map<string, string>()
  const lyricLines = (song.lyrics || "").split(/\r?\n/)
  lyricLines.forEach((line, i) => {
    const key = lineKey(line)
    const translated = translation.lines[i]?.trim()
    if (key && translated && !lookup.has(key)) lookup.set(key, translated)
  })
  return lookup
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Put each lyric line's translation underneath it, inside every
 * `.song-content` paragraph of a slide's content HTML.
 */
export const withSongTranslation = (
  html: string,
  lookup: Map<string, string>
) => {
  if (!html || !lookup.size || typeof document === "undefined") return html

  const container = document.createElement("div")
  container.innerHTML = html
  const scratch = document.createElement("div")

  container.querySelectorAll(".song-content").forEach((paragraph) => {
    const lines = paragraph.innerHTML.split(/<br[^>]*>/i)
    paragraph.innerHTML = lines
      .map((lineHtml) => {
        scratch.innerHTML = lineHtml
        const translated = lookup.get(lineKey(scratch.textContent || ""))
        return translated
          ? `${lineHtml}<br><span class="song-translation">${escapeHtml(
              translated
            )}</span>`
          : lineHtml
      })
      .join('<br class="mt-3">')
  })

  return container.innerHTML
}

// Structural markers ('Chorus', 'Chorus:', '[Verse 1]', '(Bridge)'): never a
// title, and never given a translation line.
export const SECTION_LABEL =
  /^[\[\(]?\s*(pre[-\s]?chorus|chorus|refrain|verse|bridge|tag|intro|outro|interlude|instrumental|vamp|hook|ending|coda|solo)\b[^A-Za-z]*$/i

// Languages offered when naming what a song is sung in or translated into,
// as ISO 639-3 codes (what the catalogue stores). Where most of our churches
// are comes first, then the rest of the world by region; a code outside the
// list still shows by name.
export const SONG_LANGUAGES: { code: string; name: string }[] = [
  { code: "eng", name: "English" },
  { code: "yor", name: "Yoruba" },
  { code: "ibo", name: "Igbo" },
  { code: "hau", name: "Hausa" },
  { code: "pcm", name: "Nigerian Pidgin" },
  { code: "efi", name: "Efik" },
  { code: "ibb", name: "Ibibio" },
  { code: "urh", name: "Urhobo" },
  { code: "bin", name: "Edo" },
  { code: "tiv", name: "Tiv" },
  { code: "ijc", name: "Ijaw" },
  { code: "aka", name: "Akan" },
  { code: "twi", name: "Twi" },
  { code: "fat", name: "Fante" },
  { code: "gaa", name: "Ga" },
  { code: "ewe", name: "Ewe" },
  { code: "swa", name: "Swahili" },
  { code: "lug", name: "Luganda" },
  { code: "nyn", name: "Runyankore" },
  { code: "kin", name: "Kinyarwanda" },
  { code: "run", name: "Kirundi" },
  { code: "lin", name: "Lingala" },
  { code: "kon", name: "Kikongo" },
  { code: "lua", name: "Tshiluba" },
  { code: "kik", name: "Kikuyu" },
  { code: "luo", name: "Dholuo" },
  { code: "kam", name: "Kamba" },
  { code: "amh", name: "Amharic" },
  { code: "tir", name: "Tigrinya" },
  { code: "orm", name: "Oromo" },
  { code: "som", name: "Somali" },
  { code: "zul", name: "Zulu" },
  { code: "xho", name: "Xhosa" },
  { code: "sot", name: "Sesotho" },
  { code: "tsn", name: "Setswana" },
  { code: "nso", name: "Sepedi" },
  { code: "ven", name: "Venda" },
  { code: "tso", name: "Tsonga" },
  { code: "ssw", name: "Swati" },
  { code: "nde", name: "Ndebele (Zimbabwe)" },
  { code: "sna", name: "Shona" },
  { code: "nya", name: "Chichewa" },
  { code: "bem", name: "Bemba" },
  { code: "afr", name: "Afrikaans" },
  { code: "mlg", name: "Malagasy" },
  { code: "wol", name: "Wolof" },
  { code: "ful", name: "Fula" },
  { code: "bam", name: "Bambara" },
  { code: "fra", name: "French" },
  { code: "spa", name: "Spanish" },
  { code: "por", name: "Portuguese" },
  { code: "deu", name: "German" },
  { code: "nld", name: "Dutch" },
  { code: "ita", name: "Italian" },
  { code: "ron", name: "Romanian" },
  { code: "pol", name: "Polish" },
  { code: "rus", name: "Russian" },
  { code: "ukr", name: "Ukrainian" },
  { code: "ell", name: "Greek" },
  { code: "heb", name: "Hebrew" },
  { code: "ara", name: "Arabic" },
  { code: "hin", name: "Hindi" },
  { code: "ben", name: "Bengali" },
  { code: "pan", name: "Punjabi" },
  { code: "urd", name: "Urdu" },
  { code: "tam", name: "Tamil" },
  { code: "tel", name: "Telugu" },
  { code: "mal", name: "Malayalam" },
  { code: "kan", name: "Kannada" },
  { code: "mar", name: "Marathi" },
  { code: "tgl", name: "Tagalog" },
  { code: "ind", name: "Indonesian" },
  { code: "msa", name: "Malay" },
  { code: "zho", name: "Chinese" },
  { code: "kor", name: "Korean" },
  { code: "jpn", name: "Japanese" },
  { code: "vie", name: "Vietnamese" },
  { code: "tha", name: "Thai" },
  { code: "hat", name: "Haitian Creole" },
  { code: "jam", name: "Jamaican Patois" },
  // More of Africa
  { code: "nup", name: "Nupe" },
  { code: "igl", name: "Igala" },
  { code: "idu", name: "Idoma" },
  { code: "ish", name: "Esan" },
  { code: "iso", name: "Isoko" },
  { code: "its", name: "Itsekiri" },
  { code: "igb", name: "Ebira" },
  { code: "anw", name: "Anaang" },
  { code: "bom", name: "Berom" },
  { code: "gbr", name: "Gbagyi" },
  { code: "kau", name: "Kanuri" },
  { code: "fon", name: "Fon" },
  { code: "guw", name: "Gun" },
  { code: "dag", name: "Dagbani" },
  { code: "dga", name: "Dagaare" },
  { code: "mos", name: "Mossi" },
  { code: "dyu", name: "Dyula" },
  { code: "kbp", name: "Kabiyè" },
  { code: "men", name: "Mende" },
  { code: "tem", name: "Temne" },
  { code: "kri", name: "Krio" },
  { code: "kpe", name: "Kpelle" },
  { code: "bsq", name: "Bassa" },
  { code: "vai", name: "Vai" },
  { code: "dje", name: "Zarma" },
  { code: "taq", name: "Tamasheq" },
  { code: "snk", name: "Soninke" },
  { code: "mnk", name: "Mandinka" },
  { code: "srr", name: "Serer" },
  { code: "dyo", name: "Jola" },
  { code: "kea", name: "Cape Verdean Creole" },
  { code: "sag", name: "Sango" },
  { code: "dua", name: "Duala" },
  { code: "ewo", name: "Ewondo" },
  { code: "bum", name: "Bulu" },
  { code: "fan", name: "Fang" },
  { code: "ktu", name: "Kituba" },
  { code: "kmb", name: "Kimbundu" },
  { code: "umb", name: "Umbundu" },
  { code: "vmw", name: "Makhuwa" },
  { code: "seh", name: "Sena" },
  { code: "tum", name: "Tumbuka" },
  { code: "kqn", name: "Kaonde" },
  { code: "loz", name: "Lozi" },
  { code: "lue", name: "Luvale" },
  { code: "toi", name: "Tonga (Zambia)" },
  { code: "her", name: "Herero" },
  { code: "ndo", name: "Oshiwambo" },
  { code: "kua", name: "Kwanyama" },
  { code: "nbl", name: "Ndebele (South Africa)" },
  { code: "luy", name: "Luhya" },
  { code: "kln", name: "Kalenjin" },
  { code: "guz", name: "Ekegusii" },
  { code: "mer", name: "Kimeru" },
  { code: "mas", name: "Maasai" },
  { code: "ach", name: "Acholi" },
  { code: "laj", name: "Lango" },
  { code: "teo", name: "Ateso" },
  { code: "xog", name: "Lusoga" },
  { code: "cgg", name: "Rukiga" },
  { code: "nyo", name: "Runyoro" },
  { code: "suk", name: "Sukuma" },
  { code: "hay", name: "Haya" },
  { code: "tig", name: "Tigre" },
  { code: "aar", name: "Afar" },
  { code: "sid", name: "Sidamo" },
  { code: "wal", name: "Wolaytta" },
  { code: "nus", name: "Nuer" },
  { code: "din", name: "Dinka" },
  { code: "bfa", name: "Bari" },
  { code: "zne", name: "Zande" },
  { code: "kab", name: "Kabyle" },
  { code: "shi", name: "Tachelhit" },
  { code: "mfe", name: "Mauritian Creole" },
  { code: "crs", name: "Seychellois Creole" },
  // Europe
  { code: "gle", name: "Irish" },
  { code: "gla", name: "Scottish Gaelic" },
  { code: "cym", name: "Welsh" },
  { code: "bre", name: "Breton" },
  { code: "eus", name: "Basque" },
  { code: "cat", name: "Catalan" },
  { code: "glg", name: "Galician" },
  { code: "swe", name: "Swedish" },
  { code: "nor", name: "Norwegian" },
  { code: "dan", name: "Danish" },
  { code: "fin", name: "Finnish" },
  { code: "isl", name: "Icelandic" },
  { code: "est", name: "Estonian" },
  { code: "lav", name: "Latvian" },
  { code: "lit", name: "Lithuanian" },
  { code: "ces", name: "Czech" },
  { code: "slk", name: "Slovak" },
  { code: "hun", name: "Hungarian" },
  { code: "slv", name: "Slovenian" },
  { code: "hrv", name: "Croatian" },
  { code: "srp", name: "Serbian" },
  { code: "bos", name: "Bosnian" },
  { code: "mkd", name: "Macedonian" },
  { code: "bul", name: "Bulgarian" },
  { code: "sqi", name: "Albanian" },
  { code: "bel", name: "Belarusian" },
  { code: "mlt", name: "Maltese" },
  { code: "ltz", name: "Luxembourgish" },
  { code: "rom", name: "Romani" },
  { code: "yid", name: "Yiddish" },
  { code: "lat", name: "Latin" },
  // Middle East and Central Asia
  { code: "fas", name: "Persian" },
  { code: "prs", name: "Dari" },
  { code: "tur", name: "Turkish" },
  { code: "kur", name: "Kurdish" },
  { code: "hye", name: "Armenian" },
  { code: "kat", name: "Georgian" },
  { code: "aze", name: "Azerbaijani" },
  { code: "aii", name: "Assyrian Neo-Aramaic" },
  { code: "pus", name: "Pashto" },
  { code: "kaz", name: "Kazakh" },
  { code: "uzb", name: "Uzbek" },
  { code: "kir", name: "Kyrgyz" },
  { code: "tgk", name: "Tajik" },
  { code: "tuk", name: "Turkmen" },
  { code: "mon", name: "Mongolian" },
  { code: "uig", name: "Uyghur" },
  // South Asia
  { code: "guj", name: "Gujarati" },
  { code: "ori", name: "Odia" },
  { code: "asm", name: "Assamese" },
  { code: "nep", name: "Nepali" },
  { code: "sin", name: "Sinhala" },
  { code: "snd", name: "Sindhi" },
  { code: "kas", name: "Kashmiri" },
  { code: "kok", name: "Konkani" },
  { code: "tcy", name: "Tulu" },
  { code: "bho", name: "Bhojpuri" },
  { code: "sat", name: "Santali" },
  { code: "lus", name: "Mizo" },
  { code: "kha", name: "Khasi" },
  { code: "grt", name: "Garo" },
  { code: "nag", name: "Nagamese" },
  { code: "mni", name: "Manipuri" },
  { code: "dzo", name: "Dzongkha" },
  { code: "bod", name: "Tibetan" },
  // East and Southeast Asia
  { code: "yue", name: "Cantonese" },
  { code: "nan", name: "Taiwanese Hokkien" },
  { code: "hak", name: "Hakka" },
  { code: "mya", name: "Burmese" },
  { code: "ksw", name: "Karen" },
  { code: "kac", name: "Kachin" },
  { code: "khm", name: "Khmer" },
  { code: "lao", name: "Lao" },
  { code: "hmn", name: "Hmong" },
  { code: "jav", name: "Javanese" },
  { code: "sun", name: "Sundanese" },
  { code: "bbc", name: "Batak Toba" },
  { code: "tet", name: "Tetum" },
  { code: "fil", name: "Filipino" },
  { code: "ceb", name: "Cebuano" },
  { code: "ilo", name: "Ilocano" },
  { code: "hil", name: "Hiligaynon" },
  { code: "war", name: "Waray" },
  { code: "pam", name: "Kapampangan" },
  { code: "bik", name: "Bikol" },
  { code: "pag", name: "Pangasinan" },
  // The Pacific
  { code: "mri", name: "Māori" },
  { code: "smo", name: "Samoan" },
  { code: "ton", name: "Tongan" },
  { code: "fij", name: "Fijian" },
  { code: "haw", name: "Hawaiian" },
  { code: "tpi", name: "Tok Pisin" },
  { code: "bis", name: "Bislama" },
  { code: "tah", name: "Tahitian" },
  { code: "cha", name: "Chamorro" },
  { code: "mah", name: "Marshallese" },
  { code: "chk", name: "Chuukese" },
  { code: "pau", name: "Palauan" },
  { code: "gil", name: "Kiribati" },
  { code: "tvl", name: "Tuvaluan" },
  { code: "niu", name: "Niuean" },
  { code: "rar", name: "Cook Islands Māori" },
  // The Americas
  { code: "que", name: "Quechua" },
  { code: "aym", name: "Aymara" },
  { code: "grn", name: "Guarani" },
  { code: "nah", name: "Nahuatl" },
  { code: "yua", name: "Yucatec Maya" },
  { code: "quc", name: "K'iche'" },
  { code: "kek", name: "Q'eqchi'" },
  { code: "cak", name: "Kaqchikel" },
  { code: "mam", name: "Mam" },
  { code: "zap", name: "Zapotec" },
  { code: "mix", name: "Mixtec" },
  { code: "miq", name: "Miskito" },
  { code: "arn", name: "Mapudungun" },
  { code: "guc", name: "Wayuu" },
  { code: "cab", name: "Garifuna" },
  { code: "pap", name: "Papiamento" },
  { code: "srn", name: "Sranan Tongo" },
  { code: "nav", name: "Navajo" },
  { code: "chr", name: "Cherokee" },
  { code: "lkt", name: "Lakota" },
  { code: "oji", name: "Ojibwe" },
  { code: "cre", name: "Cree" },
  { code: "iku", name: "Inuktitut" },
  { code: "mul", name: "Several languages" },
]

/** A language code's name for the form: "yor" → "Yoruba". */
export const languageName = (code?: string | null) => {
  if (!code) return ""
  const known = SONG_LANGUAGES.find((language) => language.code === code)
  if (known) return known.name
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code
  } catch {
    return code
  }
}

/** A typed or picked language name back to its code; "" when it is not one. */
export const languageCode = (name?: string | null) => {
  const wanted = (name || "").trim().toLowerCase()
  if (!wanted) return ""
  const known = SONG_LANGUAGES.find(
    (language) =>
      language.name.toLowerCase() === wanted || language.code === wanted
  )
  return known?.code || ""
}

// Written in a translation box for a sung line that has no translation.
export const UNTRANSLATED_LINE = "-"

/**
 * The lyric lines a translation is written for: sung lines, not the blank
 * lines between verses or section labels like "Chorus".
 */
export const translatableLineIndexes = (lyrics = "") =>
  lyrics.split(/\r?\n/).flatMap((line, index) => {
    const text = line.replaceAll("[force-verse-break]", "").trim()
    return text && !SECTION_LABEL.test(text) ? [index] : []
  })

/**
 * A stored translation as the text a person edits: one line per sung line, in
 * order, with "-" for a sung line left untranslated.
 */
export const translationToText = (lyrics: string, lines: string[] = []) => {
  const text = translatableLineIndexes(lyrics).map(
    (index) => lines[index]?.trim() || UNTRANSLATED_LINE
  )
  while (text[text.length - 1] === UNTRANSLATED_LINE) text.pop()
  return text.join("\n")
}

/**
 * The reverse: the edited text laid out parallel to the lyrics, the shape the
 * API stores (`lines[i]` translates lyric line `i`). Lines go to sung lines in
 * order; blank lines in the text are ignored. `missing` counts sung lines the
 * text ran out before, `extra` the text lines left with no sung line.
 */
export const alignTranslation = (lyrics: string, text: string) => {
  const indexes = translatableLineIndexes(lyrics)
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const lines = lyrics.split(/\r?\n/).map(() => "")
  indexes.forEach((lyricIndex, n) => {
    const entry = entries[n]
    if (entry && entry !== UNTRANSLATED_LINE) lines[lyricIndex] = entry
  })
  return {
    lines,
    missing: Math.max(indexes.length - entries.length, 0),
    extra: Math.max(entries.length - indexes.length, 0),
  }
}
