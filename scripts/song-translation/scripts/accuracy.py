"""Accuracy tests, run before any large job.

Test 1, language ID: songs whose language is already known (strong word-list
labels) are labelled blind by (a) Claude with context and (b) CLD3 + Lingua, two
offline models that stand in for GlotLID while huggingface.co is unreachable.

Test 2, translation back-test: songs that already carry human English. The
English is removed, the source lines are translated blind, and the result is
scored against the human English with chrF++ (sacrebleu).

Input files hold only what the translator may see. Answers live in *-key.json
files, read only by the scoring step.

Usage:
  python -I scripts/accuracy.py build-lid      # accuracy/lid-input.md + lid-key.json
  python -I scripts/accuracy.py free-lid       # CLD3 + Lingua on the test set and on every song
  python -I scripts/accuracy.py build-mt       # accuracy/mt-input.md + mt-key.json
  python -I scripts/accuracy.py score-lid      # needs accuracy/lid-answers.json
  python -I scripts/accuracy.py score-mt       # needs accuracy/mt-answers.json
"""
import collections
import csv
import json
import random
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import OUT, ROUND, SQUARE, english_share, lid_text, lines, save_json, song_id, songs, words
from prep import is_bracket_only, is_english, trailing_bracket

ACC = OUT / "accuracy"
SEED = 20261017

NAME_TO_CODE = {
    "Spanish": "spa", "Yoruba": "yor", "Tagalog": "tgl", "Swahili": "swa", "Indonesian": "ind", "Igbo": "ibo",
    "Twi": "twi", "Portuguese": "por", "Cebuano": "ceb", "Hausa": "hau", "French": "fra", "Luganda": "lug",
    "Zulu": "zul", "Kinyarwanda": "kin", "Chichewa": "nya", "Urhobo": "urh",
}
# CLD3 answers in ISO 639-1 (plus a few 3-letter codes)
CLD3_TO_639_3 = {
    "af": "afr", "am": "amh", "ar": "ara", "bg": "bul", "bn": "ben", "ca": "cat", "ceb": "ceb", "co": "cos",
    "cs": "ces", "cy": "cym", "da": "dan", "de": "deu", "el": "ell", "en": "eng", "eo": "epo", "es": "spa",
    "et": "est", "eu": "eus", "fa": "fas", "fi": "fin", "fil": "fil", "fr": "fra", "fy": "fry", "ga": "gle",
    "gd": "gla", "gl": "glg", "gu": "guj", "ha": "hau", "haw": "haw", "hi": "hin", "hi-Latn": "hin", "hmn": "hmn", "hr": "hrv",
    "ht": "hat", "hu": "hun", "hy": "hye", "id": "ind", "ig": "ibo", "is": "isl", "it": "ita", "iw": "heb",
    "ja": "jpn", "jv": "jav", "ka": "kat", "kk": "kaz", "km": "khm", "kn": "kan", "ko": "kor", "ku": "kur",
    "ky": "kir", "la": "lat", "lb": "ltz", "lo": "lao", "lt": "lit", "lv": "lav", "mg": "mlg", "mi": "mri",
    "mk": "mkd", "ml": "mal", "mn": "mon", "mr": "mar", "ms": "msa", "mt": "mlt", "my": "mya", "ne": "nep",
    "nl": "nld", "no": "nor", "ny": "nya", "pa": "pan", "pl": "pol", "ps": "pus", "pt": "por", "ro": "ron",
    "ru": "rus", "sd": "snd", "si": "sin", "sk": "slk", "sl": "slv", "sm": "smo", "sn": "sna", "so": "som",
    "sq": "sqi", "sr": "srp", "st": "sot", "su": "sun", "sv": "swe", "sw": "swa", "ta": "tam", "te": "tel",
    "tg": "tgk", "th": "tha", "tr": "tur", "uk": "ukr", "ur": "urd", "uz": "uzb", "vi": "vie", "xh": "xho",
    "yi": "yid", "yo": "yor", "zh": "zho", "zu": "zul",
}
SAME = [{"swa", "swh"}, {"tgl", "fil"}, {"twi", "aka", "fat"}, {"ind", "msa", "zsm"}, {"nya", "ny"}]
# Languages each offline model can name at all. A miss outside this set is "not covered", not an error.
CLD3_COVERS = set(CLD3_TO_639_3.values()) | {"tgl", "swh"}


