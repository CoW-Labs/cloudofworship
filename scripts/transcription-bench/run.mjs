#!/usr/bin/env node
/**
 * Streams a recorded service into sermon transcription in real time, the
 * way the operator window does (16 kHz mono linear16 in 32 ms chunks), and
 * logs every message with the audio clock so score.mjs can measure accuracy
 * and how the session holds up over a full service.
 *
 *   node scripts/transcription-bench/run.mjs --audio service.mp3 --engine cow
 *   node scripts/transcription-bench/run.mjs --audio service.mp3 --engine deepgram --speed 2
 *
 * Engines:
 *   cow       the app's own WebSocket proxy (/church/:id/transcription/stream).
 *             Needs COW_API_URL, COW_TOKEN and COW_CHURCH_ID. Spends the
 *             church's transcription allowance, so point it at a local or
 *             staging API with a test church.
 *   deepgram  Deepgram directly with the proxy's settings and the API's own
 *             reference parser. Needs DEEPGRAM_API_KEY (or reads it from the
 *             API repo's .env). Also returns word timings, so latency is exact.
 *
 * Faults (times are positions in the recording, e.g. 45m, 1h02m, 90s):
 *   --pause 30m+4m      operator pauses for 4 minutes; that audio is skipped
 *   --stall 50m+20s     network stalls for 20 s, then the backlog flushes
 *   --drop 60m          the socket closes mid-service
 *   --speed 1           keep at 1 for latency and staying-power numbers;
 *                       faster runs are fine for a quick accuracy check
 *   --reconnect-after 1 after a drop or unexpected close, open a fresh
 *                       session this many seconds later, holding up to 30 s
 *                       of audio for it, as the app does (default 1). Pass
 *                       "off" to see what a client without reconnect loses.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, openSync, readSync, closeSync, statSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    audio: { type: 'string' },
    engine: { type: 'string', default: 'deepgram' },
    out: { type: 'string' },
    speed: { type: 'string', default: '1' },
    start: { type: 'string' },
    duration: { type: 'string' },
    noise: { type: 'string' },
    pause: { type: 'string', multiple: true, default: [] },
    stall: { type: 'string', multiple: true, default: [] },
    drop: { type: 'string', multiple: true, default: [] },
    'reconnect-after': { type: 'string', default: '1' },
    tail: { type: 'string', default: '2' },
    'close-timeout': { type: 'string', default: '60' },
    'check-persisted': { type: 'boolean', default: false },
    label: { type: 'string' },
  },
})

const API_DIR = process.env.COW_API_DIR || join(homedir(), 'nodeProjects/minimalist-church-presentation-software-api')
const SAMPLE_RATE = 16000
const BYTES_PER_SECOND = SAMPLE_RATE * 2
const CHUNK_BYTES = 1024 // 512 samples = 32 ms, the AudioWorklet's chunk size
const REFERENCE_DEDUPE_TTL_MS = 4000
// Mirrors useDeepgramTranscription: audio held while reconnecting, and the
// close codes the API uses when it ends a session on purpose.
const MAX_HELD_BYTES = 30 * BYTES_PER_SECOND
const DELIBERATE_CLOSE_CODES = [4001, 4002]

const die = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1) }

/** "1h02m", "45m", "90s", "1:30:00", "75" (seconds) → seconds. */
const dur = (v) => {
  if (v === undefined) return undefined
  if (/^[\d:.]+$/.test(v)) return v.split(':').map(Number).reduce((a, p) => a * 60 + p, 0)
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (!m || !v) die(`Can't read duration "${v}"`)
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)
}
const spanArg = (v) => { const [a, b] = v.split('+'); if (!b) die(`Write faults as AT+FOR, e.g. 30m+4m (got "${v}")`); return { at: dur(a), for: dur(b) } }
const fmt = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

