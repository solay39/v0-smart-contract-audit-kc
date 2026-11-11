"""Fail closed on missing/unsuccessful reports; absence of output is not a clean scan."""
import json
import sys
from pathlib import Path

MYTHRIL_CONTRACTS = (
    "Solay39EnterpriseRegistry", "Solay39AuditRegistry", "AuditRegistry",
)
SEVERITIES = {"informational", "optimization", "low", "medium", "high", "critical"}


def validate_report(path, tool):
    try:
        data = json.loads(Path(path).read_text())
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Missing or invalid {tool} report: {Path(path).name}") from exc
    if not isinstance(data, dict) or data.get("success") is not True or data.get("error"):
        raise ValueError(f"{tool} did not report successful execution: {Path(path).name}")
    if tool == "slither":
        results = data.get("results")
        if not isinstance(results, dict):
            raise ValueError("Slither results must be an object")
        # Slither can omit 'detectors' when successful execution yields no findings.
        issues = results.get("detectors", [])
    else:
        issues = data.get("issues")
    if not isinstance(issues, list):
        raise ValueError(f"Malformed {tool} issue list")
    severe = []
    for issue in issues:
        if not isinstance(issue, dict):
            raise ValueError(f"Malformed {tool} issue")
        severity = issue.get("impact" if tool == "slither" else "severity")
        if not isinstance(severity, str) or severity.lower() not in SEVERITIES:
            raise ValueError(f"Unknown {tool} severity")
        if severity.lower() in {"high", "critical"}:
            severe.append(issue)
    if severe:
        raise ValueError(f"{tool} found {len(severe)} high/critical issue(s): {Path(path).name}")
    return len(issues)


def validate(tool, directory):
    if tool == "slither":
        paths = [Path(directory) / "slither-report.json"]
    elif tool == "mythril":
        paths = [Path(directory) / f"mythril-{contract}.json" for contract in MYTHRIL_CONTRACTS]
    else:
        raise ValueError(f"Unsupported scanner: {tool}")
    counts = [validate_report(path, tool) for path in paths]
    print(f"{tool}: {len(paths)} successful report(s), {sum(counts)} observed issue(s), no high/critical issues.")
    print("This gate does not establish complete coverage, safety or founder approval.")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("Usage: validate-scanner-reports.py slither|mythril REPORTS_DIR")
        validate(sys.argv[1], sys.argv[2])
    except ValueError as exc:
        print(f"SECURITY GATE FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
