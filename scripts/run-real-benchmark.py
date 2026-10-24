from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from pathlib import Path

ALIASES = {
    "reentrancy": ("reentrancy", "reentrancy-eth", "reentrancy-no-eth"),
    "missing-access-control": ("missing-access-control", "unprotected-upgrade", "arbitrary-send-eth"),
    "tx-origin": ("tx-origin",),
    "unchecked-call": ("unchecked-low-level", "unchecked-send", "unchecked-transfer"),
}

def run(command: list[str], timeout: int) -> tuple[int, str, str]:
    try:
        p = subprocess.run(command, text=True, capture_output=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as exc:
        return 124, exc.stdout or "", f"timeout after {timeout}s\n{exc.stderr or ''}"

def normalize(text: str, tool: str) -> set[str]:
    lower = text.lower()
    found = set()
    for finding, aliases in ALIASES.items():
        if any(alias in lower for alias in aliases):
            found.add(finding)
    if tool == "mythril" and "tx.origin" in lower:
        found.add("tx-origin")
    return found

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="benchmarks/security-cases.json")
    ap.add_argument("--root", default=".")
    ap.add_argument("--reports-dir", default="reports/benchmark")
    ap.add_argument("--timeout", type=int, default=180)
    args = ap.parse_args()
    root, out = Path(args.root).resolve(), Path(args.reports_dir)
    out.mkdir(parents=True, exist_ok=True)
    cases = json.loads((root / args.corpus).read_text(encoding="utf-8"))
    results = []
    for case in cases:
        source = root / "benchmarks" / case["source"] if not Path(case["source"]).is_absolute() else Path(case["source"])
        slither_path, mythril_path = out / f"{case['id']}-slither.json", out / f"{case['id']}-mythril.json"
        slither_code, slither_out, slither_err = run(["slither", str(source), "--json", str(slither_path)], args.timeout)
        myth_code, myth_out, myth_err = run(["myth", "analyze", str(source), "-o", "json", "--execution-timeout", str(args.timeout)], args.timeout)
        mythril_path.write_text(myth_out or myth_err, encoding="utf-8")
        slither_text = slither_path.read_text(encoding="utf-8") if slither_path.exists() else slither_out + slither_err
        results.append({
            "case_id": case["id"], "expected_findings": case["expected"],
            "actual_findings": sorted(normalize(slither_text, "slither") | normalize(myth_out + myth_err, "mythril")),
            "tools": {"slither": {"exit_code": slither_code, "report": str(slither_path)}, "mythril": {"exit_code": myth_code, "report": str(mythril_path)}},
            "status": "complete" if slither_code == 0 and myth_code == 0 else "incomplete",
        })
    payload = {"schema_version": 1, "dataset_version": "public-starter-v1", "tool_versions": {}, "cases": results}
    for tool, command in (("slither", ["slither", "--version"]), ("mythril", ["myth", "version"])):
        code, stdout, stderr = run(command, 30)
        payload["tool_versions"][tool] = (stdout or stderr).strip()
        if code != 0: print(f"{tool} unavailable", file=sys.stderr)
    (out / "benchmark-input.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Executed real Slither/Mythril analysis for {len(results)} cases; input: {out / 'benchmark-input.json'}")
    return 0 if all(row["status"] == "complete" for row in results) else 1

if __name__ == "__main__": raise SystemExit(main())