if (!args.audio) die('Pass --audio <file> (any format ffmpeg reads)')
if (!existsSync(args.audio)) die(`No such file: ${args.audio}`)
if (!['cow', 'deepgram'].includes(args.engine)) die('--engine must be cow or deepgram')

const speed = Number(args.speed)
const faults = {
  pauses: args.pause.map(spanArg),
  stalls: args.stall.map(spanArg),
  drops: args.drop.map(dur),
}
const reconnectAfter = args['reconnect-after'] === 'off' ? undefined : dur(args['reconnect-after'])

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = resolve(args.out || join('bench-runs', `${stamp}-${args.engine}${args.label ? `-${args.label}` : ''}`))
mkdirSync(outDir, { recursive: true })
const logPath = join(outDir, 'run.jsonl')
writeFileSync(logPath, '')

// ── Audio: decode once to raw PCM so pacing never waits on ffmpeg ─────────
const pcmPath = join(outDir, 'audio.pcm')
await new Promise((ok, fail) => {
  const ff = ['-hide_banner', '-loglevel', 'error', '-y']
  if (args.start) ff.push('-ss', String(dur(args.start)))
  if (args.duration) ff.push('-t', String(dur(args.duration)))
  ff.push('-i', args.audio)
  if (args.noise) {
    // Pink noise under the speech, e.g. --noise 0.02 for a busy hall.
    ff.push('-filter_complex',
      `[0:a]aresample=${SAMPLE_RATE},pan=mono|c0=c0[s];anoisesrc=r=${SAMPLE_RATE}:a=${Number(args.noise)}:c=pink[n];[s][n]amix=inputs=2:duration=first:normalize=0`)
  }
  ff.push('-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', pcmPath)
  const p = spawn('ffmpeg', ff, { stdio: ['ignore', 'inherit', 'inherit'] })
  p.on('error', () => fail(new Error('ffmpeg not found on PATH')))
  p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))))
}).catch((e) => die(e.message))

const totalBytes = statSync(pcmPath).size
const totalSeconds = totalBytes / BYTES_PER_SECOND
const fd = openSync(pcmPath, 'r')

// ── Logging ───────────────────────────────────────────────────────────────
const t0 = performance.now()
let audioPos = 0 // bytes of the recording consumed (sent or skipped)
const wallMs = () => Math.round(performance.now() - t0)
const audioSec = () => audioPos / BYTES_PER_SECOND
const log = (ev, data = {}) => appendFileSync(logPath, JSON.stringify({ ev, w: wallMs(), a: +audioSec().toFixed(3), ...data }) + '\n')

log('meta', {
  engine: args.engine,
  audio: basename(args.audio),
  totalSeconds,
  speed,
  noise: args.noise ? Number(args.noise) : null,
  faults,
  reconnectAfter: reconnectAfter ?? null,
  startedAt: new Date().toISOString(),
})

// ── Engines ───────────────────────────────────────────────────────────────
// Both expose the proxy's message shapes, so the scorer reads one format.

const readEnv = (file, key) => {
  try { return readFileSync(file, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '') } catch { return undefined }
}

let parseBibleReferences
let keyterms = []
const loadApiParser = async () => {
  try {
    ;({ parseBibleReferences } = await import(pathToFileURL(join(API_DIR, 'src/modules/transcription/bibleReferenceParser.js')).href))
    ;({ transcriptionKeyterms: keyterms } = await import(pathToFileURL(join(API_DIR, 'src/modules/transcription/bibleBooks.js')).href))
  } catch {
    die(`Couldn't load the API's reference parser from ${API_DIR}. Set COW_API_DIR.`)
  }
}

