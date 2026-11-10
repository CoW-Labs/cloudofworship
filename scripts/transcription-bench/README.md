# Transcription bench

Plays a recorded service into sermon transcription in real time, then scores
what came back against a correct transcript.

- **Accuracy:** word error rate (WER), Bible book names, church vocabulary,
  scriptures detected, and wrong scriptures that would have gone live.
- **Staying power:** time connected, disconnects, errors, gaps of 30 s or
  more with speech but no text, latency, and whether accuracy or latency
  slips later in the service.

## 1. Get a reference

You need one real service recording (60 to 90 minutes, recorded from the
desk mic if you can) and a **correct** transcript of it.

- Best: an `.srt` or `.vtt` file with timings, so results come per window.
  Get a draft from any transcription tool, then fix it by hand. Auto
  captions are not correct enough to score against.
- Optional `scriptures.txt` file: one citation per line, as `MM:SS John 3:16`.
  Without it, the citations are read out of the reference transcript.
- Optional `terms.txt` file: names that must come through (pastor, church,
  local-language words).

## 2. Run it

**Deepgram direct.** Uses the proxy's settings and the API's own parser.
The cost is about a dollar per 90 minutes and nothing comes off any church's
allowance. Word timings make the latency figures exact.

```bash
node scripts/transcription-bench/run.mjs --audio service.mp3 --engine deepgram --label baseline
```

**Through the app's proxy.** This tests the full path the operator window
uses. It needs a test church with Teams minutes left, and a 90-minute run
spends 90 of them.

```bash
COW_API_URL=http://localhost:4500/api/v1 COW_TOKEN=… COW_CHURCH_ID=… \
  node scripts/transcription-bench/run.mjs --audio service.mp3 --engine cow --check-persisted
```

**Stress runs.** Fault times are positions in the recording:

```bash
# a pause, a network stall, and a mid-sermon drop; reconnects like the app
node scripts/transcription-bench/run.mjs --audio service.mp3 --pause 25m+4m --stall 50m+20s --drop 65m --label faults

# the same with reconnect off, to see what a drop costs without it
node scripts/transcription-bench/run.mjs --audio service.mp3 --pause 25m+4m --stall 50m+20s --drop 65m --reconnect-after off --label no-reconnect

# a noisy hall
node scripts/transcription-bench/run.mjs --audio service.mp3 --noise 0.03 --label noisy
```

Keep `--speed 1` for staying-power and latency results. Faster runs are only
for a quick accuracy check, because Deepgram falls behind when audio arrives
faster than real time. Use `--start 20m --duration 10m` to try a slice.

## 3. Score it

```bash
node scripts/transcription-bench/score.mjs bench-runs/<run> --ref service.srt --refs scriptures.txt --terms terms.txt
```

The scorer writes `report.md` and `report.json` into the run folder, which
lives under `bench-runs/` and is ignored by git. To compare runs, score each
one against the same reference.

## Notes

- The `cow` engine gets no word timings from the proxy, so it can measure
  scripture delay (with a timed reference) but not line latency.
- `--check-persisted` fetches the saved sessions afterwards, so the score
  shows how much of what the operator saw actually reached storage.
- The scoring helpers are covered by `tests/transcription-bench-metrics.test.ts`.
