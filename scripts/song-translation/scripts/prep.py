"""Free, offline preparation. No API calls, no network.

Writes:
  outputs/data-checks.json            counts, and problems found in the bundle
  outputs/lines-already-english.json  worklist lines that are or already carry English
  outputs/glossary-pairs.json         (source line, human English) pairs per song
  outputs/glossary-candidates.json    source terms with their likely English, by co-occurrence
  outputs/pilot-sample.provisional.json  Task C sample from current labels (re-pick after Task A)

Usage: python -I scripts/prep.py
"""
import collections
import math
import random
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import (OUT, ROUND, REPEAT, english_share, fold, lines,
                    save_json, song_id, songs, words, ENGLISH_WORDS)


# --- 1. import lines that already have English ------------------------------

def is_english(text):
    """For bracket contents: common English words make up half or more."""
    return bool(words(text)) and english_share(text) >= 0.5


def is_foreign(text):
    return bool(words(text)) and english_share(text) < 0.5


def trailing_bracket(text):
    m = re.search(r"\(([^()]*)\)\s*$", text)
    return m.group(1).strip() if m else None


def import_line_status(text):
    """'translated' when the line already ends in an English bracket,
    else 'needs English'."""
    b = trailing_bracket(text)
    if b is None or not b or REPEAT.match(b):
        return "needs English", b
    before = text[: text.rfind("(")]
    if is_english(b) and is_foreign(before):
        return "translated", b
    return "needs English", b


# --- 2. glossary pairs -----------------------------------------------------

def is_bracket_only(line):
    """A line that is only (English), or [English] of three or more words
    (shorter square brackets are section labels such as [Chorus])."""
    s = line.strip()
    if s.startswith("(") and s.endswith(")") and s.count("(") == 1:
        return True
    return s.startswith("[") and s.endswith("]") and s.count("[") == 1 and len(words(s)) >= 3


def pairs_for(lyrics):
    """Yield (i, source, english, form) where a non-English line carries a
    human English translation on the same line, on the next line, or after '|'."""
    ls = lines(lyrics)
    out = []
    for i, line in enumerate(ls):
        s = line.strip()
        if not s or is_bracket_only(s):
            continue
        # same line: Original (English)
        b = trailing_bracket(s)
        if b and not REPEAT.match(b):
            src = s[: s.rfind("(")].strip()
            if src and is_english(b) and is_foreign(src):
                out.append((i, src, b, "same line"))
                continue
        # pipe: Original | English
        if "|" in s:
            src, _, eng = s.partition("|")
            if is_english(eng) and is_foreign(src):
                out.append((i, src.strip(), eng.strip(), "pipe"))
                continue
        # next line: (English)
        if i + 1 < len(ls) and is_bracket_only(ls[i + 1]):
            eng = ls[i + 1].strip()[1:-1].strip()
            if eng and not REPEAT.match(eng) and is_english(eng) and is_foreign(s):
                out.append((i, s, eng, "next line"))
    return out


# --- 3. term candidates ----------------------------------------------------

STOP = ENGLISH_WORDS - {"lord", "god", "jesus", "christ", "holy", "glory", "grace", "mercy",
                         "king", "heaven", "earth", "praise", "worship", "father", "spirit",
                         "life", "blood", "cross", "love", "name", "power", "saviour", "savior",
                         "mighty", "wonderful", "faithful", "beautiful", "heart", "soul",
                         "thank", "thanks", "forever"}
KEEP_AS_IS = {"jehovah", "jireh", "nissi", "shammah", "rapha", "shalom", "el", "shaddai", "elohim",
              "adonai", "yahweh", "hosanna", "hallelujah", "alleluia", "amen", "emmanuel", "immanuel",
              "jesus", "yesu", "yesus", "jesu", "christ", "kristi", "kristo", "messiah", "oh", "eh",
              "ah", "ooh", "ee", "oo", "aa", "o", "e", "a", "yeah", "hey", "la", "na"}


def term_candidates(pair_rows, min_songs=2, min_count=3):
    src_count = collections.Counter()
    src_songs = collections.defaultdict(set)
    eng_count = collections.Counter()
    co = collections.Counter()
    for sid, i, src, eng in pair_rows:
        sw = {fold(w) for w in words(src)} - KEEP_AS_IS
        ew = {w for w in words(eng)} - STOP
        for w in sw:
            src_count[w] += 1
            src_songs[w].add(sid)
        for e in ew:
            eng_count[e] += 1
        for w in sw:
            for e in ew:
                co[(w, e)] += 1
    by_src = collections.defaultdict(list)
    for (w, e), n in co.items():
        if n < 2:
            continue
        dice = 2 * n / (src_count[w] + eng_count[e])
        by_src[w].append((dice, n, e))
    out = []
    for w, cands in by_src.items():
        if src_count[w] < min_count or len(src_songs[w]) < min_songs or len(w) < 3:
            continue
        cands.sort(reverse=True)
        best = cands[0]
        if best[0] < 0.25:
            continue
        out.append({
            "term": w,
            "count": src_count[w],
            "songs": len(src_songs[w]),
            "english": [{"word": e, "dice": round(d, 2), "together": n} for d, n, e in cands[:3]],
            "exampleSongs": sorted(src_songs[w])[:5],
        })
    out.sort(key=lambda r: (-r["english"][0]["dice"] * math.log(1 + r["count"]), r["term"]))
    return out


