export type VerseVoiceCommand = "next-verse" | "previous-verse"

type BibleVersionVoiceOption =
  | string
  | {
      id?: string
      name?: string
      isDownloaded?: boolean
    }

const ONE_TO_NINE: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}

const NUMBER_WORDS: Record<string, number> = {
  ...ONE_TO_NINE,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const normalizeCommandText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const normalizeVersionAlias = (text: string) =>
  normalizeCommandText(text)
    .replace(/\bthe\b/g, "")
    .replace(/\b(?:holy\s+)?bible\b/g, "")
    .replace(/\b(?:version|translation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()

const commandTarget = "(?:verse|verses|scripture|passage|slide|one|part)"
const oneToNinePattern = "(?:one|two|three|four|five|six|seven|eight|nine)"
const tenToNineteenPattern =
  "(?:ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)"
const tensPattern = "(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)"
const underHundredPattern = `(?:${oneToNinePattern}|${tenToNineteenPattern}|${tensPattern}(?:\\s+${oneToNinePattern})?)`
const hundredPattern = `(?:one\\s+hundred(?:\\s+(?:and\\s+)?${underHundredPattern})?)`
const verseNumberPattern = `(?:\\d{1,3}|${hundredPattern}|${underHundredPattern})`

const nextVersePatterns: RegExp[] = [
  /^next$/,
  /^next please$/,
  /\bnext first\b/,
  new RegExp(`\\b(?:next|following)\\s+${commandTarget}\\b`),
  new RegExp(
    `\\b(?:go|move|take|show|switch|advance|continue|proceed)\\s+(?:to\\s+)?(?:the\\s+)?(?:next|following)\\s+${commandTarget}\\b`,
  ),
  /\b(?:go|move|step|advance)\s+(?:forward|forwards|ahead|on)\b/,
  /\b(?:forward|forwards|ahead)\s+(?:one|please)?\b/,
  /\b(?:take|show)\s+(?:the\s+)?next\b/,
  /\b(?:let us|let s|lets)\s+(?:move|go|continue|proceed)\s+(?:forward|forwards|ahead|on)\b/,
]

const previousVersePatterns: RegExp[] = [
  /^back$/,
  /^back please$/,
  /^previous$/,
  /^previous please$/,
  new RegExp(`\\b(?:previous|prev|last|former)\\s+${commandTarget}\\b`),
  new RegExp(
    `\\b(?:go|move|take|show|switch|return)\\s+(?:to\\s+)?(?:the\\s+)?(?:previous|prev|last|former)\\s+${commandTarget}\\b`,
  ),
  /\b(?:go|move|step)\s+(?:back|backward|backwards)\b/,
  /\b(?:back|backward|backwards)\s+(?:one|please)?\b/,
  /\b(?:take|bring|move)\s+(?:it\s+)?back\b/,
  /\b(?:let us|let s|lets)\s+(?:move|go|step)\s+(?:back|backward|backwards)\b/,
]

const gotoVerseNumberPatterns: RegExp[] = [
  new RegExp(
    `\\b(?:go|goto|move|jump|turn|take|bring|show|switch|open|display)\\s+(?:me\\s+)?(?:over\\s+)?(?:to\\s+)?(?:the\\s+)?(?:bible\\s+)?verse\\s+(?:number\\s+)?(${verseNumberPattern})\\b`,
  ),
  new RegExp(
    `\\b(?:put|place)\\s+(?:it\\s+)?(?:on|at)\\s+(?:the\\s+)?(?:bible\\s+)?verse\\s+(?:number\\s+)?(${verseNumberPattern})\\b`,
  ),
  new RegExp(
    `\\b(?:let us|let s|lets)\\s+(?:go|move|turn|jump)\\s+(?:to\\s+)?(?:the\\s+)?(?:bible\\s+)?verse\\s+(?:number\\s+)?(${verseNumberPattern})\\b`,
  ),
  new RegExp(
    `\\bverses?\\s+(?:number\\s+)?(${verseNumberPattern})\\b`,
  ),
]

/**
 * Version patterns, most explicit first.
 *
 * `allowAmbiguous` says whether a pattern may resolve to an alias that is also
 * an ordinary sermon word (see `ambiguousVersionAliases`). Patterns carrying an
 * explicit command verb do; the loose trailing form does not.
 */
const bibleVersionCommandPatterns: Array<{
  pattern: RegExp
  allowAmbiguous: boolean
}> = [
  { pattern: /\b(?:show|display|open)\s+(?:this|it|scripture|passage|verse)\s+(?:in|with|using)\s+(.+?)$/, allowAmbiguous: true },
  { pattern: /\b(?:switch|change|set)\s+(?:the\s+)?(?:bible\s+)?(?:version|translation)\s+(?:to|into|over\s+to|as)\s+(.+?)$/, allowAmbiguous: true },
  { pattern: /\b(?:switch|change|set|use|open|show|display)\s+(?:the\s+)?(?:bible\s+)?(?:to|into|over\s+to|in|with|using|as)\s+(.+?)$/, allowAmbiguous: true },
  { pattern: /\b(?:use|open|show|display)\s+(?:the\s+)?(.+?)\s+(?:bible|version|translation)$/, allowAmbiguous: true },
  { pattern: /\bgive\s+me\s+(?:the\s+)?(?:bible\s+)?(?:in|with|using)\s+(?:the\s+)?(.+?)\s+(?:bible|version|translation)$/, allowAmbiguous: true },
  { pattern: /\bgive\s+me\s+(?:the\s+)?(?:bible\s+)?(?:in|with|using)\s+(.+?)$/, allowAmbiguous: true },
  { pattern: /\bgive\s+me\s+(?:the\s+)?(.+?)\s+(?:bible|version|translation)$/, allowAmbiguous: true },
  { pattern: /\b(?:use|switch\s+to|change\s+to|set\s+to)\s+(.+?)$/, allowAmbiguous: true },
  { pattern: /\bgive\s+me\s+(?:the\s+)?(.+?)$/, allowAmbiguous: true },

  // Verb-less trailing form: "the next verse in amplified version",
  // "read that one with the new king james". Strict aliases only — this is the
  // pattern most likely to catch ordinary speech.
  { pattern: /\b(?:in|with|using|from)\s+(?:the\s+)?(.+?)$/, allowAmbiguous: false },
]

const bibleVersionAliases: Record<string, string[]> = {
  KJV: ["kjv", "k j v", "king james", "king james version"],
  ASV: ["asv", "a s v", "american standard", "american standard version"],
  YLT: ["ylt", "y l t", "youngs literal", "young literal", "youngs literal translation"],
  WEB: ["web", "w e b", "world english", "world english bible"],
  NKJV: ["nkjv", "n k j v", "new king james", "new king james version"],
  NIV: ["niv", "n i v", "new international", "new international version"],
  AMP: ["amp", "a m p", "amplified", "amplified bible"],
  NLT: ["nlt", "n l t", "new living", "new living translation"],
  CEV: ["cev", "c e v", "contemporary english", "contemporary english version"],
  MSG: ["msg", "m s g", "message", "the message"],
  NASB: ["nasb", "n a s b", "new american standard", "new american standard bible"],
  TPT: ["tpt", "t p t", "passion", "passion translation", "the passion translation"],
  YBCV: ["ybcv", "y b c v", "yoruba", "yoruba bible", "yoruba ybcv"],
}

/**
 * Aliases that are also ordinary sermon words. They still resolve from an
 * explicit command ("switch to the message", "give me the passion translation"),
 * but never from the verb-less trailing pattern or a bare utterance — otherwise
 * quoting "it is written in the message" would swap the translation live.
 */
const ambiguousVersionAliases = new Set(["message", "passion", "web"])

const parseVerseNumber = (rawValue: string): number | null => {
  const trimmed = rawValue.trim()
  if (/^\d{1,3}$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return parsed >= 1 && parsed <= 176 ? parsed : null
  }

  const words = trimmed.split(/\s+/).filter((word) => word !== "and")
  if (!words.length) return null

  let total = 0
  for (const word of words) {
    if (word === "hundred") {
      total = (total || 1) * 100
      continue
    }

    const value = NUMBER_WORDS[word]
    if (!value) return null
    total += value
  }

  return total >= 1 && total <= 176 ? total : null
}

const toBibleVersionOption = (option: BibleVersionVoiceOption) => {
  if (typeof option === "string") return { id: option, name: option }
  return option
}

const getSpokenAcronym = (id: string) => id.toLowerCase().split("").join(" ")

const cleanupVersionCandidate = (rawValue: string) =>
  rawValue
    .replace(/\b(?:please|now|sir|ma|ok|okay|thanks|thank you|again|just)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()

type BibleVersionAliasEntry = { alias: string; id: string; ambiguous: boolean }

const buildBibleVersionAliasEntries = (
  versions: BibleVersionVoiceOption[]
): BibleVersionAliasEntry[] => {
  const entries: BibleVersionAliasEntry[] = []

  for (const rawOption of versions) {
    const option = toBibleVersionOption(rawOption)
    if (!option.id) continue

    const id = option.id.toUpperCase()
    const aliases = [
      id,
      id.toLowerCase(),
      getSpokenAcronym(id),
      option.name || "",
      ...(bibleVersionAliases[id] || []),
    ]

    for (const alias of aliases) {
      const normalizedAlias = normalizeVersionAlias(alias)
      if (!normalizedAlias) continue
      entries.push({
        alias: normalizedAlias,
        id,
        ambiguous: ambiguousVersionAliases.has(normalizedAlias),
      })
    }
  }

  return entries
}

export const detectVerseVoiceCommand = (
  text: string
): VerseVoiceCommand | null => {
  const commandText = normalizeCommandText(text)
  if (!commandText) return null

  if (nextVersePatterns.some((pattern) => pattern.test(commandText))) {
    return "next-verse"
  }

  if (previousVersePatterns.some((pattern) => pattern.test(commandText))) {
    return "previous-verse"
  }

  return null
}

/**
 * Match an utterance that is *nothing but* version names — "amplified",
 * "NKJV please", "amplified version please amplified".
 *
 * The whole utterance (minus filler and the words "bible"/"version"/
 * "translation"/"the") must be consumable as a run of aliases that all resolve
 * to the same version, so "the amplified bible says here" is left alone.
 * Ambiguous aliases are excluded — a bare "the message" is far more likely to be
 * a preacher's sentence than a command.
 */
const detectBareVersionUtterance = (
  commandText: string,
  aliasEntries: BibleVersionAliasEntry[]
): string | null => {
  const cleaned = normalizeVersionAlias(cleanupVersionCandidate(commandText))
  if (!cleaned) return null

  // Longest alias first so "new king james" wins over "king james".
  const candidates = aliasEntries
    .filter((entry) => !entry.ambiguous)
    .map((entry) => ({ ...entry, words: entry.alias.split(" ") }))
    .sort((a, b) => b.words.length - a.words.length)

  const tokens = cleaned.split(" ")
  let index = 0
  let matchedId: string | null = null

  while (index < tokens.length) {
    const entry = candidates.find((candidate) =>
      candidate.words.every((word, offset) => tokens[index + offset] === word)
    )
    // A single non-alias word means this is speech, not a command.
    if (!entry) return null
    if (matchedId && entry.id !== matchedId) return null

    matchedId = entry.id
    index += entry.words.length
  }

  return matchedId
}

export const detectBibleVersionVoiceCommand = (
  text: string,
  availableVersions: BibleVersionVoiceOption[] = []
): string | null => {
  const commandText = normalizeCommandText(text)
  if (!commandText || !availableVersions.length) return null

  const aliasEntries = buildBibleVersionAliasEntries(availableVersions)
  if (!aliasEntries.length) return null

  for (const { pattern, allowAmbiguous } of bibleVersionCommandPatterns) {
    const match = commandText.match(pattern)
    if (!match?.[1]) continue

    const candidate = normalizeVersionAlias(cleanupVersionCandidate(match[1]))
    if (!candidate) continue

    const matchedVersion = aliasEntries.find(
      (entry) =>
        entry.alias === candidate && (allowAmbiguous || !entry.ambiguous)
    )
    if (matchedVersion) return matchedVersion.id
  }

  return detectBareVersionUtterance(commandText, aliasEntries)
}

export const detectVerseGotoCommand = (text: string): number | null => {
  const commandText = normalizeCommandText(text)
  if (!commandText) return null

  for (const pattern of gotoVerseNumberPatterns) {
    const match = commandText.match(pattern)
    if (!match?.[1]) continue

    const verseNumber = parseVerseNumber(match[1])
    if (verseNumber) return verseNumber
  }

  return null
}

export type VoiceCommandAction =
  | "goto-verse-number"
  | "next-verse"
  | "previous-verse"
  | "change-bible-version"

export interface VoiceCommandPlan {
  /** Stable identity for the caller's fire-once latch. */
  key: string
  action: VoiceCommandAction
  /**
   * Identity of the navigation portion only. Streaming callers use this to
   * avoid moving twice when a later interim result merely adds a version.
   */
  navigationKey?: string
  /** Set for "goto-verse-number". */
  verseNumber?: number
  /**
   * Set whenever the utterance named a translation. On a navigation action it
   * rides along so the caller can move and switch in ONE update — two separate
   * events race each other through the slide round-trip and the version loses.
   */
  version?: string
}

/**
 * Resolve an utterance into the single action to fire.
 *
 * Navigation and version are detected independently, so "give me the next verse
 * but give me in amplified version" yields next-verse *carrying* AMP rather than
 * discarding one half. An explicit verse number outranks next/previous.
 */
export const planVoiceCommand = (
  text: string,
  options: {
    availableVersions?: BibleVersionVoiceOption[]
    versionCommandsEnabled?: boolean
  } = {}
): VoiceCommandPlan | null => {
  const verseNumber = detectVerseGotoCommand(text)
  const verse = verseNumber ? null : detectVerseVoiceCommand(text)
  const version =
    options.versionCommandsEnabled === false
      ? null
      : detectBibleVersionVoiceCommand(text, options.availableVersions ?? [])

  const action: VoiceCommandAction | null = verseNumber
    ? "goto-verse-number"
    : verse ?? (version ? "change-bible-version" : null)
  if (!action) return null

  const navigationKey = verseNumber
    ? `goto-verse-number:${verseNumber}`
    : verse ?? undefined
  const keyParts = [
    navigationKey ?? "",
    version ? `version:${version}` : "",
  ].filter(Boolean)

  return {
    // Preserve the full identity for non-streaming consumers. Streaming callers
    // use navigationKey to deduplicate the movement portion independently.
    key: keyParts.join("+"),
    action,
    ...(navigationKey ? { navigationKey } : {}),
    ...(verseNumber ? { verseNumber } : {}),
    ...(version ? { version } : {}),
  }
}