def same(a, b):
    return bool(a and b) and (a == b or any(a in g and b in g for g in SAME))


def clip(lyrics, n=1500):
    return lyrics if len(lyrics) <= n else lyrics[:n] + "\n[…shortened]"


# --- Test 1: language ID --------------------------------------------------

PER_LANGUAGE = 6


def build_lid():
    rng = random.Random(SEED)
    W = songs("translation-worklist.json")
    trusted = [s for s in W if s["source"] == "database" and s["languageConfidence"] in ("strong", "corrected", "confirmed by you")
               and s["language"] in NAME_TO_CODE]
    by_lang = collections.defaultdict(list)
    seen_groups = set()
    for s in trusted:
        if s["copyGroup"] in seen_groups:
            continue
        seen_groups.add(s["copyGroup"])
        by_lang[s["language"]].append(s)
    chosen = []
    for lang in sorted(by_lang):
        pool = by_lang[lang]
        rng.shuffle(pool)
        chosen += pool[:PER_LANGUAGE]
    rng.shuffle(chosen)
    key, parts = [], ["# Language ID test\n\nFor each song: ISO 639-3 code of the main language, confidence (high/medium/low), "
                      "English-only flag. Labels are hidden.\n"]
    for n, s in enumerate(chosen, 1):
        tid = f"L{n:03d}"
        key.append({"tid": tid, "id": s["id"], "label": s["language"], "code": NAME_TO_CODE[s["language"]],
                    "confidence": s["languageConfidence"]})
        parts.append(f"## {tid}\ntitle: {s['title']}\nartist: {s['artist'] or ''}\n```\n{clip(s['lyrics'])}\n```\n")
    ACC.mkdir(parents=True, exist_ok=True)
    (ACC / "lid-input.md").write_text("\n".join(parts), encoding="utf-8")
    save_json(ACC / "lid-key.json", key)
    print(len(chosen), "songs;", dict(collections.Counter(k["label"] for k in key)))


def detectors():
    import gcld3
    from lingua import LanguageDetectorBuilder
    cld3 = gcld3.NNetLanguageIdentifier(min_num_bytes=0, max_num_bytes=20000)
    lingua = LanguageDetectorBuilder.from_all_languages().with_preloaded_language_models().build()

    def run(lyrics):
        text, used = lid_text(lyrics)
        r = cld3.FindLanguage(text=text)
        c = {"code": CLD3_TO_639_3.get(r.language, r.language), "p": round(r.probability, 3), "reliable": r.is_reliable}
        conf = lingua.compute_language_confidence_values(text)
        top = conf[0] if conf else None
        l = {"code": top.language.iso_code_639_3.name.lower() if top else None,
             "p": round(top.value, 3) if top else None}
        return {"input": used, "cld3": c, "lingua": l}
    return run


def free_lid():
    run = detectors()
    out = {}
    for name in ("translation-worklist.json", "language-review.json", "glossary-sources.json"):
        for s in songs(name):
            sid = song_id(s)
            if sid not in out:
                out[sid] = run(s["lyrics"])
    save_json(ACC / "free-lid.json", out)
    print(len(out), "songs labelled by CLD3 and Lingua")


