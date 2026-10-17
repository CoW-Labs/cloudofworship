"""Task C run inside a Claude Code session: translation chunks grouped by
language (glossary shown once per language), a validator that runs the code
checks, independent review chunks that show only source and English, and
collectors that write the same results files as the Batch API path, so
`c_pilot.py check` and `c_pilot.py report` work unchanged.

Usage:
  python -I scripts/c_session.py build-translate
  python -I scripts/c_session.py validate-translate --chunk 2
  python -I scripts/c_session.py collect-translate
  python -I scripts/c_session.py build-review --chunk 2
  python -I scripts/c_session.py validate-review --chunk 2
  python -I scripts/c_session.py collect-review
"""
import argparse
import collections
import json
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from c_pilot import SYSTEM_R, SYSTEM_T, check_song, glossary_block, lines_for, skip_lines
from common import OUT, RAW, lines, save_json, songs

DIR = RAW / "c-session"
GROUPS = {
    "Yoruba": 0,
    "Igbo": 1, "Hausa": 1,
    "Swahili": 2, "East African (Luganda, Kalenjin, Kikuyu)": 2,
    "Spanish": 3, "Tagalog or Cebuano": 3,
    "Twi": 4, "Southern African (Zulu, Sotho, Xhosa)": 4, "Non-Latin script": 4,
    "Import, missing lines only": 5,
}
T_FORMAT = """Write {out} as one JSON object keyed by song id:
  {{"<song id>": {{"lines": [{{"i": 3, "english": "...", "confidence": "high|medium|low", "note": ""}}, ...],
                  "language": "<language name>", "isNotASong": false, "songNote": ""}}, ...}}
One entry in "lines" per index listed under that song's lines_to_translate, no others."""
R_FORMAT = """Write {out} as one JSON object keyed by song id:
  {{"<song id>": {{"lines": [{{"i": 3, "score": 4, "issue": ""}}, ...], "overall": "<one or two sentences>"}}, ...}}
One entry per line shown, score an integer 1 to 5."""


def sample():
    return json.load(open(OUT / "pilot-sample.json"))["songs"]


def chunks():
    by = collections.defaultdict(list)
    for p in sample():
        by[GROUPS[p["stratum"]]].append(p)
    return dict(sorted(by.items()))


def build_translate():
    W = {s["id"]: s for s in songs("translation-worklist.json")}
    skip = skip_lines()
    DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for k, ps in chunks().items():
        out = DIR / f"translate-{k:02d}-answers.json"
        text = (f"# Translation, chunk {k:02d}: {len(ps)} songs\n\n## Instructions\n\n{SYSTEM_T}\n\n"
                f"## Answer format\n\n{T_FORMAT.format(out=out)}\n\n")
        by_code = collections.defaultdict(list)
        for p in ps:
            by_code[p["code"] or "unknown"].append(p)
        for code, group in by_code.items():
            text += f"## Glossary and examples for {code}\n\n{glossary_block(code)}\n\n"
            for p in group:
                s = W[p["id"]]
                todo = lines_for(s, skip)
                text += (f"## song id: {s['id']}\n<song>\n<title>{s['title']}</title>\n<artist>{s['artist'] or ''}</artist>\n"
                         f"<language_label>{code}</language_label>\n<lyrics>\n{s['lyrics']}\n</lyrics>\n</song>\n"
                         "<lines_to_translate>\n" + "\n".join(f'{l["i"]}\t{l["text"]}' for l in todo)
                         + "\n</lines_to_translate>\n\n")
        (DIR / f"translate-{k:02d}.md").write_text(text, encoding="utf-8")
        manifest.append({"chunk": k, "songs": [p["id"] for p in ps], "chars": len(text), "answers": str(out),
                         "lines": sum(len(lines_for(W[p["id"]], skip)) for p in ps)})
    save_json(DIR / "manifest.json", manifest)
    for m in manifest:
        print(m["chunk"], len(m["songs"]), "songs", m["lines"], "lines", m["chars"], "chars")


def load(path):
    try:
        return json.load(open(path, encoding="utf-8")), None
    except FileNotFoundError:
        return None, "answers file missing"
    except json.JSONDecodeError as e:
        return None, f"not valid JSON: {e}"


HARD = {"missing", "not asked for", "answered twice", "blank"}


def check_translate(k):
    m = next(x for x in json.load(open(DIR / "manifest.json")) if x["chunk"] == k)
    ans, err = load(m["answers"])
    if err:
        return m, [err], [], {}
    W = {s["id"]: s for s in songs("translation-worklist.json")}
    skip = skip_lines()
    hard, soft = [], []
    for sid in m["songs"]:
        a = ans.get(sid)
        if not isinstance(a, dict) or not isinstance(a.get("lines"), list):
            hard.append(f"{sid}: missing or has no lines list")
            continue
        for l in a["lines"]:
            if l.get("confidence") not in ("high", "medium", "low") or not isinstance(l.get("i"), int):
                hard.append(f"{sid} line {l.get('i')}: needs integer i and confidence high/medium/low")
        for x in check_song(W[sid], lines_for(W[sid], skip), a):
            (hard if x["check"] in HARD else soft).append(f"{sid}: {x}")
    return m, hard, soft, ans


