from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from typing import Any

def _string_set(value: Any, field: str, case_id: str) -> set[str]:
    if not isinstance(value, list) or any(not isinstance(x, str) or not x.strip() for x in value):
        raise ValueError(f"{case_id}: {field} must contain non-empty strings only.")
    if len(value) != len(set(value)): raise ValueError(f"{case_id}: {field} contains duplicate finding IDs.")
    return set(value)

def _ratio(n: int, d: int) -> float | None: return n / d if d else None

def evaluate(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("cases"), list) or not payload["cases"]:
        raise ValueError("'cases' must be a non-empty array.")
    seen_cases, rows, tp_total, fp_total, fn_total = set(), [], 0, 0, 0
    for case in payload["cases"]:
        if not isinstance(case, dict): raise ValueError("Each case must be a JSON object.")
        case_id = case.get("case_id")
        if not isinstance(case_id, str) or not case_id.strip(): raise ValueError("Every case requires a non-empty string case_id.")
        if case_id in seen_cases: raise ValueError(f"Duplicate case_id: {case_id}")
        seen_cases.add(case_id)
        expected = _string_set(case.get("expected_findings"), "expected_findings", case_id)
        actual = _string_set(case.get("actual_findings"), "actual_findings", case_id)
        tp, fp, fn = len(expected & actual), len(actual - expected), len(expected - actual)
        tp_total, fp_total, fn_total = tp_total + tp, fp_total + fp, fn_total + fn
        precision, recall = _ratio(tp, tp + fp), _ratio(tp, tp + fn)
        f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else (0.0 if precision == 0 or recall == 0 else None)
        rows.append({"case_id": case_id, "expected_count": len(expected), "actual_count": len(actual), "tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall, "f1": f1})
    precision, recall = _ratio(tp_total, tp_total + fp_total), _ratio(tp_total, tp_total + fn_total)
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else (0.0 if precision == 0 or recall == 0 else None)
    return {"schema_version": 1, "dataset_version": payload.get("dataset_version", "unspecified"), "case_count": len(rows), "micro": {"tp": tp_total, "fp": fp_total, "fn": fn_total, "precision": precision, "recall": recall, "f1": f1}, "per_case": rows, "limitations": ["Exact finding-ID matches only.", "Ground truth requires qualified review.", "No exploitability or audit-completeness measurement."]}

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True, type=Path); parser.add_argument("--output", required=True, type=Path); args = parser.parse_args()
    try:
        result = evaluate(json.loads(args.input.read_text(encoding="utf-8"))); args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"BENCHMARK FAILED: {exc}", file=sys.stderr); return 1
    print(f"Benchmark evaluated {result['case_count']} cases; micro F1={result['micro']['f1']!r}. Output: {args.output}"); return 0

if __name__ == "__main__": raise SystemExit(main())