def score_lid():
    key = json.load(open(ACC / "lid-key.json"))
    ans = {a["tid"]: a for a in json.load(open(ACC / "lid-answers.json"))}
    free = json.load(open(ACC / "free-lid.json"))
    rows, per = [], collections.defaultdict(lambda: collections.Counter())
    for k in key:
        a = ans.get(k["tid"], {})
        f = free[k["id"]]
        claude_ok = same(a.get("code"), k["code"])
        cld3_ok = same(f["cld3"]["code"], k["code"])
        lingua_ok = same(f["lingua"]["code"], k["code"])
        both_free = same(f["cld3"]["code"], f["lingua"]["code"])
        p = per[k["label"]]
        p["n"] += 1
        p["claude"] += claude_ok
        p["cld3"] += cld3_ok
        p["lingua"] += lingua_ok
        p["claude high/med"] += a.get("confidence") in ("high", "medium")
        p["claude high/med right"] += claude_ok and a.get("confidence") in ("high", "medium")
        p["claude and a free model agree"] += same(a.get("code"), f["cld3"]["code"]) or same(a.get("code"), f["lingua"]["code"])
        p["agree and right"] += (same(a.get("code"), f["cld3"]["code"]) or same(a.get("code"), f["lingua"]["code"])) and claude_ok
        rows.append({"tid": k["tid"], "id": k["id"], "reference": k["code"], "claude": a.get("code"),
                     "claude confidence": a.get("confidence"), "cld3": f["cld3"]["code"], "lingua": f["lingua"]["code"],
                     "claude right": claude_ok, "cld3 right": cld3_ok, "lingua right": lingua_ok,
                     "claude note": a.get("note", "")})
    total = collections.Counter()
    for p in per.values():
        total.update(p)
    with open(ACC / "lid-results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    result = {"per language": {k: dict(v) for k, v in sorted(per.items())}, "total": dict(total)}
    save_json(ACC / "lid-score.json", result)
    print(json.dumps(result["total"]))
    for k, v in sorted(per.items()):
        print(f"{k:12} n={v['n']:2}  claude={v['claude']:2}  cld3={v['cld3']:2}  lingua={v['lingua']:2}")


# --- Test 2: translation back-test ----------------------------------------

MT_SONGS = 42  # a few drop out in the leak check
MAX_LINES = 12
# Songs whose lyrics or translations were shown earlier in this session; excluded to avoid leakage.
SEEN_TITLES = re.compile(r"doing of the lord|september|jesu ke mmoloki|e sili lou atua|alakara|i surrender all", re.I)


def blind_lyrics(lyrics):
    """Lyrics with every English translation removed: bracket-only English lines
    are dropped and trailing English brackets cut."""
    out = []
    for line in lines(lyrics):
        s = line.strip()
        if is_bracket_only(s) and is_english(s[1:-1]):
            continue
        b = trailing_bracket(s)
        if b and is_english(b):
            s = s[: s.rfind("(")].rstrip()
        if "|" in s:
            left, _, right = s.partition("|")
            if is_english(right):
                s = left.rstrip()
        out.append(s)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text)


def _norm(s):
    return " ".join(re.findall(r"\w+", s.lower()))


def strip_references(text, refs):
    """Second pass: remove any line or bracket whose words match a hidden reference
    (catches English sung as its own line, which the bracket rules miss)."""
    refs = [_norm(r) for r in refs if len(_norm(r)) >= 8]

    def hit(t):
        t = _norm(t)
        return bool(t) and any(r in t or (len(t) >= 8 and t in r) for r in refs)
    out = []
    for line in text.split("\n"):
        line = ROUND.sub(lambda m: "" if hit(m.group(1)) else m.group(0), line)
        line = SQUARE.sub(lambda m: "" if hit(m.group(1)) else m.group(0), line)
        if hit(line) and english_share(line) >= 0.5:
            continue
        out.append(line.rstrip())
    return "\n".join(out)


def leak_share(text, refs):
    t = _norm(text)
    sh = set()
    for r in refs:
        w = _norm(r).split()
        sh |= {" ".join(w[i:i + 4]) for i in range(len(w) - 3)}
    return sum(x in t for x in sh) / len(sh) if sh else 0.0


