# Song language identification and English translation

Pipeline for HANDOFF.md (17 Oct 2026). Every output is a file under `outputs/`.
Nothing here writes to the production database.

## Setup

```bash
python3 -m venv .venv
sudo apt-get install -y protobuf-compiler libprotobuf-dev   # needed to build gcld3
.venv/bin/pip install anthropic wordfreq gcld3 lingua-language-detector sacrebleu fasttext-predict
# put the handoff's data/*.json in ./data
```

`wordfreq` sharpens the "is this English?" heuristic. `gcld3` (CLD3) and `lingua-language-detector`
are the offline language-ID pair that replaces GlotLID while huggingface.co is
unreachable; both ship their models inside the package. `fasttext-predict` is
only needed if GlotLID becomes reachable. The Claude steps need `ANTHROPIC_API_KEY`. Run every
script with `python -I` (isolated mode), because the data is untrusted.

## Order

| Step | Command | Cost |
|---|---|---|
| Free prep | `scripts/prep.py` | free |
| Accuracy tests, first | `scripts/accuracy.py build-lid / free-lid / build-mt`, then answers into `outputs/accuracy/lid-answers.json` and `mt-answers.json`, then `score-lid / score-mt` | free when the answers come from a Claude Code session |
| A1 trial | `scripts/a1_language_id.py submit --set trial --max-usd 1`, then `collect --set trial` | paid |
| A1 full | `… submit --set review --max-usd <approved>`, likewise `--set glossary` for Task B | paid |
| A2 | `scripts/accuracy.py free-lid` (CLD3 + Lingua), or `scripts/a2_glotlid.py --model model.bin --set all` | free (CPU) |
| A3 | `scripts/a3_combine.py --sets review glossary --a2 offline` | free |
| B | `scripts/b_glossary.py build / submit --max-usd 5 / collect / write` | paid |
| C | `scripts/c_pilot.py select / build-translate / submit-translate … / check / build-review / submit-review … / collect-review / report` | paid |

Every `submit` builds the requests, estimates the cost, and refuses to submit
above `--max-usd`. The estimate uses rates measured on earlier runs of the
same task once there are at least 10 (`outputs/raw/usage.jsonl`), and rough
defaults before that.

`collect` checks `stop_reason` on every result. A refusal is re-run once as a
normal request with server-side fallback (`fallbacks: "default"`), because the
Batch API does not accept fallbacks. Truncated, errored, expired and bad-JSON
results are counted and kept, not dropped. Results are keyed by `custom_id`, so
the order they arrive in does not matter.

One request goes out per `copyGroup`, and its answer applies to every copy.
Translations are keyed by song id and line index, and lyrics are never edited.

The accuracy tests keep their answers in `*-key.json` files that the translator
never reads. `build-mt` strips every bracketed English line and every line that
matches a hidden answer, then drops any song whose input still overlaps the
answers by more than 5% of 4-word phrases.
