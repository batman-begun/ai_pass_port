#!/usr/bin/env python3
"""Run the M0 Gemini chatbot technical spike without storing secrets.

Requires GEMINI_API_KEY in the environment. Writes a sanitized JSON result file
with request metrics, parsed structured outputs, and pass/fail flags.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DEFAULT_FIXTURES = ROOT / "fixtures.json"
DEFAULT_OUTPUT = ROOT / "results.json"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

RESULT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "match_status": {"type": "string", "enum": ["resolved", "disambiguation", "insufficient"]},
        "business_name": {"type": "string"},
        "area_or_address": {"type": "string"},
        "category_guess": {"type": "string"},
        "match_confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "resolve_reason_vi": {"type": "string"},
        "semantic_clusters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label_vi": {"type": "string"},
                    "example_query_vi": {"type": "string"},
                    "relevance": {"type": "string", "enum": ["low", "medium", "high"]},
                    "inference_notice_vi": {"type": "string"}
                },
                "required": ["label_vi", "example_query_vi", "relevance", "inference_notice_vi"]
            },
            "minItems": 2,
            "maxItems": 4
        },
        "observations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "signal_key": {"type": "string"},
                    "label_vi": {"type": "string"},
                    "status": {"type": "string", "enum": ["confirmed_fact", "public_observation", "inference_needs_confirmation", "missing_signal", "conflict"]},
                    "customer_copy_vi": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    "requires_owner_confirmation": {"type": "boolean"}
                },
                "required": ["signal_key", "label_vi", "status", "customer_copy_vi", "confidence", "requires_owner_confirmation"]
            },
            "minItems": 4,
            "maxItems": 8
        },
        "score_snapshot": {
            "type": "object",
            "properties": {
                "total_score": {"type": "integer", "minimum": 0, "maximum": 100},
                "evidence_confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                "confidence_explanation_vi": {"type": "string"},
                "disclaimer_vi": {"type": "string"}
            },
            "required": ["total_score", "evidence_confidence", "confidence_explanation_vi", "disclaimer_vi"]
        },
        "gap_questions": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 6},
        "mini_preview": {
            "type": "object",
            "properties": {
                "tagline_vi": {"type": "string"},
                "summary_vi": {"type": "string"},
                "watermark_vi": {"type": "string"}
            },
            "required": ["tagline_vi", "summary_vi", "watermark_vi"]
        },
        "hallucination_guard_notes": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5}
    },
    "required": [
        "match_status", "business_name", "area_or_address", "category_guess", "match_confidence",
        "resolve_reason_vi", "semantic_clusters", "observations", "score_snapshot", "gap_questions",
        "mini_preview", "hallucination_guard_notes"
    ]
}

SYSTEM_GUARDRAILS = """
Bạn là backend analyst cho AI Passport / Soi Gương AI. Nhiệm vụ: resolve business public và dựng snapshot cho guided infographic.
Không hứa tăng doanh số, không hứa lên top Google, không nói AI chắc chắn nhắc tên business.
Không bịa phone, Zalo, giá, menu, giờ mở cửa, chứng nhận, chỗ đậu xe hoặc quyền hình ảnh.
Tách rõ confirmed_fact, public_observation, inference_needs_confirmation, missing_signal, conflict.
Nếu seed mơ hồ/trùng tên/footprint mỏng, trả match_status=disambiguation hoặc insufficient và đặt confidence thấp.
Score là checklist nội bộ AI Passport, không phải điểm chính thức của Google hoặc nền tảng AI.
""".strip()


def call_gemini(model: str, body: dict[str, Any], key: str, timeout: int) -> dict[str, Any]:
    url = f"{API_BASE}/{model}:generateContent"
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000), "response": payload}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")[:2000]
        return {"ok": False, "latency_ms": round((time.perf_counter() - started) * 1000), "error": f"HTTP {exc.code}: {err}"}
    except Exception as exc:  # noqa: BLE001 - command-line diagnostic tool
        return {"ok": False, "latency_ms": round((time.perf_counter() - started) * 1000), "error": f"{type(exc).__name__}: {exc}"}


def extract_text(response: dict[str, Any]) -> str:
    return response.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


def extract_grounding_count(response: dict[str, Any]) -> int:
    metadata = response.get("candidates", [{}])[0].get("groundingMetadata", {})
    chunks = metadata.get("groundingChunks") or []
    supports = metadata.get("groundingSupports") or []
    return max(len(chunks), len(supports))


def parse_json_text(text: str) -> tuple[bool, Any, str | None]:
    try:
        return True, json.loads(text), None
    except json.JSONDecodeError as exc:
        return False, None, str(exc)


def expected_pass(expected: str, status: str) -> bool:
    allowed = {
        "resolve": {"resolved"},
        "resolve_or_disambiguate": {"resolved", "disambiguation"},
        "resolve_or_low_confidence": {"resolved", "disambiguation", "insufficient"},
        "disambiguation_or_resolve": {"resolved", "disambiguation"},
        "disambiguation_or_insufficient": {"disambiguation", "insufficient"},
        "insufficient_or_low_confidence": {"disambiguation", "insufficient"},
    }
    return status in allowed.get(expected, {expected})


def build_option_b_body(seed: str) -> dict[str, Any]:
    prompt = f"""{SYSTEM_GUARDRAILS}

