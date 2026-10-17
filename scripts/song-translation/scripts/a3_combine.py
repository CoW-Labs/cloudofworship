"""Task A3: combine A1 (Claude) and A2 (GlotLID) into one decision per song.

  confirmed     A1 and A2 agree and A1 confidence is high or medium
  needs review  they disagree, A1 is low, or one method is missing
  English only  A1 says the song is English apart from names and vocables (flag: may not need translating)
  not a song    A1 says it is a service card, announcement, reading, ...

Usage: python -I scripts/a3_combine.py --sets review [trial glossary worklist-rest] [--a2 all]
Writes outputs/language-labels.json and outputs/language-disagreements.csv
"""
import argparse
import csv
import json
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import OUT, RAW, lines, load_jsonl, save_json, song_id, songs

# Codes that name the same language, or a macrolanguage and its member, for agreement only.
SAME = [
    {"aka", "twi", "fat"},          # Akan: Twi, Fante
    {"swa", "swh", "swc"},          # Swahili
    {"tgl", "fil"},                 # Tagalog / Filipino
    {"msa", "zsm", "ind"},          # Malay / Indonesian are close; GlotLID often swaps them
    {"ara", "arb"},
    {"zho", "cmn"},
    {"fas", "pes"},
    {"orm", "gaz"},
    {"kin", "run"},                 # Kinyarwanda / Kirundi: mutually intelligible, flag in notes
    {"pcm", "eng"},                 # Nigerian Pidgin vs English: treat as agreement, keep the A1 call
]


def same_language(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    return any(a in g and b in g for g in SAME)


def first_lines(lyrics, n=2):
    return " / ".join([l for l in lines(lyrics) if l.strip()][:n])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets", nargs="+", default=["review"])
    ap.add_argument("--a2", default="all")
    a = ap.parse_args()

    index = {}
    for name in ("translation-worklist.json", "language-review.json", "glossary-sources.json"):
        for s in songs(name):
            index.setdefault(song_id(s), {}).update(s)

    a1 = {}
    for set_name in a.sets:
        members = json.load(open(RAW / f"a1-{set_name}-members.json"))
        for r in load_jsonl(RAW / f"a1-{set_name}-results.jsonl"):
            for sid in members.get(r["custom_id"], []):
                a1[sid] = r
    a2 = {r["id"]: r for r in load_jsonl(RAW / f"a2-{a.a2}.jsonl")}

    records, disagreements = [], []
    for sid, r1 in a1.items():
        s = index.get(sid, {})
        o = r1.get("output")
        r2 = a2.get(sid)
        a1_code = o["primaryLanguage"]["code"] if o else None
        a2_code = r2["top"]["code"] if r2 else None
        agree = same_language(a1_code, a2_code)
        if not o:
            decision = "needs review"
            why = f"A1 {r1['status']}"
        elif o["isNotASong"]:
            decision, why = "not a song", o["notes"]
        elif o["isEnglishOnly"]:
            decision, why = "English only", o["notes"]
        elif r2 is None:
            decision, why = "needs review", "A2 missing"
        elif agree and o["confidence"] in ("high", "medium"):
            decision, why = "confirmed", ""
        else:
            decision = "needs review"
            why = "methods disagree" if not agree else "A1 confidence low"
        rec = {
            "id": sid, "title": s.get("title"), "artist": s.get("artist"), "source": s.get("source"),
            "previousLabel": s.get("currentLabel") or s.get("language"),
            "a1": o if o else {"status": r1["status"]},
            "a2": r2["top"] if r2 else None, "a2Top3": r2["top3"] if r2 else None,
            "a2Input": r2["input"] if r2 else None,
            "decision": decision,
            "language": {"code": a1_code, "name": o["primaryLanguage"]["name"]} if o else None,
            "reason": why,
        }
        records.append(rec)
        if decision == "needs review":
            hint = s.get("artistRegionHint")
            disagreements.append({
                "id": sid, "title": s.get("title"), "artist": s.get("artist"),
                "A1": f"{a1_code} {o['primaryLanguage']['name']} ({o['confidence']})" if o else r1["status"],
                "A1 notes": o["notes"] if o else "",
                "A2": f"{a2_code} {r2['top']['score']}" if r2 else "",
                "artist hint": hint["region"] if hint else "",
                "church location": s.get("churchLocationHint") or "",
                "first two lines": first_lines(s.get("lyrics", "")),
                "why": why,
            })

    counts = {}
    for r in records:
        counts[r["decision"]] = counts.get(r["decision"], 0) + 1
    save_json(OUT / "language-labels.json", {"sets": a.sets, "counts": counts, "songs": records})
    with open(OUT / "language-disagreements.csv", "w", newline="", encoding="utf-8") as f:
        cols = ["id", "title", "artist", "A1", "A1 notes", "A2", "artist hint", "church location", "first two lines", "why"]
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(disagreements)
    print(counts)


if __name__ == "__main__":
    main()
