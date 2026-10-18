"""Prefer the church's own English where the lyrics already carry it (next line, same line or '|').
Run after `d_session.py collect`. For each affected line: `english` becomes the church's text,
`englishSource` = "church", and our translation is kept as `machineEnglish`. Other lines get
`englishSource` = "machine". Also rewrites translations-part1/part2.json from the merged file.
Usage: python -I scripts/apply_church_english.py"""
import json, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import OUT, songs
from prep import pairs_for

W = {s["id"]: s for s in songs("translation-worklist.json")}
d = json.load(open(OUT / "translations.json"))
swapped = songs_hit = 0
for sid, rec in d["songs"].items():
    if rec.get("status") != "translated":
        continue
    pairs = {i: b for i, a, b, f in pairs_for(W[sid]["lyrics"])}
    hit = 0
    for l in rec["lines"]:
        if l["i"] in pairs and "machineEnglish" not in l:
            l["machineEnglish"], l["english"], l["englishSource"] = l["english"], pairs[l["i"]], "church"
            hit += 1
        else:
            l.setdefault("englishSource", "church" if "machineEnglish" in l else "machine")
    swapped += hit
    songs_hit += bool(hit)
d["progress"]["lines using church English"] = swapped
d["progress"]["songs with church English"] = songs_hit
json.dump(d, open(OUT / "translations.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
p1 = json.load(open(OUT / "translations-part1.json"))
ids1 = set(p1["songs"])
p1["songs"] = {k: d["songs"][k] for k in ids1}
rest = {k: v for k, v in d["songs"].items() if k not in ids1}
json.dump(p1, open(OUT / "translations-part1.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"about": d["about"] + " Part 2: songs not in part 1.", "count": len(rest), "songs": rest},
          open(OUT / "translations-part2.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({"lines now using church English": swapped, "songs": songs_hit, "part1": len(p1["songs"]), "part2": len(rest)})