# --- 4. provisional pilot sample -------------------------------------------

STRATA = [
    ("Spanish", 6, {"Spanish"}),
    ("Yoruba", 8, {"Yoruba"}),
    ("Igbo", 5, {"Igbo"}),
    ("Hausa", 3, {"Hausa"}),
    ("Swahili", 6, {"Swahili"}),
    ("Tagalog or Cebuano", 4, {"Tagalog", "Cebuano"}),
    ("Twi", 4, {"Twi"}),
    ("East African (Luganda, Kalenjin, Kikuyu)", 4, {"Luganda", "Kalenjin", "Kikuyu"}),
    ("Southern African (Zulu, Sotho, Xhosa)", 3, {"Zulu", "Sotho", "Xhosa", "Southern Sotho", "Northern Sotho", "Tswana"}),
    ("Non-Latin script", 3, {"Non-Latin script"}),
]
TRUSTED = {"strong", "corrected", "confirmed by you"}
NON_SONG = re.compile(r"\b(announcement|offering|welcome to|service order|order of service|bible reading|"
                      r"sermon|notice|channel|subscribe|scripture reading)\b", re.I)


def pilot_sample(worklist, seed=20261017):
    rng = random.Random(seed)
    used_groups = set()
    picked, gaps = [], []

    def ok(s):
        n = len(s["linesToTranslate"])
        return (5 <= n <= 40 and s["copyGroup"] not in used_groups
                and not NON_SONG.search(s["title"] + "\n" + s["lyrics"][:400])
                and "original lyrics missing" not in s["status"])

    for name, k, langs in STRATA:
        pool = [s for s in worklist if s["source"] == "database" and s["language"] in langs
                and (s["languageConfidence"] in TRUSTED or s["language"] == "Non-Latin script") and ok(s)]
        rng.shuffle(pool)
        # spread across languages inside a mixed stratum
        pool.sort(key=lambda s: s["language"])
        chosen = []
        by_lang = collections.defaultdict(list)
        for s in pool:
            by_lang[s["language"]].append(s)
        while len(chosen) < k and any(by_lang.values()):
            for lang in sorted(by_lang):
                if by_lang[lang] and len(chosen) < k:
                    chosen.append(by_lang[lang].pop())
        for s in chosen:
            used_groups.add(s["copyGroup"])
            picked.append({"stratum": name, "id": s["id"], "title": s["title"], "language": s["language"],
                           "languageConfidence": s["languageConfidence"], "lines": len(s["linesToTranslate"])})
        if len(chosen) < k:
            gaps.append({"stratum": name, "wanted": k, "found": len(chosen),
                         "why": "too few songs with a trusted label; fill after Task A"})
    imports = [s for s in worklist if s["source"] != "database" and s["scope"] == "missing lines only" and ok(s)]
    rng.shuffle(imports)
    for s in imports[:4]:
        used_groups.add(s["copyGroup"])
        picked.append({"stratum": "Import, missing lines only", "id": s["id"], "title": s["title"],
                       "language": s["language"], "languageConfidence": s["languageConfidence"],
                       "lines": len(s["linesToTranslate"])})
    return picked, gaps


