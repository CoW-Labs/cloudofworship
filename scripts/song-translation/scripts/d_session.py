"""Task D, the full translation, run inside a Claude Code session in resumable waves.

Every chunk (about 150 lines, one language) has its own input and answers
file, so finished work is on disk the moment an agent validates it. `collect`
can run at any time and merges every valid song so far, plus the pilot, into
outputs/translations.json. `build` skips songs already done, so a stopped run
resumes by building a new wave.

Usage:
  python -I scripts/d_session.py build --wave w1 [--lines 150]
  python -I scripts/d_session.py validate --chunk w1-0007
  python -I scripts/d_session.py collect
"""
import argparse
import collections
import json
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from c_pilot import SYSTEM_T, check_song, glossary_block, lines_for, skip_lines
from common import OUT, RAW, lines, save_json, songs

DIR = RAW / "d-session"
HARD = {"missing", "not asked for", "answered twice", "blank"}
NAME_TO_CODE = {"Spanish": "spa", "Yoruba": "yor", "Swahili": "swa", "Igbo": "ibo", "Tagalog": "tgl", "Hausa": "hau",
                "Twi": "twi", "Portuguese": "por", "French": "fra", "Indonesian": "ind", "Cebuano": "ceb",
                "Luganda": "lug", "Zulu": "zul", "Kinyarwanda": "kin", "Chichewa": "nya", "Urhobo": "urh"}
EXTRA = """
Additional rules for this run:
- If a song is clearly secular (not worship or church music: e.g. praise of a town, club or patron, love songs, crude or worldly lyrics), do not translate it. Answer {"skipped": "secular", "songNote": "<why>"} for that song id.
- If it is not a song at all (service order, announcement, bank details, Bible reading), answer {"skipped": "not a song", "songNote": "<what it is>"}.
- Translate praise names and titles of God (Oluwa = Lord, Ekwueme, Ebube Dike = Glorious Warrior) as the glossary does; keep as is only names churches leave untranslated (Jehovah, El Shaddai, Hosanna, Hallelujah, Amen) and vocables.
"""
T_FORMAT = """Write {out} as one JSON object keyed by song id:
  {{"<song id>": {{"lines": [{{"i": 3, "english": "...", "confidence": "high|medium|low", "note": ""}}, ...],
                  "language": "<language name>", "isNotASong": false, "songNote": ""}},
    "<other song id>": {{"skipped": "secular", "songNote": "..."}}, ...}}
One entry in "lines" per index listed under that song's lines_to_translate, no others."""


def labels():
    p = OUT / "language-labels.json"
    out = {}
    if p.exists():
        for r in json.load(open(p))["songs"]:
            out[r["id"]] = r
    return out


def done_ids():
    """Songs already finished: pilot songs plus every song that passes in a chunk answers file."""
    done = set()
    pilot = RAW / "c-translate-pilot-results.jsonl"
    if pilot.exists():
        for line in open(pilot, encoding="utf-8"):
            r = json.loads(line)
            if r.get("output"):
                done.add(r["custom_id"][3:])
    for m in manifests():
        for sid, _ in valid_songs(m):
            done.add(sid)
    return done


def manifests():
    out = []
    for p in sorted(DIR.glob("*-manifest.json")):
        out += json.load(open(p))
    return out


def build(wave, max_lines):
    W = songs("translation-worklist.json")
    lab = labels()
    skip = skip_lines()
    done = done_ids()
    seen_groups = set()
    todo, skipped = [], collections.Counter()
    # database songs first (churches already use them), then imports
    for s in sorted(W, key=lambda s: (s["source"] != "database", s["id"])):
        r = lab.get(s["id"])
        if s["copyGroup"] in seen_groups:
            skipped["copy of another song"] += 1
            continue
        seen_groups.add(s["copyGroup"])
        if s["id"] in done:
            skipped["already done"] += 1
            continue
        if "original lyrics missing" in s["status"]:
            skipped["original lyrics missing"] += 1
            continue
        if r and r["decision"] in ("not a song", "English only"):
            skipped[r["decision"]] += 1
            continue
        if not lines_for(s, skip):
            skipped["nothing left to translate"] += 1
            continue
        code = (r["language"]["code"] if r and r.get("language") else None) or NAME_TO_CODE.get(s["language"]) \
            or ("nonlatin" if s["language"] == "Non-Latin script" else "unknown")
        todo.append((code, s))
    # chunk by language, keep database-first order inside each language
    by_code = collections.defaultdict(list)
    for code, s in todo:
        by_code[code].append(s)
    chunks = []
    for code, ss in by_code.items():
        cur, n = [], 0
        for s in ss:
            k = len(lines_for(s, skip))
            if cur and n + k > max_lines:
                chunks.append((code, cur))
                cur, n = [], 0
            cur.append(s)
            n += k
        if cur:
            chunks.append((code, cur))
    chunks.sort(key=lambda c: (c[1][0]["source"] != "database", -len(by_code[c[0]])))
    DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for k, (code, ss) in enumerate(chunks):
        cid = f"{wave}-{k:04d}"
        out = DIR / f"{cid}-answers.json"
        text = (f"# Translation chunk {cid}: {len(ss)} songs, language {code}\n\n## Instructions\n\n{SYSTEM_T}\n{EXTRA}\n"
                f"## Answer format\n\n{T_FORMAT.format(out=out)}\n\n## Glossary and examples for {code}\n\n"
                f"{glossary_block(code)}\n\n")
        for s in ss:
            todo_lines = lines_for(s, skip)
            text += (f"## song id: {s['id']}\n<song>\n<title>{s['title']}</title>\n<artist>{s['artist'] or ''}</artist>\n"
                     f"<language_label>{code}</language_label>\n<lyrics>\n{s['lyrics']}\n</lyrics>\n</song>\n"
                     "<lines_to_translate>\n" + "\n".join(f'{l["i"]}\t{l["text"]}' for l in todo_lines)
                     + "\n</lines_to_translate>\n\n")
        (DIR / f"{cid}.md").write_text(text, encoding="utf-8")
        manifest.append({"chunk": cid, "code": code, "songs": [s["id"] for s in ss], "answers": str(out),
                         "lines": sum(len(lines_for(s, skip)) for s in ss), "chars": len(text)})
    save_json(DIR / f"{wave}-manifest.json", manifest)
    print(f"wave {wave}: {len(manifest)} chunks, {len(todo)} songs, {sum(m['lines'] for m in manifest)} lines")
    print("not in this wave:", dict(skipped))
    print("chunk ids:", json.dumps([m["chunk"] for m in manifest]))


