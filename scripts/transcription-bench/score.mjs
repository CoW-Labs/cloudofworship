#!/usr/bin/env node
/**
 * Scores a run.mjs log against a reference transcript.
 *
 *   node scripts/transcription-bench/score.mjs bench-runs/<run> --ref service.srt [--refs scriptures.txt] [--terms names.txt]
 *
 * --ref    the true transcript: .srt/.vtt/.json (timed, gives per-window
 *          results) or .txt (overall figures only)
 * --refs   the scriptures actually cited, one per line, "MM:SS John 3:16"
 *          or just "John 3:16". Without it they're read out of --ref with
 *          the API's own parser, which flatters the parser.
 * --terms  extra words that must come through (pastor's name, church name,
 *          local language words), one per line
 *
 * Writes report.md and report.json into the run folder.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  normalizeWords, wordErrors, parseReference, timedWords, parseTime, percentile,
  termRecall, matchReferences, simulateAutoLive,
} from './metrics.mjs'

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ref: { type: 'string' },
    refs: { type: 'string' },
    terms: { type: 'string' },
    window: { type: 'string', default: '300' },
  },
})

const die = (msg) => { console.error(`✖ ${msg}`); process.exit(1) }
const runDir = positionals[0]
if (!runDir || !existsSync(join(runDir, 'run.jsonl'))) die('Pass the run folder (the one holding run.jsonl)')
if (!args.ref) die('Pass --ref <reference transcript>')

const API_DIR = process.env.COW_API_DIR || join(homedir(), 'nodeProjects/minimalist-church-presentation-software-api')
const { parseBibleReferences } = await import(pathToFileURL(join(API_DIR, 'src/modules/transcription/bibleReferenceParser.js')).href)
const { bibleBooks, transcriptionKeyterms } = await import(pathToFileURL(join(API_DIR, 'src/modules/transcription/bibleBooks.js')).href)

const fmt = (s) => s === null || s === undefined ? '–' : `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const pct = (v) => v === null || v === undefined ? '–' : `${(v * 100).toFixed(1)}%`
const sec = (v) => v === null || v === undefined ? '–' : `${v.toFixed(2)}s`

// ── Read the run ──────────────────────────────────────────────────────────
const events = readFileSync(join(runDir, 'run.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const meta = events.find((e) => e.ev === 'meta')
const total = meta.totalSeconds
const windowSec = Number(args.window)
const msgs = events.filter((e) => e.ev === 'msg')

// What the operator saw as finished lines: every is_final/speech_final
// result, plus the interim the client flushes when the operator stops.
// An unexpected close loses its interim, as cleanup() does in the app.
const finals = []
const interimBySession = new Map()
for (const e of events) {
  if (e.ev === 'msg' && e.type === 'transcript') {
    if (e.isFinal || e.speechFinal) {
      finals.push(e)
      interimBySession.delete(e.session)
    } else {
      interimBySession.set(e.session, e)
    }
  }
  if (e.ev === 'close' && e.expected && interimBySession.has(e.session)) {
    finals.push({ ...interimBySession.get(e.session), flushed: true })
    interimBySession.delete(e.session)
  }
}

const hypTimed = []
for (const f of finals) {
  const words = normalizeWords(f.transcript)
  words.forEach((w, k) => {
    const t = f.at !== undefined ? f.at + (f.duration * (k + 0.5)) / words.length : f.a
    hypTimed.push({ w, t })
  })
}
const hypWords = hypTimed.map((x) => x.w)

// ── Reference ─────────────────────────────────────────────────────────────
const cues = parseReference(readFileSync(args.ref, 'utf8'), extname(args.ref).toLowerCase())
const refTimed = timedWords(cues)
const refWords = refTimed.map((x) => x.w)
const refIsTimed = refTimed.length > 0 && refTimed.every((x) => x.t !== null)

const overall = wordErrors(refWords, hypWords)

// ── Connection timeline ───────────────────────────────────────────────────
const sessions = []
for (const e of events) {
  if (e.ev === 'msg' && e.type === 'ready') sessions.push({ id: e.session, from: e.a, to: null, closeCode: null, expected: null })
  if (e.ev === 'close') {
    const s = sessions.find((x) => x.id === e.session)
    if (s) { s.to = e.a; s.closeCode = e.code; s.expected = e.expected }
  }
}
for (const s of sessions) if (s.to === null) s.to = total
const connectedSeconds = sessions.reduce((acc, s) => acc + Math.max(0, Math.min(s.to, total) - s.from), 0)
const unexpectedCloses = events.filter((e) => e.ev === 'close' && !e.expected)
const errors = events.filter((e) => (e.ev === 'msg' && (e.type === 'error' || e.type === 'limit_reached')) || e.ev === 'ws-error')
const pausedSeconds = (meta.faults?.pauses ?? []).reduce((a, p) => a + p.for, 0)

// ── Latency (deepgram engine only: the proxy doesn't relay word timings) ──
const finalLatencies = finals.filter((f) => f.at !== undefined && !f.flushed).map((f) => ({ t: f.a, v: f.a - (f.at + f.duration) }))

// ── Dead zones: long stretches with speech in the reference but no lines ──
const deadZones = []
{
  const times = [0, ...finals.map((f) => f.a), total]
  for (let k = 1; k < times.length; k++) {
    const [a, b] = [times[k - 1], times[k]]
    if (b - a < 30) continue
    const spoken = refIsTimed ? refTimed.filter((x) => x.t > a && x.t < b).length : null
    if (spoken === null || spoken >= 25) deadZones.push({ from: a, to: b, seconds: b - a, referenceWords: spoken })
  }
}

// ── Per-window drift ──────────────────────────────────────────────────────
const windows = []
for (let start = 0; start < total; start += windowSec) {
  const end = Math.min(total, start + windowSec)
  const inW = (t) => t >= start && t < end
  const w = { from: start, to: end }
  if (refIsTimed) w.errors = wordErrors(refTimed.filter((x) => inW(x.t)).map((x) => x.w), hypTimed.filter((x) => inW(x.t)).map((x) => x.w))
  w.finals = finals.filter((f) => inW(f.a)).length
  const lats = finalLatencies.filter((l) => inW(l.t)).map((l) => l.v)
  w.latencyP50 = percentile(lats, 50)
  w.latencyP95 = percentile(lats, 95)
  w.closes = unexpectedCloses.filter((e) => inW(e.a)).length
  w.errors_ = errors.filter((e) => inW(e.a)).length
  windows.push(w)
}

// ── Scripture ─────────────────────────────────────────────────────────────
const toRef = (text, t) => {
  const parsed = parseBibleReferences(text)[0]
  return parsed ? { t, said: text.trim(), shortLabel: parsed.shortLabel, displayLabel: parsed.displayLabel } : null
}
let expectedRefs = []
let refsSource
if (args.refs) {
  refsSource = 'hand-marked list'
  for (const line of readFileSync(args.refs, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
    const m = line.match(/^([\d:.]+)\s+(.+)$/)
    const r = m ? toRef(m[2], parseTime(m[1])) : toRef(line, null)
    if (!r) console.warn(`⚠ couldn't read a scripture from "${line}"`)
    else expectedRefs.push(r)
  }
} else {
  refsSource = 'parsed from the reference transcript'
  // Place each citation where it ends inside its cue, since that's when the
  // full reference has been said and detection can first fire.
  for (const cue of cues) {
    for (const p of parseBibleReferences(cue.text)) {
      const t = cue.start === null ? null : cue.start + (cue.end - cue.start) * (p.endIndex / cue.text.length)
      expectedRefs.push({ t, said: p.text, shortLabel: p.shortLabel, displayLabel: p.displayLabel })
    }
  }
}
if (expectedRefs.some((r) => r.t === null)) expectedRefs = expectedRefs.map((r) => ({ ...r, t: null }))

const referenceEvents = msgs.filter((e) => e.type === 'references').map((e) => ({ ...e, t: e.a, wallMs: e.w }))
// Every distinct reference the server pushed (its 4 s dedupe already applied).
const detected = []
for (const ev of referenceEvents) {
  for (const r of ev.references) {
    if (detected.some((d) => d.shortLabel === r.shortLabel && ev.t - d.t < 30)) continue
    detected.push({ t: ev.t, shortLabel: r.shortLabel, displayLabel: r.displayLabel })
  }
}
const scripture = matchReferences(expectedRefs, detected)
const fires = simulateAutoLive(referenceEvents)
const firesScored = matchReferences(expectedRefs, fires)
const refLatencies = scripture.rows.filter((r) => r.latency !== null).map((r) => r.latency)

// ── Church vocabulary ─────────────────────────────────────────────────────
const extraTerms = args.terms ? readFileSync(args.terms, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : []
const books = termRecall(refWords, hypWords, bibleBooks)
const vocab = termRecall(refWords, hypWords, [...transcriptionKeyterms.filter((t) => !bibleBooks.includes(t)), ...extraTerms])

// ── Saved session vs what was shown ───────────────────────────────────────
let persisted = null
if (existsSync(join(runDir, 'persisted.json'))) {
  const saved = JSON.parse(readFileSync(join(runDir, 'persisted.json'), 'utf8'))
  const words = normalizeWords(saved.flatMap((s) => s.segments ?? []).map((s) => s.text).join(' '))
  persisted = { words: words.length, shownWords: hypWords.length, kept: hypWords.length ? words.length / hypWords.length : null, errors: wordErrors(refWords, words) }
}

// ── Report ────────────────────────────────────────────────────────────────
const verdictLines = []
const coverage = connectedSeconds / total
if (coverage < 0.99) verdictLines.push(`Transcription was offline for ${fmt(total - connectedSeconds)} of the service.`)
if (unexpectedCloses.length) verdictLines.push(`${unexpectedCloses.length} unexpected disconnect(s)${meta.reconnectAfter === null ? '; reconnect was off, so everything after was lost' : ''}.`)
if (deadZones.length) verdictLines.push(`${deadZones.length} stretch(es) of 30 s+ with speech but no transcript.`)
if (refIsTimed && windows.length > 2) {
  const valid = windows.filter((w) => w.errors?.refWords > 50)
  const firstThird = valid.slice(0, Math.ceil(valid.length / 3))
  const lastThird = valid.slice(-Math.ceil(valid.length / 3))
  const avg = (ws) => ws.reduce((a, w) => a + w.errors.wer, 0) / (ws.length || 1)
  if (valid.length > 2 && avg(lastThird) - avg(firstThird) > 0.05) verdictLines.push(`Accuracy drifts: WER ${pct(avg(firstThird))} early vs ${pct(avg(lastThird))} late.`)
}
if (firesScored.spurious.length) verdictLines.push(`${firesScored.spurious.length} scripture(s) would have gone live that the preacher didn't cite.`)
if (persisted && persisted.kept !== null && persisted.kept < 0.95) verdictLines.push(`The saved session keeps only ${pct(persisted.kept)} of the words shown live.`)
if (events.some((e) => e.ev === 'close-timeout')) verdictLines.push('The engine was still catching up when the run ended, so the last lines may be missing. Use --speed 1.')
if (!verdictLines.length) verdictLines.push('No reliability problems found in this run.')

const md = []
md.push(`# Transcription bench: ${meta.audio}`)
md.push('')
md.push(`Engine **${meta.engine}**, ${fmt(total)} of audio at ${meta.speed}x${meta.noise ? `, noise ${meta.noise}` : ''}, run ${meta.startedAt.slice(0, 16).replace('T', ' ')} UTC.`)
if (meta.faults && (meta.faults.pauses.length || meta.faults.stalls.length || meta.faults.drops.length)) {
  md.push(`Faults: ${[
    ...meta.faults.pauses.map((p) => `pause at ${fmt(p.at)} for ${fmt(p.for)}`),
    ...meta.faults.stalls.map((p) => `stall at ${fmt(p.at)} for ${p.for}s`),
    ...meta.faults.drops.map((d) => `drop at ${fmt(d)}`),
  ].join(', ')}. Reconnect: ${meta.reconnectAfter === null ? 'off' : `after ${meta.reconnectAfter}s`}.`)
}
md.push('')
md.push('## Verdict')
md.push('')
for (const l of verdictLines) md.push(`- ${l}`)
md.push('')
md.push('## Accuracy')
md.push('')
md.push('| Measure | Result |')
md.push('|---|---|')
md.push(`| Word error rate | **${pct(overall.wer)}** (${overall.substitutions} wrong, ${overall.deletions} missed, ${overall.insertions} extra, of ${overall.refWords} words) |`)
md.push(`| Bible book names heard | ${pct(books.recall)} (${books.found}/${books.expected}) |`)
md.push(`| Church vocabulary heard | ${pct(vocab.recall)} (${vocab.found}/${vocab.expected}) |`)
md.push(`| Scriptures detected, exact verse | ${pct(scripture.recallExact)} of ${expectedRefs.length} (${refsSource}) |`)
md.push(`| Scriptures detected, right chapter | ${pct(scripture.recallChapter)} |`)
md.push(`| Detections that were real citations | ${pct(scripture.precision)} (${detected.length} detected) |`)
md.push(`| Auto-live: correct / wrong slides | ${fires.length - firesScored.spurious.length} / ${firesScored.spurious.length} |`)
if (refLatencies.length) md.push(`| Scripture detection delay | p50 ${sec(percentile(refLatencies, 50))}, p95 ${sec(percentile(refLatencies, 95))} |`)
if (finalLatencies.length) md.push(`| Line finalised after speech | p50 ${sec(percentile(finalLatencies.map((l) => l.v), 50))}, p95 ${sec(percentile(finalLatencies.map((l) => l.v), 95))} |`)
if (persisted) md.push(`| Saved session vs shown live | ${pct(persisted.kept)} of words kept, saved WER ${pct(persisted.errors.wer)} |`)
md.push('')
md.push('## Staying power')
md.push('')
md.push('| Measure | Result |')
md.push('|---|---|')
md.push(`| Connected | ${pct(coverage)} of the service (${fmt(connectedSeconds)})${pausedSeconds ? `, ${fmt(pausedSeconds)} paused on purpose` : ''} |`)
md.push(`| Sessions opened | ${sessions.length} |`)
md.push(`| Unexpected disconnects | ${unexpectedCloses.length}${unexpectedCloses.length ? ` (${unexpectedCloses.map((e) => `${fmt(e.a)} code ${e.code}`).join(', ')})` : ''} |`)
md.push(`| Errors from the service | ${errors.length}${errors.length ? ` (${[...new Set(errors.map((e) => e.message ?? e.type))].join('; ')})` : ''} |`)
md.push(`| Finished lines | ${finals.length} |`)
md.push(`| 30 s+ gaps with speech | ${deadZones.length ? deadZones.map((d) => `${fmt(d.from)}–${fmt(d.to)}`).join(', ') : 'none'} |`)
md.push('')
md.push(`## Over the service (${windowSec / 60}-minute windows)`)
md.push('')
md.push(`| Window | ${refIsTimed ? 'WER | ' : ''}Lines | ${finalLatencies.length ? 'Latency p50 / p95 | ' : ''}Disconnects | Errors |`)
md.push(`|---|${refIsTimed ? '---|' : ''}---|${finalLatencies.length ? '---|' : ''}---|---|`)
for (const w of windows) {
  md.push(`| ${fmt(w.from)}–${fmt(w.to)} | ${refIsTimed ? `${w.errors.refWords ? pct(w.errors.wer) : '(no speech)'} | ` : ''}${w.finals} | ${finalLatencies.length ? `${sec(w.latencyP50)} / ${sec(w.latencyP95)} | ` : ''}${w.closes} | ${w.errors_} |`)
}
md.push('')
if (scripture.rows.length) {
  md.push('## Scriptures')
  md.push('')
  md.push('| Said at | Reference | Result | Delay |')
  md.push('|---|---|---|---|')
  for (const r of scripture.rows) md.push(`| ${fmt(r.t)} | ${r.displayLabel} | ${r.kind === 'missed' ? '**missed**' : r.kind === 'chapter' ? `chapter only (${r.detectedAs})` : 'exact'} | ${sec(r.latency)} |`)
  md.push('')
}
if (firesScored.spurious.length) {
  md.push('Wrong scriptures that would have gone live:')
  md.push('')
  for (const f of firesScored.spurious) md.push(`- ${fmt(f.t)} ${f.displayLabel}`)
  md.push('')
}
const missedTerms = [...books.missed, ...vocab.missed].sort((a, b) => b.expected - b.heard - (a.expected - a.heard)).slice(0, 15)
if (missedTerms.length) {
  md.push('Words most often missed: ' + missedTerms.map((m) => `${m.term} (${m.heard}/${m.expected})`).join(', '))
  md.push('')
}
if (!refIsTimed) md.push('_Reference has no timings, so per-window WER and scripture delay are skipped. Use .srt or .vtt for those._')
if (!finalLatencies.length) md.push('_The cow engine gets no word timings from the proxy, so line latency is only measurable on the deepgram engine._')

const report = md.join('\n')
writeFileSync(join(runDir, 'report.md'), report + '\n')
writeFileSync(join(runDir, 'report.json'), JSON.stringify({
  meta, overall, books, vocab, coverage, connectedSeconds, sessions, unexpectedCloses, errors, deadZones, windows,
  scripture: { source: refsSource, ...scripture }, autoLive: { fires, wrong: firesScored.spurious }, persisted,
  latency: finalLatencies.length ? { p50: percentile(finalLatencies.map((l) => l.v), 50), p95: percentile(finalLatencies.map((l) => l.v), 95) } : null,
}, null, 2))
console.log(report)
console.log(`\nSaved ${join(runDir, 'report.md')} and report.json`)
