"""Task A2: GlotLID (fastText) on each song's lyrics, no context.

Brackets are removed first, so English translations do not dominate; when the
brackets hold most of the text the full lyrics are used instead.

The model is cis-lmu/glotlid on Hugging Face (model.bin, about 1.6 GB). Download it
where huggingface.co is reachable and pass its path:

  python -I scripts/a2_glotlid.py --model /path/to/model.bin [--set review|worklist|glossary|all]

Writes outputs/raw/a2-<set>.jsonl: {id, top: {label, code, script, score}, top3, input}
Needs `fasttext-predict` (prediction-only wheel; `fasttext` itself has no wheel for Python 3.13).
"""
import argparse
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import RAW, lid_text, song_id, songs


def parse(label):
    # __label__yor_Latn -> ("yor", "Latn")
    code, _, script = label.replace("__label__", "").partition("_")
    return code, script


def run(model_path, set_name):
    import fasttext
    model = fasttext.load_model(model_path)
    pools = {
        "review": ["language-review.json"],
        "worklist": ["translation-worklist.json"],
        "glossary": ["glossary-sources.json"],
        "all": ["language-review.json", "translation-worklist.json", "glossary-sources.json"],
    }[set_name]
    seen, out = set(), []
    for name in pools:
        for s in songs(name):
            sid = song_id(s)
            if sid in seen:
                continue
            seen.add(sid)
            text, used = lid_text(s["lyrics"])
            labels, scores = model.predict(text, k=3)
            top3 = []
            for l, p in zip(labels, scores):
                code, script = parse(l)
                top3.append({"label": l.replace("__label__", ""), "code": code, "script": script, "score": round(float(p), 4)})
            out.append({"id": sid, "top": top3[0], "top3": top3, "input": used, "chars": len(text)})
    path = RAW / f"a2-{set_name}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    import json
    with open(path, "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(out)} songs -> {path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--set", default="all", choices=["review", "worklist", "glossary", "all"])
    a = ap.parse_args()
    run(a.model, a.set)
