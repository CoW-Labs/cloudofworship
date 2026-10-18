"""Flag translated songs whose lyrics already carry a church-written English translation
(round or square brackets, same line, next line or after '|'). Output: outputs/existing-english-flags.csv/json
Usage: python -I scripts/flag_existing_english.py"""
import collections, csv, json, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import OUT, save_json, songs
from prep import pairs_for, is_english, is_foreign, words

W = {s["id"]: s for s in songs("translation-worklist.json")}
T = json.load(open(OUT / "translations.json"))["songs"]
rows, per_song = [], {}
for sid, rec in T.items():
    if rec.get("copyOf") or rec.get("status") != "translated":
        continue
    s = W[sid]
    pairs = {i: (a, b, f) for i, a, b, f in pairs_for(s["lyrics"])}
    ours = {l["i"]: l for l in rec["lines"]}
    hit = [i for i in ours if i in pairs]
    if not hit:
        continue
    forms = collections.Counter(pairs[i][2] for i in hit)
    per_song[sid] = {"title": s["title"], "source": s["source"], "language": rec.get("language"),
                     "translatedLines": len(ours), "linesWithChurchEnglish": len(hit), "forms": dict(forms)}
    for i in hit:
        a, b, f = pairs[i]
        rows.append({"song id": sid, "title": s["title"], "line": i, "form": f, "source": ours[i]["source"],
                     "church English": b, "our English": ours[i]["english"], "our confidence": ours[i]["confidence"]})
save_json(OUT / "existing-english-flags.json", {"songs": per_song, "lines": len(rows)})
with open(OUT / "existing-english-flags.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
tot = collections.Counter(); 
for v in per_song.values(): tot.update(v["forms"])
n_tr = sum(1 for r in T.values() if r.get("status") == "translated" and not r.get("copyOf"))
full = [s for s, v in per_song.items() if v["linesWithChurchEnglish"] >= 0.5 * v["translatedLines"]]
print({"translated songs": n_tr, "songs flagged": len(per_song), "lines flagged": len(rows), "by form": dict(tot),
       "songs where half or more of lines have church English": len(full)})
print(collections.Counter(v["source"] for v in per_song.values()))
