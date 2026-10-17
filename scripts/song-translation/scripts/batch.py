"""Message Batches plumbing shared by the paid tasks.

Every paid step goes: build (offline, writes requests) -> estimate -> submit
(refuses above --max-usd) -> collect (polls, parses, re-runs refusals as normal
requests with server-side fallback, logs usage).
"""
import json
import time
from pathlib import Path

from common import BATCH_DISCOUNT, MODEL, PRICE, RAW, append_jsonl, load_jsonl, save_json

USAGE_LOG = RAW / "usage.jsonl"

# Rough token rates used only before anything has been measured. Non-English
# lyrics tokenise worse than English, so these lean high.
CHARS_PER_TOKEN = 2.5
DEFAULT_OUTPUT_TOKENS = {"low": 600, "medium": 1200, "high": 2500}


def request(custom_id, system, user, schema, effort, max_tokens):
    return {
        "custom_id": custom_id,
        "params": {
            "model": MODEL,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        },
    }


def cached_system(text):
    """Fixed instructions first, marked for prompt caching (only takes effect
    once the prefix passes the model's minimum cacheable length)."""
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


def write_requests(task, name, reqs):
    path = RAW / f"{task}-{name}-requests.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in reqs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return path


def measured_rates(task):
    """Average input chars/token and output tokens/request from earlier runs of this task."""
    rows = [r for r in load_jsonl(USAGE_LOG) if r["task"] == task and r.get("input_chars")]
    if len(rows) < 10:
        return None
    toks = sum(r["input_tokens"] + r.get("cache_read_input_tokens", 0) + r.get("cache_creation_input_tokens", 0)
               for r in rows)
    return {"chars_per_token": sum(r["input_chars"] for r in rows) / max(toks, 1),
            "output_tokens": sum(r["output_tokens"] for r in rows) / len(rows), "n": len(rows)}


def estimate(task, reqs, effort, batch=True):
    m = measured_rates(task)
    cpt = m["chars_per_token"] if m else CHARS_PER_TOKEN
    out = m["output_tokens"] if m else DEFAULT_OUTPUT_TOKENS.get(effort, 2500)
    chars = sum(_input_chars(r["params"]) for r in reqs)
    in_tok = chars / cpt
    out_tok = out * len(reqs)
    usd = (in_tok * PRICE["input"] + out_tok * PRICE["output"]) / 1e6
    if batch:
        usd *= BATCH_DISCOUNT
    return {"requests": len(reqs), "input_tokens": round(in_tok), "output_tokens": round(out_tok),
            "usd": round(usd, 2), "basis": f"measured on {m['n']} requests" if m else "rough default rates"}


def _input_chars(params):
    sys_text = "".join(b["text"] for b in params["system"]) if isinstance(params["system"], list) else params["system"]
    return len(sys_text) + sum(len(m["content"]) for m in params["messages"])


def client():
    import anthropic
    return anthropic.Anthropic()


def submit(task, name, reqs, max_usd, effort):
    est = estimate(task, reqs, effort)
    print(f"{task}/{name}: {est}")
    if est["usd"] > max_usd:
        raise SystemExit(f"Estimated ${est['usd']} is above the approved limit ${max_usd}. Not submitted.")
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request
    c = client()
    batch = c.messages.batches.create(requests=[
        Request(custom_id=r["custom_id"], params=MessageCreateParamsNonStreaming(**r["params"])) for r in reqs])
    state = {"task": task, "name": name, "batch_id": batch.id, "submitted": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "estimate": est, "max_usd": max_usd, "requests": len(reqs)}
    save_json(RAW / f"{task}-{name}-batch.json", state)
    print("submitted", batch.id)
    return state


def _text(content):
    return next((b.text for b in content if b.type == "text"), "")


def _log_usage(task, custom_id, usage, mode, params):
    append_jsonl(USAGE_LOG, [{
        "task": task, "custom_id": custom_id, "mode": mode,
        "input_tokens": usage.input_tokens, "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
        "input_chars": _input_chars(params),
    }])


def _rerun_with_fallback(c, task, cid, params):
    """Batch API rejects `fallbacks`; refusals are re-run once as a normal request with it."""
    msg = c.beta.messages.create(**params, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    _log_usage(task, cid, msg.usage, "fallback rerun", params)
    return msg


def collect(task, name, poll=60):
    state = json.load(open(RAW / f"{task}-{name}-batch.json"))
    reqs = {r["custom_id"]: r for r in load_jsonl(RAW / f"{task}-{name}-requests.jsonl")}
    c = client()
    while True:
        b = c.messages.batches.retrieve(state["batch_id"])
        if b.processing_status == "ended":
            break
        print("waiting:", b.request_counts)
        time.sleep(poll)
    out, summary = [], {"succeeded": 0, "refused": 0, "refusal rescued": 0, "errored": 0, "expired": 0,
                        "canceled": 0, "max_tokens": 0, "bad json": 0}
    for res in c.messages.batches.results(state["batch_id"]):
        cid, kind = res.custom_id, res.result.type
        row = {"custom_id": cid, "status": kind}
        if kind == "succeeded":
            msg = res.result.message
            _log_usage(task, cid, msg.usage, "batch", reqs[cid]["params"])
            if msg.stop_reason == "refusal":
                summary["refused"] += 1
                row["refusal"] = getattr(msg.stop_details, "category", None) if msg.stop_details else None
                msg = _rerun_with_fallback(c, task, cid, reqs[cid]["params"])
                row["rerun"] = True
                if msg.stop_reason == "refusal":
                    row["status"] = "refused"
                    out.append(row)
                    continue
                summary["refusal rescued"] += 1
                row["servedBy"] = msg.model
            if msg.stop_reason == "max_tokens":
                summary["max_tokens"] += 1
                row["status"] = "max_tokens"
                out.append(row)
                continue
            try:
                row["output"] = json.loads(_text(msg.content))
                summary["succeeded"] += 1
            except json.JSONDecodeError:
                summary["bad json"] += 1
                row["status"] = "bad json"
                row["text"] = _text(msg.content)[:2000]
        else:
            summary[kind] = summary.get(kind, 0) + 1
            if kind == "errored":
                row["error"] = str(res.result.error)
        out.append(row)
    path = RAW / f"{task}-{name}-results.jsonl"
    with open(path, "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    cost = cost_of(task)
    state.update({"collected": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "summary": summary,
                  "task_cost_to_date": cost})
    save_json(RAW / f"{task}-{name}-batch.json", state)
    print(summary, cost)
    return out


def cost_of(task):
    tot = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
    usd = 0.0
    for r in load_jsonl(USAGE_LOG):
        if r["task"] != task:
            continue
        for k in tot:
            tot[k] += r.get(k, 0)
        d = BATCH_DISCOUNT if r["mode"] == "batch" else 1.0
        usd += d * (r["input_tokens"] * PRICE["input"] + r["output_tokens"] * PRICE["output"]
                    + r.get("cache_read_input_tokens", 0) * PRICE["cache_read"]
                    + r.get("cache_creation_input_tokens", 0) * PRICE["cache_write"]) / 1e6
    tot["usd"] = round(usd, 2)
    return tot
