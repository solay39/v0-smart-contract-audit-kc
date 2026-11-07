"""Finalize source-bound evidence, including failures, without inventing tool runs."""
import hashlib
import json
import os
from pathlib import Path
import shutil

REPORTS = {
    "slither": "slither.json",
    "mythril": "mythril.json",
    "custom": "custom.json",
    "foundry": "foundry.json",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_object(path):
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def finalize(root, environ=None):
    env = os.environ if environ is None else environ
    out = root / "out"
    out.mkdir(exist_ok=True)
    tools = {}
    for tool, name in REPORTS.items():
        path = out / name
        data = read_object(path)
        outcome = env.get(f"{tool.upper()}_OUTCOME", "skipped")
        shape_ok = (
            isinstance(data.get("issues"), list) if tool == "mythril" else
            isinstance(data.get("results"), dict) and
            isinstance(data["results"].get("detectors", []), list) if tool == "slither" else
            isinstance(data.get("findings"), list) if tool == "custom" else
            data.get("mode") == "submitted-contract-compilation" and
            data.get("tests_executed") is False and data.get("fuzzing_executed") is False
        )
        success = outcome == "success" and data.get("success") is True and shape_ok
        execution = read_object(out / f"{tool}-execution.json")
        if execution.get("timed_out") is True:
            success = False
        status = "COMPLETED" if success else "NOT_RUN" if outcome == "skipped" else "TIMEOUT" if execution.get("timed_out") is True else "FAILED"
        tools[tool] = {"status": status, "step_outcome": outcome, **execution}
        candidates = (
            data.get("results", {}).get("detectors", []) if tool == "slither" and isinstance(data.get("results"), dict)
            else data.get("issues", []) if tool == "mythril"
            else data.get("findings", []) if tool == "custom" else []
        )
        tools[tool]["candidate_count"] = len(candidates) if isinstance(candidates, list) else 0
        if not data or not shape_ok or outcome != "success" or execution.get("timed_out") is True:
            # Preserve malformed/raw output for diagnosis; the consumed report
            # must be an explicit failure rather than an absent/ambiguous result.
            if path.exists():
                shutil.copyfile(path, out / f"{tool}-raw-output.txt")
            data = {"success": False, "error": f"{tool}_{status.lower()}", "step_outcome": outcome}
            data.update({"results": {"detectors": []}} if tool == "slither" else
                        {"issues": []} if tool == "mythril" else
                        {"findings": [], "checks": {}} if tool == "custom" else
                        {"mode": "submitted-contract-compilation", "tests_executed": False,
                         "fuzzing_executed": False, "invariants": 0})
            path.write_text(json.dumps(data, indent=2))

    for name in ("slither-version.txt", "mythril-version.txt", "foundry-version.txt", "pip-freeze.txt", "mythril-pip-freeze.txt"):
        if not (out / name).exists():
            (out / name).write_text("unavailable\n")
    for source, target in (
        (root / "work/Contract.sol", out / "source.sol"),
        (root / "work/source-layout.json", out / "source-layout.json"),
        (root / "work/sources/package-lock.json", out / "source-package-lock.json"),
        (root / "submitted/foundry.toml", out / "foundry.toml"),
    ):
        if source.is_file():
            shutil.copyfile(source, target)
    layout = read_object(out / "source-layout.json")
    source = out / "source.sol"
    if not (out / "meta.json").exists():
        (out / "meta.json").write_text(json.dumps({"solc": None}))
    manifest = {
        "schema_version": 2,
        "job_id": env.get("JOB_ID"),
        "contract_name": env.get("CONTRACT_NAME"),
        "source_sha256": digest(source.read_bytes()) if source.is_file() else None,
        "sources": layout.get("sources", {}),
        "analyzed_path": "work/sources/" + layout.get("entry", ""),
        "github": {
            "repository": env.get("GITHUB_REPOSITORY"),
            "run_id": env.get("GITHUB_RUN_ID"),
            "run_attempt": env.get("GITHUB_RUN_ATTEMPT"),
            "workflow_sha": env.get("GITHUB_SHA"),
        },
        "configuration": {
            "compiler_selection": "inferred-from-source-pragma",
            "deployed_bytecode_matched": False,
            "dependency_resolution": "recorded-not-fully-locked",
        },
        "tools": tools,
        "claims": {
            "slither": tools["slither"]["status"] == "COMPLETED",
            "mythril": tools["mythril"]["status"] == "COMPLETED",
            "custom_regression": tools["custom"]["status"] == "COMPLETED",
            "foundry_compile": tools["foundry"]["status"] == "COMPLETED",
            "protocol_fuzzing": False, "invariants": False, "manual_review": False,
        },
    }
    manifest["artifacts"] = {
        path.name: digest(path.read_bytes()) for path in sorted(out.iterdir())
        if path.is_file() and path.name != "evidence-manifest.json"
    }
    (out / "evidence-manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == "__main__":
    manifest = finalize(Path.cwd())
    # Metadata only, not source text or secrets. Keeps failures inspectable even
    # when an artifact-download client cannot authenticate.
    print("EVIDENCE_SUMMARY " + json.dumps({
        key: manifest[key] for key in ("job_id", "source_sha256", "github", "tools", "claims")
    }, sort_keys=True))