Seed khách nhập: {seed}

Hãy dùng public web/search/url context nếu có để trả JSON đúng schema cho MVP Slice 1.
Chỉ đưa dữ kiện có thể nói với khách; mọi inference phải gắn nhãn cần xác nhận.
"""
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"googleSearch": {}}, {"urlContext": {}}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 6000,
            "responseMimeType": "application/json",
            "responseJsonSchema": RESULT_SCHEMA,
        },
    }


def build_discovery_body(seed: str) -> dict[str, Any]:
    prompt = f"""{SYSTEM_GUARDRAILS}

Seed khách nhập: {seed}

Pass 1 discovery: tìm tín hiệu public để resolve business. Trả về bullet text ngắn gồm:
- candidate(s), area/address/category nếu thấy
- evidence signals và uncertainty
- missing/conflicting signals
- câu hỏi cần hỏi owner nếu mơ hồ
Không cần JSON ở pass này.
"""
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"googleSearch": {}}, {"urlContext": {}}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2400},
    }


def build_normalize_body(seed: str, discovery_text: str) -> dict[str, Any]:
    prompt = f"""{SYSTEM_GUARDRAILS}

Seed khách nhập: {seed}

Discovery notes từ pass 1:
{discovery_text[:7000]}

Pass 2 normalize: chuyển discovery notes thành JSON đúng schema. Không thêm dữ kiện mới ngoài discovery notes.
Nếu discovery không đủ chắc, trả disambiguation/insufficient.
"""
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 6000,
            "responseMimeType": "application/json",
            "responseJsonSchema": RESULT_SCHEMA,
        },
    }


def run_fixture(fixture: dict[str, Any], key: str, option_b_model: str, option_a_discovery_model: str, option_a_normalize_model: str, timeout: int) -> dict[str, Any]:
    seed = fixture["seed"]
    out: dict[str, Any] = {"fixture": fixture, "option_b": {}, "option_a": {}}

    b = call_gemini(option_b_model, build_option_b_body(seed), key, timeout)
    out["option_b"] = summarize_structured_call(b)

    d = call_gemini(option_a_discovery_model, build_discovery_body(seed), key, timeout)
    discovery_text = extract_text(d.get("response", {})) if d.get("ok") else ""
    n = call_gemini(option_a_normalize_model, build_normalize_body(seed, discovery_text), key, timeout) if d.get("ok") else {"ok": False, "latency_ms": 0, "error": "Skipped normalize because discovery failed"}
    out["option_a"] = summarize_structured_call(n)
    out["option_a"]["discovery_ok"] = d.get("ok", False)
    out["option_a"]["discovery_latency_ms"] = d.get("latency_ms")
    out["option_a"]["discovery_usage"] = d.get("response", {}).get("usageMetadata") if d.get("ok") else None
    out["option_a"]["discovery_grounding_count"] = extract_grounding_count(d.get("response", {})) if d.get("ok") else 0
    out["option_a"]["discovery_excerpt"] = discovery_text[:900]
    out["option_a"]["total_latency_ms"] = (out["option_a"].get("latency_ms") or 0) + (d.get("latency_ms") or 0)
    return out


def summarize_structured_call(call: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {"ok": call.get("ok"), "latency_ms": call.get("latency_ms")}
    if not call.get("ok"):
        summary["error"] = call.get("error")
        summary["json_valid"] = False
        return summary
    response = call["response"]
    text = extract_text(response)
    valid, parsed, parse_error = parse_json_text(text)
    summary.update({
        "usage": response.get("usageMetadata"),
        "grounding_count": extract_grounding_count(response),
        "json_valid": valid,
        "parse_error": parse_error,
        "parsed": parsed if valid else None,
        "raw_text_excerpt": text[:700] if not valid else None,
    })
    return summary


def aggregate(results: list[dict[str, Any]], option_key: str) -> dict[str, Any]:
    items = [r[option_key] for r in results]
    valid = [i for i in items if i.get("json_valid")]
    lat_key = "total_latency_ms" if option_key == "option_a" else "latency_ms"
    latencies = [i.get(lat_key) for i in items if isinstance(i.get(lat_key), int)]
    resolve_pass = 0
    no_fake_critical = 0
    for result in results:
        parsed = result[option_key].get("parsed") or {}
        status = parsed.get("match_status", "")
        if expected_pass(result["fixture"].get("expected_behavior", ""), status):
            resolve_pass += 1
        bad = False
        for obs in parsed.get("observations", []) if isinstance(parsed.get("observations"), list) else []:
            if obs.get("signal_key") in {"phone", "zalo", "price", "opening_hours", "parking", "certification"} and obs.get("status") == "confirmed_fact":
                bad = True
        if not bad:
            no_fake_critical += 1
    return {
        "runs": len(items),
        "json_valid": len(valid),
        "json_valid_pct": round(len(valid) / len(items) * 100, 1) if items else 0,
        "resolve_expected_pass": resolve_pass,
        "no_fake_critical_pass": no_fake_critical,
        "latency_ms_avg": round(statistics.mean(latencies)) if latencies else None,
        "latency_ms_p50": round(statistics.median(latencies)) if latencies else None,
        "latency_ms_max": max(latencies) if latencies else None,
        "total_tokens": sum((i.get("usage") or {}).get("totalTokenCount", 0) for i in items),
        "prompt_tokens": sum((i.get("usage") or {}).get("promptTokenCount", 0) for i in items),
        "candidate_tokens": sum((i.get("usage") or {}).get("candidatesTokenCount", 0) for i in items),
        "thoughts_tokens": sum((i.get("usage") or {}).get("thoughtsTokenCount", 0) for i in items),
        "grounded_runs": sum(1 for i in items if ((i.get("grounding_count") or 0) > 0 or (i.get("discovery_grounding_count") or 0) > 0)), 
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--option-b-model", default="gemini-3-flash-preview")
    parser.add_argument("--option-a-discovery-model", default="gemini-2.5-flash")
    parser.add_argument("--option-a-normalize-model", default="gemini-2.5-flash")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY is required in the environment; never store it in repo files.")

    fixtures = json.loads(args.fixtures.read_text(encoding="utf-8"))
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    results = []
    for fixture in fixtures:
        print(f"Running {fixture['id']} {fixture['industry']}...")
        results.append(run_fixture(fixture, key, args.option_b_model, args.option_a_discovery_model, args.option_a_normalize_model, args.timeout))

    payload = {
        "started_at_utc": started,
        "finished_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "models": {
            "option_b_single_pass": args.option_b_model,
            "option_a_discovery": args.option_a_discovery_model,
            "option_a_normalize": args.option_a_normalize_model,
        },
        "fixtures_count": len(fixtures),
        "aggregates": {
            "option_b": aggregate(results, "option_b"),
            "option_a": aggregate(results, "option_a"),
        },
        "results": results,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["aggregates"], ensure_ascii=False, indent=2))
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
