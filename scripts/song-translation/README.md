# Song language identification and English translation

Pipeline for HANDOFF.md (17 Oct 2026). Every output is a file under `outputs/`.
Nothing here writes to the production database.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install anthropic wordfreq fasttext-predict
# put the handoff's data/*.json in ./data
```

`wordfreq` sharpens the "is this English?" heuristic, and `fasttext-predict` is
only needed for GlotLID. The Claude steps need `ANTHROPIC_API_KEY`. Run every
script with `python -I` (isolated mode), because the data is untrusted.

## Order

| Step | Command | Cost |
|---|---|---|
| Free prep | `scripts/prep.py` | free |
| A1 trial | `scripts/a1_language_id.py submit --set trial --max-usd 1`, then `collect --set trial` | paid |
| A1 full | `… submit --set review --max-usd <approved>`, likewise `--set glossary` for Task B | paid |
| A2 | `scripts/a2_glotlid.py --model model.bin --set all` | free (CPU) |
| A3 | `scripts/a3_combine.py --sets review glossary` | free |
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