def load(path):
    try:
        return json.load(open(path, encoding="utf-8")), None
    except FileNotFoundError:
        return None, "answers file missing"
    except json.JSONDecodeError as e:
        return None, f"not valid JSON: {e}"


_W = None


def worklist():
    global _W
    if _W is None:
        _W = {s["id"]: s for s in songs("translation-worklist.json")}
    return _W


def check_chunk(m):
    """Returns (per-song hard problems, soft problems, answers)."""
    ans, err = load(m["answers"])
    if err:
        return {sid: [err] for sid in m["songs"]}, [], {}
    W, skip = worklist(), skip_lines()
    hard, soft = {}, []
    for sid in m["songs"]:
        a = ans.get(sid)
        h = []
        if isinstance(a, dict) and a.get("skipped") in ("secular", "not a song"):
            hard[sid] = []
            continue
        if not isinstance(a, dict) or not isinstance(a.get("lines"), list):
            hard[sid] = ["missing or has no lines list"]
            continue
        for l in a["lines"]:
            if l.get("confidence") not in ("high", "medium", "low") or not isinstance(l.get("i"), int) \
                    or not isinstance(l.get("english"), str):
                h.append(f"line {l.get('i')}: needs integer i, english text and confidence high/medium/low")
        for x in check_song(W[sid], lines_for(W[sid], skip), a):
            (h.append(str(x)) if x["check"] in HARD else soft.append(f"{sid}: {x}"))
        hard[sid] = h
    return hard, soft, ans


def valid_songs(m):
    hard, _, ans = check_chunk(m)
    return [(sid, ans[sid]) for sid, h in hard.items() if not h and sid in ans]


def validate(chunk):
    m = next(x for x in manifests() if x["chunk"] == chunk)
    hard, soft, _ = check_chunk(m)
    for s in soft[:40]:
        print("CHECK", s)
    bad = {sid: h for sid, h in hard.items() if h}
    if bad:
        print("INVALID")
        for sid, h in list(bad.items())[:30]:
            print(sid, h[:5])
        sys.exit(1)
    print(f"VALID ({len(soft)} soft checks: fix them or explain in the line's note)")


def collect():
    W, skip = worklist(), skip_lines()
    copies = collections.defaultdict(list)
    for s in W.values():
        copies[s["copyGroup"]].append(s["id"])
    result, origin = {}, {}
    pilot = RAW / "c-translate-pilot-results.jsonl"
    if pilot.exists():
        for line in open(pilot, encoding="utf-8"):
            r = json.loads(line)
            if r.get("output"):
                result[r["custom_id"][3:]] = r["output"]
                origin[r["custom_id"][3:]] = "pilot"
    chunks_done = chunks_total = 0
    for m in manifests():
        chunks_total += 1
        v = valid_songs(m)
        if len(v) == len(m["songs"]):
            chunks_done += 1
        for sid, a in v:
            result[sid] = a
            origin[sid] = m["chunk"]
    out = {}
    stats = collections.Counter()
    for sid, a in result.items():
        s = W[sid]
        src = dict(enumerate(lines(s["lyrics"])))
        if a.get("skipped"):
            rec = {"status": f"skipped: {a['skipped']}", "songNote": a.get("songNote", "")}
            stats[f"skipped {a['skipped']}"] += 1
        else:
            rec = {"status": "translated", "language": a.get("language"), "songNote": a.get("songNote", ""),
                   "lines": [{"i": l["i"], "source": src.get(l["i"], ""), "english": l["english"],
                              "confidence": l["confidence"], "note": l.get("note", "")} for l in a["lines"]]}
            stats["songs translated"] += 1
            stats["lines translated"] += len(a["lines"])
            for l in a["lines"]:
                stats[f"lines {l['confidence']}"] += 1
        rec.update({"title": s["title"], "source": s["source"], "copyGroup": s["copyGroup"], "from": origin[sid]})
        for cid in copies[s["copyGroup"]]:
            out[cid] = dict(rec, copyOf=None if cid == sid else sid)
    total_groups = len({s["copyGroup"] for s in W.values()})
    progress = {"songs with a result (incl. copies)": len(out), "worklist songs": len(W),
                "copy groups done": len({r["copyGroup"] for r in out.values()}), "copy groups": total_groups,
                "chunks fully done": chunks_done, "chunks built": chunks_total, **stats}
    save_json(OUT / "translations.json", {"about": "English per song id and line index (i = 0-based line in lyrics). "
                                          "Lyrics are not modified. Copies share their group's translation.",
                                          "progress": progress, "songs": out})
    save_json(OUT / "translations-progress.json", progress)
    print(json.dumps(progress, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["build", "validate", "collect"])
    ap.add_argument("--wave")
    ap.add_argument("--lines", type=int, default=150)
    ap.add_argument("--chunk")
    a = ap.parse_args()
    {"build": lambda: build(a.wave, a.lines), "validate": lambda: validate(a.chunk), "collect": collect}[a.step]()
