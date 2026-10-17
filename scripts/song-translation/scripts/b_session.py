"""Task B run inside a Claude Code session: one input file per agent (several
languages each), a validator, and a collector that writes the same results file
as the Batch API path, so `b_glossary.py write` works unchanged.

Usage:
  python -I scripts/b_session.py build --agents 5
  python -I scripts/b_session.py validate --chunk 2
  python -I scripts/b_session.py collect
"""
import argparse
import json
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from b_glossary import MIN_PAIRS, SCHEMA, SYSTEM, build as build_requests, by_language
from common import RAW, save_json

DIR = RAW / "b-session"


def build(agents):
    reqs = build_requests()  # writes nothing paid; gives one user message per language
    groups, names, _ = by_language()
    items = []
    for r in reqs:
        code = r["custom_id"][2:]
        items.append((code, r["params"]["messages"][0]["content"], sum(len(s["pairs"]) for s in groups[code])))
    items.sort(key=lambda x: -len(x[1]))
    bins = [[] for _ in range(agents)]
    sizes = [0] * agents
    for it in items:
        k = sizes.index(min(sizes))
        bins[k].append(it)
        sizes[k] += len(it[1])
    DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for k, b in enumerate(bins):
        if not b:
            continue
        out = DIR / f"chunk-{k:02d}-answers.json"
        fmt = json.dumps(SCHEMA, indent=1)
        text = (f"# Glossary building, chunk {k:02d}: {len(b)} language(s)\n\n## Instructions\n\n{SYSTEM}\n\n"
                f"## Answer format\n\nWrite {out} as one JSON object keyed by language code, e.g. "
                f'{{"yor": {{...}}, "ibo": {{...}}}}. Each value must match this JSON schema:\n```\n{fmt}\n```\n'
                "fewShotSongIds must be song ids that appear in that language's pairs.\n\n")
        for code, msg, n in b:
            text += f"## Language {code} ({n} pairs)\n\n{msg}\n\n"
        (DIR / f"chunk-{k:02d}.md").write_text(text, encoding="utf-8")
        manifest.append({"chunk": k, "languages": [c for c, _, _ in b], "chars": len(text), "answers": str(out)})
    save_json(DIR / "manifest.json", manifest)
    for m in manifest:
        print(m)


def song_ids(code):
    groups, _, _ = by_language()
    return {s["id"] for s in groups[code]}


def check(k):
    m = next(x for x in json.load(open(DIR / "manifest.json")) if x["chunk"] == k)
    problems = []
    try:
        ans = json.load(open(m["answers"], encoding="utf-8"))
    except FileNotFoundError:
        return m, ["answers file missing"], {}
    except json.JSONDecodeError as e:
        return m, [f"not valid JSON: {e}"], {}
    for code in m["languages"]:
        a = ans.get(code)
        if not isinstance(a, dict):
            problems.append(f"{code}: missing")
            continue
        for key in SCHEMA["required"]:
            if key not in a:
                problems.append(f"{code}: {key} missing")
        for t in a.get("terms", []):
            for key in ("term", "english", "variants", "keepAsIs", "note"):
                if key not in t:
                    problems.append(f"{code}: term {t.get('term')!r} lacks {key}")
        ids = song_ids(code)
        bad = [i for i in a.get("fewShotSongIds", []) if i not in ids]
        if bad:
            problems.append(f"{code}: fewShotSongIds not in this language's pairs: {bad}")
        if len(ids) >= 3 and not 3 <= len(a.get("fewShotSongIds", [])) <= 5:
            problems.append(f"{code}: choose 3 to 5 few-shot songs")
        if not a.get("terms"):
            problems.append(f"{code}: no terms")
    extra = [c for c in ans if c not in m["languages"]]
    if extra:
        problems.append(f"languages not in this chunk: {extra}")
    return m, problems, ans


def validate(k):
    m, problems, ans = check(k)
    if problems:
        print("INVALID")
        print("\n".join(problems[:60]))
        sys.exit(1)
    print("VALID:", {c: len(ans[c]["terms"]) for c in m["languages"]})


def collect():
    rows = []
    for m in json.load(open(DIR / "manifest.json")):
        _, problems, ans = check(m["chunk"])
        if problems:
            print(f"chunk {m['chunk']}:", problems[:5])
        for code in m["languages"]:
            a = ans.get(code)
            rows.append({"custom_id": f"b-{code}", "status": "succeeded" if isinstance(a, dict) else "missing",
                         **({"output": a} if isinstance(a, dict) else {})})
    with open(RAW / "b-glossary-results.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(len(rows), "languages collected")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["build", "validate", "collect"])
    ap.add_argument("--agents", type=int, default=5)
    ap.add_argument("--chunk", type=int)
    a = ap.parse_args()
    {"build": lambda: build(a.agents), "validate": lambda: validate(a.chunk), "collect": collect}[a.step]()