def blind_title(t):
    t = ROUND.sub(lambda m: "" if is_english(m.group(1)) else m.group(0), t or "")
    return " ".join(t.split())


def build_mt():
    rng = random.Random(SEED)
    pairs = json.load(open(OUT / "glossary-pairs.json"))["items"]
    free = json.load(open(ACC / "free-lid.json"))
    pool = [s for s in pairs if s["pattern"] != "Full song, then an English version" and not SEEN_TITLES.search(s["title"])
            and len(s["pairs"]) >= 4]
    # stratify by the free models' guess so no single language dominates
    by_guess = collections.defaultdict(list)
    for s in pool:
        f = free.get(s["id"])
        g = f["cld3"]["code"] if f else "?"
        by_guess[g].append(s)
    for v in by_guess.values():
        rng.shuffle(v)
    chosen = []
    while len(chosen) < MT_SONGS and any(by_guess.values()):
        for g in sorted(by_guess, key=lambda g: -len(by_guess[g])):
            if by_guess[g] and len(chosen) < MT_SONGS:
                chosen.append(by_guess[g].pop())
    lyrics_by_id = {s["id"]: s["lyrics"] for s in songs("glossary-sources.json")}
    key, parts = [], ["# Translation back-test\n\nTranslate each listed line (index i) into English. "
                      "The original English has been removed. Lines are 0-based indices into the shown lyrics.\n"]
    dropped = []
    n = 0
    for s in chosen:
        refs = [p["english"] for p in s["pairs"]]
        shown = strip_references(blind_lyrics(lyrics_by_id[s["id"]]), refs)
        title = blind_title(s["title"])
        if leak_share(shown + "\n" + title, refs) > 0.05:
            dropped.append(s["id"])
            continue
        n += 1
        tid = f"T{n:03d}"
        seen, todo = set(), []
        for p in s["pairs"]:
            k = p["source"].strip().lower()
            if k in seen:
                continue
            seen.add(k)
            todo.append(p)
        todo = todo[:MAX_LINES]
        key.append({"tid": tid, "id": s["id"], "title": s["title"],
                    "lines": [{"n": j, "source": p["source"], "reference": p["english"]} for j, p in enumerate(todo)]})
        parts.append(f"## {tid}\ntitle: {title}\nartist: {s['artist'] or ''}\n"
                     f"lyrics (English removed):\n```\n{clip(shown, 2500)}\n```\nlines to translate:\n"
                     + "\n".join(f"{j}\t{p['source']}" for j, p in enumerate(todo)) + "\n")
    (ACC / "mt-input.md").write_text("\n".join(parts), encoding="utf-8")
    save_json(ACC / "mt-key.json", key)
    print(n, "songs,", sum(len(k["lines"]) for k in key), "lines; dropped for leaking English:", len(dropped))


def content_recall(hyp, ref):
    stop = {"the", "a", "an", "of", "to", "and", "in", "is", "are", "be", "my", "your", "you", "i", "me", "we", "our",
            "us", "it", "for", "on", "with", "that", "this", "o", "oh", "all", "will", "has", "have", "who", "what"}
    r = {w for w in words(ref) if w not in stop}
    h = {w for w in words(hyp) if w not in stop}
    if not r:
        return None
    return len(r & h) / len(r)


def visible_hints():
    """(tid, n) of lines whose shown lyrics still carry an English bracket on or right after
    the line: a church translation the extractor did not pair. Scored separately."""
    txt = (ACC / "mt-input.md").read_text(encoding="utf-8")
    hints = set()
    for tid, body in re.findall(r"## (T\d+)\n(.*?)(?=\n## T|\Z)", txt, re.S):
        lyr = body.split("```")[1].split("\n")
        todo = body.split("lines to translate:\n")[1].strip().split("\n")
        for row in todo:
            n, _, src = row.partition("\t")
            for j, l in enumerate(lyr):
                if l.strip().startswith(src.strip()):
                    nxt = next((x for x in lyr[j + 1:] if x.strip()), "")
                    extra = l.strip()[len(src.strip()):]
                    if (ROUND.search(extra) and is_english(ROUND.search(extra).group(1))) or \
                            (nxt.strip().startswith("(") and is_english(nxt.strip("() "))):
                        hints.add((tid, int(n)))
    return hints