const openCow = () => {
  const base = process.env.COW_API_URL
  const token = process.env.COW_TOKEN
  const church = process.env.COW_CHURCH_ID
  if (!base || !token || !church) die('cow engine needs COW_API_URL (…/api/v1), COW_TOKEN and COW_CHURCH_ID')
  const url = `${base.replace(/^http/, 'ws')}/church/${church}/transcription/stream?token=${token}`
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'
  return {
    ws,
    onMessage: (raw, emit) => emit(JSON.parse(raw)),
    pause: () => ws.send(JSON.stringify({ type: 'Pause' })),
    resume: () => ws.send(JSON.stringify({ type: 'Resume' })),
    keepAlive: () => ws.send(JSON.stringify({ type: 'KeepAlive' })),
    // Matches stopTranscription(): the client closes straight away.
    finish: () => ws.close(1000),
    readyOnOpen: false,
  }
}

const openDeepgram = () => {
  const key = process.env.DEEPGRAM_API_KEY || readEnv(join(API_DIR, '.env'), 'DEEPGRAM_ACCESS_TOKEN')
  if (!key) die('deepgram engine needs DEEPGRAM_API_KEY')
  // Keep in step with deepgram.listen.v1.createConnection in the API's
  // src/modules/transcription/routes.js.
  const q = new URLSearchParams({
    model: 'nova-3', language: 'en', encoding: 'linear16', sample_rate: String(SAMPLE_RATE), channels: '1',
    interim_results: 'true', punctuate: 'true', smart_format: 'true', numerals: 'true', filler_words: 'false',
    endpointing: '300', utterance_end_ms: '1000',
  })
  for (const term of keyterms) q.append('keyterm', term)
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${q}`, ['token', key])
  ws.binaryType = 'arraybuffer'
  const emitted = new Map()
  return {
    ws,
    onMessage: (raw, emit) => {
      const data = JSON.parse(raw)
      if (data.type !== 'Results') return
      const transcript = data.channel?.alternatives?.[0]?.transcript
      if (!transcript) return
      const isFinal = !!data.is_final
      const speechFinal = !!data.speech_final
      emit({ type: 'transcript', transcript, isFinal, speechFinal, start: data.start, duration: data.duration })
      // Same dedupe as the proxy's shouldEmitReferences.
      const now = Date.now()
      for (const [k, at] of emitted) if (now - at > REFERENCE_DEDUPE_TTL_MS) emitted.delete(k)
      const references = parseBibleReferences(transcript)
      const fresh = references.filter((r) => !emitted.has(r.shortLabel))
      if (!fresh.length) return
      fresh.forEach((r) => emitted.set(r.shortLabel, now))
      emit({ type: 'references', references, isFinal, speechFinal, provisional: !(isFinal || speechFinal) })
    },
    pause: () => {},
    resume: () => {},
    keepAlive: () => ws.send(JSON.stringify({ type: 'KeepAlive' })),
    finish: () => ws.send(JSON.stringify({ type: 'CloseStream' })),
    readyOnOpen: true,
  }
}

if (args.engine === 'deepgram') await loadApiParser()

// ── Session lifecycle ─────────────────────────────────────────────────────
let session = null
let sessionNo = 0
let ready = false
let finished = false
let reconnectAt = null
let reconnecting = false
let held = [] // [{ startByte, buf }] captured while reconnecting
let heldBytes = 0
const stats = { finals: 0, refs: 0, errors: 0, sessions: 0, lastLatency: null }

const connect = () => new Promise((resolveReady) => {
  sessionNo++
  ready = false
  const s = args.engine === 'cow' ? openCow() : openDeepgram()
  // Deepgram's timestamps count only audio this session received, so keep
  // where each unbroken run of sent audio sits in the recording.
  s.sentBytes = 0
  s.lastEnd = null
  s.runs = []
  session = s
  const myNo = sessionNo
  log('connect', { session: myNo })

  const emit = (msg) => {
    if (msg.start !== undefined) {
      const sentSec = msg.start
      const run = [...s.runs].reverse().find((r) => r.sentSec <= sentSec + 1e-6) ?? s.runs[0]
      if (run) msg.at = +(run.audioSec + (sentSec - run.sentSec)).toFixed(3)
    }
    if (msg.type === 'ready') {
      ready = true
      stats.sessions++
      if (reconnecting) {
        reconnecting = false
        const chunks = held
        held = []
        heldBytes = 0
        log('flush-held', { session: myNo, seconds: chunks.reduce((n, c) => n + c.buf.length, 0) / BYTES_PER_SECOND })
        for (const c of chunks) sendChunk(c.startByte, c.buf)
      }
      resolveReady(true)
    }
    if (msg.type === 'transcript' && (msg.isFinal || msg.speechFinal)) {
      stats.finals++
      if (msg.at !== undefined) stats.lastLatency = audioSec() - (msg.at + msg.duration)
    }
    if (msg.type === 'references') stats.refs++
    if (msg.type === 'error') stats.errors++
    log('msg', { session: myNo, ...msg })
  }

  s.ws.onopen = () => {
    log('open', { session: myNo })
    if (s.readyOnOpen) emit({ type: 'ready' })
  }
  s.ws.onmessage = (e) => {
    try { s.onMessage(typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString(), emit) } catch (err) { log('parse-error', { message: String(err) }) }
  }
  s.ws.onerror = (e) => { stats.errors++; log('ws-error', { session: myNo, message: e?.message ?? 'error' }) }
  s.ws.onclose = (e) => {
    log('close', { session: myNo, code: e.code, reason: e.reason, expected: finished || s.closingOnPurpose })
    resolveReady(false)
    if (session !== s) return
    ready = false
    session = null
    if (!finished && !s.closingOnPurpose) {
      console.log(`\n⚠ session ${myNo} closed at ${fmt(audioSec())} (code ${e.code}${e.reason ? `, ${e.reason}` : ''})`)
    }
    if (finished || reconnectAfter === undefined || DELIBERATE_CLOSE_CODES.includes(e.code)) return
    reconnecting = true
    reconnectAt = performance.now() + reconnectAfter * 1000
  }
})

const opened = await connect()
if (!opened) die('Could not open a transcription session (see run.jsonl)')

// ── Real-time pump ────────────────────────────────────────────────────────
// Every tick sends whatever audio is due by the wall clock, so a stall
// naturally ends in a burst, as a browser's socket buffer would.
const chunk = Buffer.alloc(CHUNK_BYTES)
let stalledUntil = 0
let pausedUntilByte = null
let lastSendAt = performance.now()
let nextProgress = 60
const pending = { pauses: [...faults.pauses], stalls: [...faults.stalls], drops: [...faults.drops] }

const sendAudio = (bytes) => {
  while (bytes > 0 && audioPos < totalBytes) {
    const n = readSync(fd, chunk, 0, Math.min(CHUNK_BYTES, bytes, totalBytes - audioPos), audioPos)
    audioPos += n
    bytes -= n
    if (pausedUntilByte !== null) continue // skipped while paused
    const startByte = audioPos - n
    if (session && ready && session.ws.readyState === WebSocket.OPEN) {
      sendChunk(startByte, chunk.subarray(0, n))
    } else if (reconnecting) {
      held.push({ startByte, buf: Buffer.from(chunk.subarray(0, n)) })
      heldBytes += n
      while (heldBytes > MAX_HELD_BYTES && held.length) heldBytes -= held.shift().buf.length
    }
  }
}

function sendChunk(startByte, buf) {
  if (session.lastEnd !== startByte) session.runs.push({ sentSec: session.sentBytes / BYTES_PER_SECOND, audioSec: startByte / BYTES_PER_SECOND })
  session.lastEnd = startByte + buf.length
  session.sentBytes += buf.length
  session.ws.send(buf)
  lastSendAt = performance.now()
}

await new Promise((done) => {
  const tick = () => {
    const now = performance.now()

    // Reconnect; audio from the gap is held and sent once the session is ready.
    if (!session && reconnectAt !== null && now >= reconnectAt) {
      reconnectAt = null
      connect()
    }

    const a = audioSec()
    if (pending.drops.length && a >= pending.drops[0]) {
      pending.drops.shift()
      log('fault', { kind: 'drop' })
      console.log(`\n✂ dropping socket at ${fmt(a)}`)
      session?.ws.close(4000, 'bench drop')
    }
    if (pending.stalls.length && a >= pending.stalls[0].at) {
      const s = pending.stalls.shift()
      log('fault', { kind: 'stall', for: s.for })
      stalledUntil = now + (s.for * 1000) / speed
    }
    if (pending.pauses.length && a >= pending.pauses[0].at && pausedUntilByte === null) {
      const p = pending.pauses.shift()
      log('fault', { kind: 'pause', for: p.for })
      pausedUntilByte = audioPos + p.for * BYTES_PER_SECOND
      if (ready) session.pause()
    }
    if (pausedUntilByte !== null && audioPos >= pausedUntilByte) {
      pausedUntilByte = null
      log('fault', { kind: 'resume' })
      if (ready) session.resume()
    }

    // KeepAlive during pauses and stalls, like the client's 5 s timer.
    if (ready && now - lastSendAt > 5000 && session.ws.readyState === WebSocket.OPEN) {
      session.keepAlive()
      lastSendAt = now
    }

    if (now >= stalledUntil) {
      const dueBytes = Math.floor(((now - t0) / 1000) * speed * BYTES_PER_SECOND)
      const target = Math.min(totalBytes, dueBytes - (dueBytes % 2))
      if (target > audioPos) sendAudio(target - audioPos)
    }

    if (audioSec() >= nextProgress) {
      nextProgress += 60
      const lat = stats.lastLatency === null ? '' : ` latency ${stats.lastLatency.toFixed(2)}s`
      process.stdout.write(`\r${fmt(audioSec())} / ${fmt(totalSeconds)}  finals ${stats.finals}  refs ${stats.refs}  errors ${stats.errors}  sessions ${stats.sessions}${lat}${session ? '' : '  [DISCONNECTED]'}   `)
    }

    if (audioPos >= totalBytes) return done()
    setTimeout(tick, 20)
  }
  tick()
})
closeSync(fd)

// ── Wind down ─────────────────────────────────────────────────────────────
log('audio-end')
await new Promise((r) => setTimeout(r, Number(args.tail) * 1000))
finished = true
if (session) {
  const s = session
  s.closingOnPurpose = true
  s.finish()
  await new Promise((r) => {
    // Deepgram flushes everything still queued before it closes, which
    // takes a while if a stall or --speed above 1 left it behind.
    const t = setTimeout(() => { log('close-timeout'); r() }, Number(args['close-timeout']) * 1000)
    s.ws.addEventListener('close', () => { clearTimeout(t); r() })
  })
}
log('end')

// The proxy writes is_final && speech_final segments to the session record
// on close. Fetch it so the scorer can compare what was saved to what was shown.
if (args['check-persisted'] && args.engine === 'cow') {
  await new Promise((r) => setTimeout(r, 3000))
  const base = process.env.COW_API_URL
  const headers = { Authorization: `Bearer ${process.env.COW_TOKEN}` }
  const church = process.env.COW_CHURCH_ID
  try {
    const list = await fetch(`${base}/church/${church}/transcription/sessions?limit=${stats.sessions || 1}`, { headers }).then((r) => r.json())
    const details = []
    for (const s of list.data ?? []) details.push(await fetch(`${base}/church/${church}/transcription/sessions/${s._id}`, { headers }).then((r) => r.json()))
    writeFileSync(join(outDir, 'persisted.json'), JSON.stringify(details, null, 2))
  } catch (err) {
    console.log(`\n⚠ couldn't fetch persisted sessions: ${err.message}`)
  }
}

console.log(`\n\n✔ Done. Log: ${logPath}`)
console.log(`  Score it: node scripts/transcription-bench/score.mjs ${outDir} --ref <reference.srt|.vtt|.txt|.json> [--refs scriptures.json]`)
process.exit(0)