def validate_translate(k):
    m, hard, soft, _ = check_translate(k)
    for s in soft[:40]:
        print("CHECK", s)
    if hard:
        print("INVALID")
        print("\n".join(hard[:60]))
        sys.exit(1)
    print(f"VALID ({len(soft)} soft checks to look at: fix them or explain in the line's note)")


def collect_translate():
    rows = []
    for m in json.load(open(DIR / "manifest.json")):
        _, hard, _, ans = check_translate(m["chunk"])
        if hard:
            print(f"chunk {m['chunk']}:", hard[:5])
        for sid in m["songs"]:
            a = (ans or {}).get(sid)
            rows.append({"custom_id": f"ct-{sid}", "status": "succeeded" if a else "missing", **({"output": a} if a else {})})
    with open(RAW / "c-translate-pilot-results.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(sum(r["status"] == "succeeded" for r in rows), "of", len(rows), "songs collected")


def manifest_entry(k):
    return next(x for x in json.load(open(DIR / "manifest.json")) if x["chunk"] == k)


def translations(k):
    ans, err = load(manifest_entry(k)["answers"])
    return ans or {}


def build_review(k):
    """Review input for one chunk: language, line index, source and English only."""
    W = {s["id"]: s for s in songs("translation-worklist.json")}
    m = manifest_entry(k)
    t_all = translations(k)
    out = DIR / f"review-{k:02d}-answers.json"
    text = f"# Review, chunk {k:02d}\n\n## Instructions\n\n{SYSTEM_R}\n\n## Answer format\n\n{R_FORMAT.format(out=out)}\n\n"
    for sid in m["songs"]:
        t = t_all.get(sid)
        if not t:
            continue
        src = dict(enumerate(lines(W[sid]["lyrics"])))
        rows = "\n".join(f'{l["i"]}\t{src.get(l["i"], "")}\t{l["english"]}' for l in t["lines"])
        text += (f"## song id: {sid}\n<language>{t.get('language', '')}</language>\n"
                 f"<lines format=\"i<TAB>source<TAB>English\">\n{rows}\n</lines>\n\n")
    (DIR / f"review-{k:02d}.md").write_text(text, encoding="utf-8")
    print(f"wrote {DIR / f'review-{k:02d}.md'}")


def check_review(k):
    m = manifest_entry(k)
    ans, err = load(DIR / f"review-{k:02d}-answers.json")
    if err:
        return m, [err], {}
    t = {sid: {l["i"] for l in v["lines"]} for sid, v in translations(k).items()}
    problems = []
    for sid in m["songs"]:
        if sid not in t:
            continue
        a = ans.get(sid)
        if not isinstance(a, dict):
            problems.append(f"{sid}: missing")
            continue
        got = {l.get("i"): l for l in a.get("lines", [])}
        miss = sorted(t[sid] - set(got))
        if miss:
            problems.append(f"{sid}: lines not scored: {miss[:20]}")
        for i, l in got.items():
            if l.get("score") not in (1, 2, 3, 4, 5):
                problems.append(f"{sid} line {i}: score must be an integer 1 to 5")
    return m, problems, ans


def validate_review(k):
    _, problems, _ = check_review(k)
    if problems:
        print("INVALID")
        print("\n".join(problems[:60]))
        sys.exit(1)
    print("VALID")


def collect_review():
    rows = []
    for m in json.load(open(DIR / "manifest.json")):
        _, problems, ans = check_review(m["chunk"])
        if problems:
            print(f"chunk {m['chunk']}:", problems[:5])
        for sid in m["songs"]:
            a = (ans or {}).get(sid)
            rows.append({"custom_id": f"cr-{sid}", "status": "succeeded" if a else "missing", **({"output": a} if a else {})})
    with open(RAW / "c-review-pilot-results.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(sum(r["status"] == "succeeded" for r in rows), "of", len(rows), "reviews collected")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["build-translate", "validate-translate", "collect-translate",
                                     "build-review", "validate-review", "collect-review"])
    ap.add_argument("--chunk", type=int)
    a = ap.parse_args()
    {"build-translate": build_translate, "validate-translate": lambda: validate_translate(a.chunk),
     "collect-translate": collect_translate, "build-review": lambda: build_review(a.chunk),
     "validate-review": lambda: validate_review(a.chunk), "collect-review": collect_review}[a.step]()