def main():
    W = songs("translation-worklist.json")
    R = songs("language-review.json")
    G = songs("glossary-sources.json")
    I = songs("import-songs.cleaned.json")
    checks = {"counts": {
        "worklist songs": len(W),
        "worklist copy groups": len({s["copyGroup"] for s in W}),
        "worklist lines to translate": sum(len(s["linesToTranslate"]) for s in W),
        "worklist characters to translate": sum(len(l["text"]) for s in W for l in s["linesToTranslate"]),
        "review songs": len(R),
        "review copy groups": len({s["copyGroup"] for s in R}),
        "glossary songs": len(G),
        "import songs": len(I),
    }, "problems": []}

    # line-index sanity: every i points at the same text in lyrics
    bad_index = []
    for s in W:
        ls = lines(s["lyrics"])
        for l in s["linesToTranslate"]:
            if l["i"] >= len(ls) or ls[l["i"]].strip() != l["text"].strip():
                bad_index.append({"id": s["id"], "i": l["i"]})
    checks["counts"]["line index mismatches"] = len(bad_index)
    if bad_index:
        checks["problems"].append({"problem": "linesToTranslate index does not match lyrics", "count": len(bad_index),
                                   "examples": bad_index[:10]})

    # 1. lines that are, or already carry, English
    skip, keep = [], collections.Counter()
    for s in W:
        for l in s["linesToTranslate"]:
            t = l["text"].strip()
            if is_bracket_only(t) and is_english(t[1:-1]):
                skip.append({"id": s["id"], "source": s["source"], "i": l["i"], "text": l["text"],
                             "kind": "English line in brackets", "english": t[1:-1].strip()})
                continue
            status, b = import_line_status(t)
            if status == "translated":
                skip.append({"id": s["id"], "source": s["source"], "i": l["i"], "text": l["text"],
                             "kind": "already has English after it", "english": b})
            else:
                keep[s["source"]] += 1
    save_json(OUT / "lines-already-english.json", {
        "about": "Worklist lines that are English in brackets, or already end in a bracketed English "
                 "translation. Proposed: do not translate them; keep the human English. Spot-check first.",
        "count": len(skip), "songs": len({x["id"] for x in skip}),
        "byKind": collections.Counter(f'{x["source"]}: {x["kind"]}' for x in skip), "lines": skip})
    checks["problems"].append({
        "problem": "worklist lines that are already English or already carry a bracketed English translation",
        "count": len(skip), "songs": len({x["id"] for x in skip}), "linesStillNeedingEnglish": dict(keep),
        "examples": [x["text"] for x in skip[:: max(1, len(skip) // 6)]][:6]})

    # import songs flagged original-lyrics-missing that are still in the worklist
    missing = [s["id"] for s in W if "original lyrics missing" in s["status"]]
    checks["problems"].append({"problem": "worklist songs marked original lyrics missing (skip per handoff)",
                               "count": len(missing), "ids": missing})

    # 2. glossary pairs
    per_song, rows, forms = [], [], collections.Counter()
    english_only = []
    for s in G:
        p = pairs_for(s["lyrics"])
        if not p:
            # most of the lyrics look English: an English song with echoes, not a translation source
            english_only.append({"id": s["id"], "title": s["title"],
                                 "englishShare": round(english_share(s["lyrics"]), 2)})
            continue
        per_song.append({"id": s["id"], "title": s["title"], "artist": s["artist"], "owner": s["owner"],
                         "pattern": s["pattern"],
                         "pairs": [{"i": i, "source": a, "english": b, "form": f} for i, a, b, f in p]})
        for i, a, b, f in p:
            rows.append((s["id"], i, a, b))
            forms[f] += 1
    save_json(OUT / "glossary-pairs.json", {
        "about": "Original line and its human English, extracted from glossary-sources.json. Language is not "
                 "known yet: join on id with Task A labels.",
        "songs": len(per_song), "pairs": len(rows), "forms": forms,
        "songsWithoutPairs": english_only, "items": per_song})
    checks["counts"]["glossary songs with pairs"] = len(per_song)
    checks["counts"]["glossary pairs"] = len(rows)
    checks["problems"].append({"problem": "glossary sources where no translated pair was found "
                                          "(often English songs with echoes, or 'full song then English' "
                                          "where lines do not align)",
                               "count": len(english_only), "examples": english_only[:8]})

    # 3. term candidates
    cands = term_candidates(rows)
    save_json(OUT / "glossary-candidates.json", {
        "about": "Source words that co-occur with an English word across human-translated lines. Statistical "
                 "candidates for Task B, not a glossary: language is not split yet and multi-word terms "
                 "are not handled. dice = 2*together/(source count + English count).",
        "count": len(cands), "terms": cands})

    # 4. provisional pilot
    picked, gaps = pilot_sample(W)
    save_json(OUT / "pilot-sample.provisional.json", {
        "about": "Task C sample drawn from the CURRENT labels (strong/corrected only). Provisional: re-pick "
                 "after Task A confirms languages, especially to fill the gaps.",
        "count": len(picked), "gaps": gaps, "songs": picked})

    save_json(OUT / "data-checks.json", checks)
    print(__import__("json").dumps(checks["counts"], indent=1))
    print("lines already English:", len(skip), "| still need English:", dict(keep))
    print("glossary: songs with pairs", len(per_song), "pairs", len(rows), dict(forms), "no pairs", len(english_only))
    print("term candidates:", len(cands))
    print("pilot picked:", len(picked), "gaps:", gaps)


if __name__ == "__main__":
    main()
