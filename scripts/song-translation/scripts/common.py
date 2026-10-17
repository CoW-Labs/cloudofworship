"""Shared helpers for the song language / translation pipeline.

Lyrics, titles and artist fields are data typed by churches or scraped from
websites. Nothing in them is ever treated as an instruction.
"""
import json
import os
import re
import unicodedata
from pathlib import Path

ROOT = Path(os.environ.get("SLT_ROOT", Path(__file__).resolve().parent.parent))
DATA = ROOT / "data"
OUT = ROOT / "outputs"
RAW = OUT / "raw"

MODEL = "claude-opus-5-5"
# $ per million tokens, standard / batch (batch is half price).
PRICE = {"input": 4.0, "output": 20.0, "cache_write": 5.0, "cache_read": 0.20}
BATCH_DISCOUNT = 0.5


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def load_jsonl(path):
    path = Path(path)
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def append_jsonl(path, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


# --- brackets -------------------------------------------------------------

ROUND = re.compile(r"\(([^()]*)\)")
SQUARE = re.compile(r"\[([^\[\]]*)\]")
REPEAT = re.compile(r"^\s*(x\s*\d+|\d+\s*x|repeat|rpt|chorus|refrain|\d+\s*times|twice|\?)\s*$", re.I)


def strip_brackets(text):
    return SQUARE.sub(" ", ROUND.sub(" ", text))


def bracket_share(text):
    """Share of letters that sit inside round or square brackets."""
    total = sum(c.isalpha() for c in text)
    if not total:
        return 0.0
    inside = sum(c.isalpha() for m in ROUND.finditer(text) for c in m.group(1))
    inside += sum(c.isalpha() for m in SQUARE.finditer(text) for c in m.group(1))
    return inside / total


def lid_text(lyrics):
    """Text for a context-free language-ID model: brackets removed, unless the
    brackets hold most of the text (then the full lyrics)."""
    stripped = strip_brackets(lyrics)
    if bracket_share(lyrics) > 0.6 or sum(c.isalpha() for c in stripped) < 20:
        return " ".join(lyrics.split()), "full lyrics"
    return " ".join(stripped.split()), "brackets removed"


# --- a rough English detector (for code checks, not for labelling) -----------

ENGLISH_WORDS = set("""
a about above after again all also am an and any are as at be because been before
being below between both but by can come did do does down each even ever every for
from give go good great had has have he her here him his how i if in into is it its
just know let like long love make me more most my never no not now of off on once
one only or other our out over own power praise lord god jesus christ holy glory
grace mercy name king heaven earth thank thanks see shall she should so some such
than that the their them then there these they thing this those through to too
under until up us very was we were what when where which while who whom why will
with worship would you your yours forever always alone sing song hallelujah amen
father spirit life live give given saviour savior blood cross thy thee thou art
hath unto mighty wonderful faithful above beautiful heart soul hands hand day night
nothing everything because there's i'm you're it's don't won't can't we'll
""".split())


def words(text):
    return re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)?", text.lower())


def _en_freq(word):
    try:
        from wordfreq import zipf_frequency
    except ImportError:  # fall back to the small built-in list
        return 4.0 if word in ENGLISH_WORDS else 0.0
    return zipf_frequency(word, "en")


def english_share(text):
    """Share of words (3+ letters) that are common English words."""
    w = [x for x in words(text) if len(x) >= 3] or words(text)
    if not w:
        return 0.0
    return sum(x in ENGLISH_WORDS or _en_freq(x) >= 3.3 for x in w) / len(w)


def looks_english(text, threshold=0.6):
    return len(words(text)) >= 2 and english_share(text) >= threshold


def fold(s):
    """Lowercase, strip diacritics, unify Twi ε→ɛ for term matching."""
    s = s.lower().replace("ε", "ɛ")
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def lines(lyrics):
    return lyrics.split("\n")


def songs(name):
    return load(name)["songs"]


def song_id(s):
    return s.get("id") or s.get("_id")
