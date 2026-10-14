#!/usr/bin/env python3
import argparse
import glob
import json
from pathlib import Path


def load_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return None


def slither_summary(path):
    data = load_json(path)
    if data is None:
        return {"exists": False, "counts": {"high": 0, "medium": 0, "low": 0, "informational": 0}, "findings": []}
    results = data.get("results", [])
    if isinstance(results, dict):
        results = results.get("detectors", results.get("issues", []))
    if not isinstance(results, list):
        results = []
    counts = {"high": 0, "medium": 0, "low": 0, "informational": 0}
    findings = []
    for item in results if isinstance(results, list) else []:
        impact = str(item.get("impact", item.get("severity", "informational"))).lower()
        severity = "high" if impact in {"high", "critical"} else impact if impact in counts else "informational"
        counts[severity] += 1
        findings.append({"check": item.get("check"), "impact": impact, "description": item.get("description")})
    return {"exists": True, "counts": counts, "findings": findings}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports-dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    root = Path(args.reports_dir)
    summary = {"slither": slither_summary(root / "slither-report.json"), "mythril": [], "forge": None, "echidna": None}
    for path in sorted(root.glob("mythril-*.json")):
        data = load_json(path)
        summary["mythril"].append({"path": str(path), "exists": data is not None, "issues": (data or {}).get("issues", [])})
    for key, filename in (("forge", "forge_output.txt"), ("echidna", "echidna_output.txt")):
        path = root / filename
        if path.exists():
            summary[key] = {"path": str(path), "head": path.read_text(errors="replace")[:4000]}
    Path(args.out).write_text(json.dumps(summary, indent=2))
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