def score_mt():
    from sacrebleu.metrics import CHRF
    chrf = CHRF(word_order=2, lowercase=True)  # many church references are typed in capitals
    key = {k["tid"]: k for k in json.load(open(ACC / "mt-key.json"))}
    ans = {a["tid"]: a for a in json.load(open(ACC / "mt-answers.json"))}
    rows = []
    hints = visible_hints()
    by_lang = collections.defaultdict(lambda: {"hyp": [], "ref": [], "recall": [], "conf": collections.Counter()})
    by_conf = collections.defaultdict(lambda: ([], []))
    clean = ([], [])
    for tid, k in key.items():
        a = ans.get(tid)
        if not a:
            continue
        lang = a["language"]
        got = {l["n"]: l for l in a["lines"]}
        for l in k["lines"]:
            g = got.get(l["n"], {"english": "", "confidence": "missing"})
            s = chrf.sentence_score(g["english"], [l["reference"]]).score
            rec = content_recall(g["english"], l["reference"])
            b = by_lang[lang]
            b["hyp"].append(g["english"])
            b["ref"].append(l["reference"])
            b["conf"][g["confidence"]] += 1
            if rec is not None:
                b["recall"].append(rec)
            by_conf[g["confidence"]][0].append(g["english"])
            by_conf[g["confidence"]][1].append(l["reference"])
            if (tid, l["n"]) not in hints:
                clean[0].append(g["english"])
                clean[1].append(l["reference"])
            rows.append({"tid": tid, "song id": k["id"], "language": lang, "n": l["n"], "source": l["source"],
                         "human English": l["reference"], "Claude English": g["english"],
                         "Claude confidence": g["confidence"], "chrF++": round(s, 1),
                         "content-word recall": round(rec, 2) if rec is not None else "",
                         "English hint visible": (tid, l["n"]) in hints})
    summary = {}
    all_h, all_r = [], []
    for lang, b in sorted(by_lang.items(), key=lambda x: -len(x[1]["hyp"])):
        summary[lang] = {"songs": len({r["tid"] for r in rows if r["language"] == lang}), "lines": len(b["hyp"]),
                         "chrF++": round(chrf.corpus_score(b["hyp"], [b["ref"]]).score, 1),
                         "content-word recall": round(sum(b["recall"]) / len(b["recall"]), 2) if b["recall"] else None,
                         "confidence": dict(b["conf"])}
        all_h += b["hyp"]
        all_r += b["ref"]
    summary["ALL"] = {"lines": len(all_h), "chrF++": round(chrf.corpus_score(all_h, [all_r]).score, 1)}
    summary["ALL without visible hints"] = {"lines": len(clean[0]),
                                            "chrF++": round(chrf.corpus_score(clean[0], [clean[1]]).score, 1)}
    summary["by Claude confidence"] = {c: {"lines": len(h), "chrF++": round(chrf.corpus_score(h, [r]).score, 1)}
                                       for c, (h, r) in sorted(by_conf.items())}
    rows.sort(key=lambda r: r["chrF++"])
    with open(ACC / "mt-results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) + ["judgement"])
        w.writeheader()
        w.writerows(rows)
    save_json(ACC / "mt-score.json", summary)
    print(json.dumps(summary, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    {"build-lid": build_lid, "free-lid": free_lid, "build-mt": build_mt,
     "score-lid": score_lid, "score-mt": score_mt}[sys.argv[1]]()
