"""Evidence for one fixed public source snapshot, not a production certification."""
import hashlib
import json
import os
from pathlib import Path

EXPECTED_SHA = "52e494f011e5966f6d1f67045f89ca60843a48a00082c0032dd0ae77da3fe682"
EXPECTED_TESTS = {
    "test_UnauthorizedMintReverts", "test_AuthorizedMintChangesSupply",
    "test_UnauthorizedSetMinterReverts", "test_DelegatedMinterOnly",
    "test_Observation_SetMinterAcceptsZero", "test_Observation_AuthorizedLargeMintSample",
    "test_Observation_DelegationCanRepeat", "testFuzz_UnauthorizedMintReverts",
}


def summarize(root):
    root = Path(root)
    source = root / "Aero.sol"
    digest = hashlib.sha256(source.read_bytes()).hexdigest() if source.exists() else None
    tests, parse_error = [], None
    try:
        payload = json.loads((root / "forge-results.json").read_text())
        if not isinstance(payload, dict):
            raise ValueError("Forge JSON must be an object")
        for suite, result in payload.items():
            if not isinstance(result, dict) or "AeroSourceAuthorizationTest" not in suite:
                continue
            for name, item in result.get("test_results", {}).items():
                tests.append({"name": name, "status": item.get("status"), "kind": item.get("kind")})
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        parse_error = str(exc)
    names = {item["name"].split("(")[0] for item in tests}
    exit_code = (root / "forge-exit-code.txt").read_text().strip() if (root / "forge-exit-code.txt").exists() else None
    passed = bool(digest == EXPECTED_SHA and not parse_error and exit_code == "0" and
                  len(tests) == len(EXPECTED_TESTS) and names == EXPECTED_TESTS and
                  all(item["status"] == "Success" for item in tests))
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir()
             if p.is_file() and p.name != "summary.json"}
    return {
        "schema_version": 1, "benchmark": "aero-source-authorization-v1",
        "status": "EXECUTED_ASSERTIONS_PASSED" if passed else "INCOMPLETE_OR_FAILED",
        "source_sha256": digest, "expected_source_sha256": EXPECTED_SHA,
        "tests_executed": len(tests), "tests": tests, "parse_error": parse_error,
        "forge_exit_code": exit_code, "files": files,
        "github": {k: os.environ.get(v) for k, v in {
            "repository": "GITHUB_REPOSITORY", "run_id": "GITHUB_RUN_ID",
            "run_attempt": "GITHUB_RUN_ATTEMPT", "head_sha": "GITHUB_SHA"}.items()},
        "claims": {"source_snapshot_tests_only": True, "fork_executed": False,
                   "deployment_bytecode_matched": False, "full_protocol_audited": False,
                   "formal_proof_executed": False, "founder_approved": False},
        "limitations": [
            "A passing observation test confirms behavior, not that the behavior is secure.",
            "Configured fuzz runs are not a measured count unless reported in raw Forge metadata.",
            "This is not a fork, exhaustive fuzzing or full-protocol validation.",
        ],
    }


if __name__ == "__main__":
    result = summarize("benchmark-evidence")
    Path("benchmark-evidence/summary.json").write_text(json.dumps(result, indent=2))
    print("AERO_BENCHMARK_SUMMARY " + json.dumps(result))
    raise SystemExit(0 if result["status"] == "EXECUTED_ASSERTIONS_PASSED" else 1)
