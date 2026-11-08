/**
 * Pure scoring helpers for the transcription bench. No I/O here, so the
 * vitest suite can cover them directly.
 */

const ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const ORDINALS = { first: 1, second: 2, third: 3, '1st': 1, '2nd': 2, '3rd': 3 }
const FILLERS = new Set(['um', 'uh', 'umm', 'uhm', 'er', 'erm', 'hmm', 'mm', 'ah'])

/**
 * Spoken numbers become digits on both sides, so "chapter three verse
 * sixteen" in a hand-typed reference matches Deepgram's numerals output.
 */
const wordsToDigits = (words) => {
  const out = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w in ORDINALS) { out.push(String(ORDINALS[w])); continue }
    if (!(w in ONES) && !(w in TENS)) { out.push(w); continue }

    let value = 0
    let j = i
    const take = () => {
      let v = 0
      if (words[j] in TENS) {
        v = TENS[words[j++]]
        if (words[j] in ONES && ONES[words[j]] < 10) v += ONES[words[j++]]
      } else if (words[j] in ONES) {
        v = ONES[words[j++]]
      }
      return v
    }
    value = take()
    if (words[j] === 'hundred') {
      value *= 100
      j++
      if (words[j] === 'and' && (words[j + 1] in ONES || words[j + 1] in TENS)) j++
      if (words[j] in ONES || words[j] in TENS) value += take()
    }
    out.push(String(value))
    i = j - 1
  }
  return out
}

export const normalizeWords = (text) => {
  const words = String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !FILLERS.has(w))
  return wordsToDigits(words)
}

/**
 * Word-level Levenshtein alignment that keeps substitution, deletion and
 * insertion counts. Two rolling rows keep a 90-minute service (~15k words a
 * side) within a few MB.
 */
export const wordErrors = (ref, hyp) => {
  const n = ref.length
  const m = hyp.length
  let pc = new Uint32Array(m + 1), ps = new Uint32Array(m + 1), pd = new Uint32Array(m + 1), pi = new Uint32Array(m + 1)
  let cc = new Uint32Array(m + 1), cs = new Uint32Array(m + 1), cd = new Uint32Array(m + 1), ci = new Uint32Array(m + 1)
  for (let j = 0; j <= m; j++) { pc[j] = j; pi[j] = j }

  for (let i = 1; i <= n; i++) {
    cc[0] = i; cs[0] = 0; cd[0] = i; ci[0] = 0
    const r = ref[i - 1]
    for (let j = 1; j <= m; j++) {
      const match = r === hyp[j - 1]
      const diag = pc[j - 1] + (match ? 0 : 1)
      const del = pc[j] + 1
      const ins = cc[j - 1] + 1
      if (diag <= del && diag <= ins) {
        cc[j] = diag; cs[j] = ps[j - 1] + (match ? 0 : 1); cd[j] = pd[j - 1]; ci[j] = pi[j - 1]
      } else if (del <= ins) {
        cc[j] = del; cs[j] = ps[j]; cd[j] = pd[j] + 1; ci[j] = pi[j]
      } else {
        cc[j] = ins; cs[j] = cs[j - 1]; cd[j] = cd[j - 1]; ci[j] = ci[j - 1] + 1
      }
    }
    ;[pc, cc] = [cc, pc]; [ps, cs] = [cs, ps]; [pd, cd] = [cd, pd]; [pi, ci] = [ci, pi]
  }

  const substitutions = ps[m], deletions = pd[m], insertions = pi[m]
  return {
    refWords: n,
    hypWords: m,
    substitutions,
    deletions,
    insertions,
    wer: n ? (substitutions + deletions + insertions) / n : (m ? 1 : 0),
  }
}

