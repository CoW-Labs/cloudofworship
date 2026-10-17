"""Task A1 run inside a Claude Code session (no API key): chunked inputs for
workflow agents, a validator they run on their own answers, and a collector
that writes the same results files as the Batch API path, so a3_combine.py
works unchanged.

Usage:
  python -I scripts/a1_session.py build --set review --chunks 10
  python -I scripts/a1_session.py validate --set review --chunk 3
  python -I scripts/a1_session.py collect --set review
"""
import argparse
import collections
import json
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from a1_language_id import SYSTEM, pick
from common import OUT, RAW, save_json, song_id

DIR = RAW / "a1-session"
CLIP = 3000
ANSWER_FORMAT = """Write your answers to {out} as a JSON array, one object per song block, in any order:
  {{"gid": "<the block's gid>", "code": "<ISO 639-3>", "name": "<English name>",
    "otherLanguages": [{{"code": "eng", "name": "English", "share": 0.2}}],
    "confidence": "high|medium|low", "isEnglishOnly": false, "isNotASong": false,
    "notes": "<one short sentence: telling words, anything odd>"}}
Use "und"/"Undetermined" only when the lyrics give no usable evidence."""


def block(gid, s):
    hint = s.get("artistRegionHint")
    lyr = s["lyrics"]
    cut = f"\n[…shortened: first {CLIP} of {len(lyr)} characters]" if len(lyr) > CLIP else ""
    return (f"## gid: {gid}\ntitle: {s.get('title') or ''}\nartist: {s.get('artist') or ''}\n"
            f"artist_region_hint: {hint['region'] + ' (often sung there: ' + hint['languagesCommonlySung'] + ')' if hint else 'none'}\n"
            f"church_location_hint: {s.get('churchLocationHint') or 'none'}\n<lyrics>\n{lyr[:CLIP]}{cut}\n</lyrics>\n")


def build(set_name, chunks):
    groups = collections.OrderedDict()
    for s in pick(set_name):
        groups.setdefault(s.get("copyGroup") or song_id(s), []).append(s)
    items = list(groups.items())
    # balance by characters so no agent gets all the long songs
    items.sort(key=lambda kv: -min(len(kv[1][0]["lyrics"]), CLIP))
    bins = [[] for _ in range(chunks)]
    sizes = [0] * chunks
    for gid, ss in items:
        k = sizes.index(min(sizes))
        bins[k].append((gid, ss))
        sizes[k] += min(len(ss[0]["lyrics"]), CLIP) + 300
    DIR.mkdir(parents=True, exist_ok=True)
    members, manifest = {}, []
    for k, b in enumerate(bins):
        out = DIR / f"{set_name}-{k:02d}-answers.json"
        head = (f"# Language identification, chunk {k:02d} of {chunks}: {len(b)} songs\n\n"
                f"## Instructions\n\n{SYSTEM}\n\n## Answer format\n\n{ANSWER_FORMAT.format(out=out)}\n\n## Songs\n\n")
        text = head + "\n".join(block(gid, ss[0]) for gid, ss in b)
        path = DIR / f"{set_name}-{k:02d}.md"
        path.write_text(text, encoding="utf-8")
        for gid, ss in b:
            members[f"a1-{gid}"[:64]] = [song_id(x) for x in ss]
        manifest.append({"chunk": k, "songs": len(b), "chars": len(text), "input": str(path), "answers": str(out)})
    save_json(RAW / f"a1-{set_name}-members.json", members)
    save_json(DIR / f"{set_name}-manifest.json", manifest)
    for m in manifest:
        print(m["chunk"], m["songs"], m["chars"])


def gids_in(path):
    return re.findall(r"^## gid: (\S+)$", path.read_text(encoding="utf-8"), re.M)


def check(set_name, k):
    want = gids_in(DIR / f"{set_name}-{k:02d}.md")
    path = DIR / f"{set_name}-{k:02d}-answers.json"
    problems = []
    try:
        ans = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        return want, ["answers file missing"], {}
    except json.JSONDecodeError as e:
        return want, [f"not valid JSON: {e}"], {}
    got = {}
    for a in ans:
        g = a.get("gid")
        if g in got:
            problems.append(f"{g}: answered twice")
        got[g] = a
        if not re.fullmatch(r"[a-z]{3}", str(a.get("code", ""))):
            problems.append(f"{g}: code must be 3 lowercase letters, got {a.get('code')!r}")
        if a.get("confidence") not in ("high", "medium", "low"):
            problems.append(f"{g}: confidence must be high, medium or low")
        for f in ("isEnglishOnly", "isNotASong"):
            if not isinstance(a.get(f), bool):
                problems.append(f"{g}: {f} must be true or false")
        if not isinstance(a.get("otherLanguages"), list):
            problems.append(f"{g}: otherLanguages must be a list")
        if not a.get("notes"):
            problems.append(f"{g}: notes missing")
    missing = [g for g in want if g not in got]
    extra = [g for g in got if g not in set(want)]
    if missing:
        problems.append(f"{len(missing)} songs not answered: {', '.join(missing[:20])}")
    if extra:
        problems.append(f"{len(extra)} gids not in this chunk: {', '.join(map(str, extra[:20]))}")
    return want, problems, got


def validate(set_name, k):
    want, problems, got = check(set_name, k)
    if problems:
        print("INVALID")
        print("\n".join(problems[:60]))
        sys.exit(1)
    c = collections.Counter(a["confidence"] for a in got.values())
    print(f"VALID: {len(got)} of {len(want)} answered; confidence {dict(c)}")


def collect(set_name):
    manifest = json.load(open(DIR / f"{set_name}-manifest.json"))
    rows, summary = [], collections.Counter()
    for m in manifest:
        want, problems, got = check(set_name, m["chunk"])
        if problems:
            summary["chunks with problems"] += 1
            print(f"chunk {m['chunk']:02d}:", problems[:3])
        for g in want:
            a = got.get(g)
            cid = f"a1-{g}"[:64]
            if not a:
                rows.append({"custom_id": cid, "status": "missing"})
                summary["missing"] += 1
                continue
            rows.append({"custom_id": cid, "status": "succeeded", "output": {
                "primaryLanguage": {"code": a["code"], "name": a.get("name", a["code"])},
                "otherLanguages": a.get("otherLanguages", []), "confidence": a["confidence"],
                "isEnglishOnly": a["isEnglishOnly"], "isNotASong": a["isNotASong"], "notes": a.get("notes", "")}})
            summary["answered"] += 1
    with open(RAW / f"a1-{set_name}-results.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(dict(summary))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["build", "validate", "collect"])
    ap.add_argument("--set", default="review")
    ap.add_argument("--chunks", type=int, default=10)
    ap.add_argument("--chunk", type=int)
    a = ap.parse_args()
    {"build": lambda: build(a.set, a.chunks), "validate": lambda: validate(a.set, a.chunk),
     "collect": lambda: collect(a.set)}[a.step]()