/** "01:02:03,450", "02:03.4", "123.5" or 123.5 → seconds. */
export const parseTime = (value) => {
  if (typeof value === 'number') return value
  const parts = String(value).trim().replace(',', '.').split(':').map(Number)
  if (parts.some(Number.isNaN)) throw new Error(`Bad timestamp: ${value}`)
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

/**
 * Reads a reference transcript into cues of {start, end, text}. Plain text
 * gives one untimed cue; SRT/VTT and JSON give timed cues so WER can be
 * reported per window of the service.
 */
export const parseReference = (raw, ext) => {
  if (ext === '.json') {
    const data = JSON.parse(raw)
    const list = Array.isArray(data) ? data : data.segments ?? data.cues ?? []
    return list.map((c) => ({
      start: c.start === undefined ? null : parseTime(c.start),
      end: c.end === undefined ? null : parseTime(c.end),
      text: c.text ?? '',
    }))
  }
  if (ext === '.srt' || ext === '.vtt') {
    const cues = []
    for (const block of raw.replace(/\r/g, '').split(/\n\s*\n/)) {
      const lines = block.split('\n')
      const idx = lines.findIndex((l) => l.includes('-->'))
      if (idx === -1) continue
      const [a, b] = lines[idx].split('-->').map((s) => s.trim().split(/\s+/)[0])
      const text = lines.slice(idx + 1).join(' ').replace(/<[^>]+>/g, '').trim()
      cues.push({ start: parseTime(a), end: parseTime(b), text })
    }
    return cues
  }
  return [{ start: null, end: null, text: raw }]
}

/** Spreads each cue's words evenly over its span. */
export const timedWords = (cues) => {
  const out = []
  for (const cue of cues) {
    const words = normalizeWords(cue.text)
    const span = cue.start !== null && cue.end !== null ? Math.max(0, cue.end - cue.start) : 0
    words.forEach((w, k) => {
      out.push({ w, t: cue.start === null ? null : cue.start + (span * (k + 0.5)) / words.length })
    })
  }
  return out
}

export const percentile = (values, p) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

/** Bag-of-words recall of the given phrases (case-insensitive, normalised). */
export const termRecall = (refWords, hypWords, terms) => {
  const count = (words, phrase) => {
    let c = 0
    for (let i = 0; i + phrase.length <= words.length; i++) {
      let ok = true
      for (let k = 0; k < phrase.length; k++) if (words[i + k] !== phrase[k]) { ok = false; break }
      if (ok) c++
    }
    return c
  }
  let expected = 0
  let found = 0
  const missed = []
  for (const term of new Set(terms)) {
    const phrase = normalizeWords(term)
    if (!phrase.length) continue
    const r = count(refWords, phrase)
    if (!r) continue
    const h = count(hypWords, phrase)
    expected += r
    found += Math.min(r, h)
    if (h < r) missed.push({ term, expected: r, heard: h })
  }
  return { expected, found, recall: expected ? found / expected : null, missed }
}

/**
 * Matches expected scripture references against what the app detected.
 * A hit needs the same shortLabel within the time window; a detection that
 * only gets book and chapter right counts as a chapter hit, since the
 * operator can still reach the verse from there.
 */
export const matchReferences = (expected, detected, { before = 15, after = 45 } = {}) => {
  const chapterOf = (label) => label.split(':').slice(0, 2).join(':')
  const timed = expected.every((e) => e.t !== null)
  const used = new Set()
  const rows = expected.map((e) => {
    const inWindow = (d) => !timed || (d.t >= e.t - before && d.t <= e.t + after)
    let hit = detected.findIndex((d, k) => !used.has(k) && d.shortLabel === e.shortLabel && inWindow(d))
    let kind = 'exact'
    if (hit === -1) {
      hit = detected.findIndex((d, k) => !used.has(k) && chapterOf(d.shortLabel) === chapterOf(e.shortLabel) && inWindow(d))
      kind = 'chapter'
    }
    if (hit === -1) return { ...e, kind: 'missed', latency: null }
    used.add(hit)
    const d = detected[hit]
    return { ...e, kind, detectedAs: d.displayLabel, latency: timed ? d.t - e.t : null }
  })
  const spurious = detected.filter((_, k) => !used.has(k))
  const exact = rows.filter((r) => r.kind === 'exact').length
  const chapter = rows.filter((r) => r.kind === 'chapter').length
  return {
    rows,
    spurious,
    recallExact: expected.length ? exact / expected.length : null,
    recallChapter: expected.length ? (exact + chapter) / expected.length : null,
    precision: detected.length ? (exact + chapter) / detected.length : null,
  }
}

/**
 * Replays the operator client's auto-live rule (useDeepgramTranscription's
 * applyServerReferences): skip a repeat of the last fired reference, and
 * hold off for 1.5 s unless a final result corrects a provisional one.
 */
export const simulateAutoLive = (referenceEvents, cooldownMs = 1500) => {
  const fires = []
  let lastLabel = null
  let lastAt = -Infinity
  for (const ev of referenceEvents) {
    const first = ev.references?.[0]
    if (!first || first.shortLabel === lastLabel) continue
    const isFinalCorrection = !ev.provisional && lastLabel !== null
    if (isFinalCorrection || ev.wallMs - lastAt >= cooldownMs) {
      lastAt = ev.wallMs
      lastLabel = first.shortLabel
      fires.push({ t: ev.t, shortLabel: first.shortLabel, displayLabel: first.displayLabel })
    }
  }
  return fires
}
