#!/usr/bin/env python3
"""Offline, source-bound regression evidence. Never approves or publishes an audit."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[1]
SOURCE_SHA = "52e494f011e5966f6d1f67045f89ca60843a48a00082c0032dd0ae77da3fe682"
SOLC_SHA = "7a5c1d3dc9a8eba62bb2ec37192c9178ae5fe8a54a56e5573fd3c9c17cd9eb48"
FORGE_COMMIT = "6056c5845d34205a83cf7108042adb137325c9df"
FORGE_SHA = "26fc0c5ef0574f543acf496674160fe9a2175922ae44fd32f46ee2d09fdff4bc"
HARNESS = "AeroSourceVerification.t.sol"
UNIT_SUITE = f"test/{HARNESS}:AeroSourceVerificationTest"
INVARIANT_SUITE = f"test/{HARNESS}:AeroSourceInvariantTest"
FUZZ_TESTS = {
    "testFuzz_MintAccounting(uint128)",
    "testFuzz_TransferConservesSupply(uint128,uint128)",
    "testFuzz_AllowanceConsumption(uint128,uint128)",
    "testFuzz_MaxAllowanceUnchanged(uint128)",
    "testFuzz_RejectInsufficientAllowance(uint128)",
    "testFuzz_RejectOverdraft(uint128)",
    "testFuzz_UnauthorizedMint(address,uint256)",
    "testFuzz_MinterRotation(address,uint128)",
}
UNIT_TESTS = {"test_UnauthorizedMinterRotation()", "test_ZeroAddressOperationsRevert()"}
INVARIANTS = {"invariant_SupplyAndBalancesMatchModel()", "invariant_MinterRemainsHandler()"}
INVARIANT_ENTRY = "invariant_MinterRemainsHandler()"
HANDLER_METHODS = {
    f"test/{HARNESS}:AeroVerificationHandler.{name}"
    for name in ("mint", "transfer", "approveAndSpend", "unauthorizedMint")
}
CLAIMS = {"source_snapshot_only": True, "fork_executed": False,
          "deployment_bytecode_matched": False, "full_protocol_audited": False,
          "formal_proof_executed": False, "founder_approved": False,
          "audit_published": False}
LIMITATIONS = [
    "Limited ERC-20 actor model and sampled properties, not exhaustive verification.",
    "Grouped invariants share one campaign; its calls are not unique paths or coverage.",
    "Negative controls are intentionally altered copies, not findings in the original contract.",
    "Repeatable local compiler output does not prove equality with deployed runtime.",
    "Hashes bind bundle contents, not independent proof of who executed them.",
    "Source behavior only: permit signatures, production state and wider protocol are outside scope.",
]
# Negative controls are deliberately broken copies, never audit targets or fixes.
# Each replacement must have exactly the declared number of occurrences.
MUTATIONS = {
    "public-mint": {
        "before": "if (msg.sender != minter) revert NotMinter();", "after": "",
        "occurrences": 2, "test": "testFuzz_UnauthorizedMint(address,uint256)",
        "reason": "unauthorized mint succeeded",
        "selector": "0xe0a682a1", "argument_words": 2,
    },
    "missing-transfer-credit": {
        "before": "_balances[to] += amount;", "after": "_balances[to] += 0;",
        "occurrences": 1, "test": "testFuzz_TransferConservesSupply(uint128,uint128)",
        "reason": "recipient balance mismatch",
        "selector": "0x5b09cecc", "argument_words": 2,
    },
    "unspent-allowance": {
        "before": "_approve(owner, spender, currentAllowance - amount);",
        "after": "_approve(owner, spender, currentAllowance);",
        "occurrences": 1, "test": "testFuzz_AllowanceConsumption(uint128,uint128)",
        "reason": "allowance not consumed",
        "selector": "0x5050d873", "argument_words": 2,
    },
    "missing-supply-increase": {
        "before": "_totalSupply += amount;", "after": "_totalSupply += 0;",
        "occurrences": 1, "test": "testFuzz_MintAccounting(uint128)",
        "reason": "mint supply mismatch",
        "selector": "0x6fa30779", "argument_words": 1,
    },
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def strict_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def natural(value):
    return type(value) is int and value >= 0


def same_json(left, right):
    return json.dumps(left, sort_keys=True) == json.dumps(right, sort_keys=True)


def object_at(value, *keys):
    for key in keys:
        require(isinstance(value, dict), f"Expected object before {key}")
        value = value.get(key)
    require(isinstance(value, dict), "Expected JSON object")
    return value


def results(payload, expected):
    require(isinstance(payload, dict) and set(payload) == set(expected), "Unexpected or missing Forge suite")
    flattened = {}
    for suite, names in expected.items():
        body = payload[suite]
        require(isinstance(body, dict), "Malformed Forge suite")
        tests = body.get("test_results")
        require(isinstance(tests, dict) and set(tests) == names, "Unexpected or missing test signature")
        for name, item in tests.items():
            require(isinstance(item, dict), "Malformed Forge result")
            flattened[name] = item
    return flattened


def check_baseline(payload):
    tests = results(payload, {
        UNIT_SUITE: FUZZ_TESTS | UNIT_TESTS, INVARIANT_SUITE: {INVARIANT_ENTRY},
    })
    measured = {"fuzz_runs": {}}
    for name, test in tests.items():
        require(test.get("status") == "Success", f"Assertion did not pass: {name}")
        kind = test.get("kind")
        require(isinstance(kind, dict), f"Missing observed test kind: {name}")
        label = "Fuzz" if name in FUZZ_TESTS else "Invariant" if name in INVARIANTS else "Unit"
        require(set(kind) == {label} and isinstance(kind[label], dict), f"Wrong test kind: {name}")
        observed = kind[label]
        if label == "Fuzz":
            require(natural(observed.get("runs")) and observed["runs"] == 256, f"Fuzz runs not observed: {name}")
            measured["fuzz_runs"][name] = observed["runs"]
        elif label == "Invariant":
            expected_predicates = sorted(
                [{"name": n.split("(")[0], "status": "Success"} for n in INVARIANTS],
                key=lambda item: item["name"])
            predicates = test.get("invariant_predicate_results")
            require(type(test.get("invariant_count")) is int and test["invariant_count"] == len(INVARIANTS)
                    and isinstance(predicates, list) and all(isinstance(p, dict) and isinstance(p.get("name"), str) for p in predicates)
                    and sorted(predicates, key=lambda item: item["name"]) == expected_predicates,
                    "Grouped invariant predicates are missing, duplicated or failed")
            for key, expected in (("runs", 128), ("calls", 8192), ("reverts", 0)):
                require(natural(observed.get(key)) and observed[key] == expected, f"Invalid invariant {key}: {name}")
            metrics = observed.get("metrics")
            require(isinstance(metrics, dict) and set(metrics) == HANDLER_METHODS, "Unexpected invariant targets")
            for metric in metrics.values():
                require(isinstance(metric, dict), "Invalid invariant metric")
                require(natural(metric.get("calls")) and metric["calls"] > 0, "Handler method never exercised")
                require(natural(metric.get("reverts")) and metric["reverts"] == 0, "Handler reverted")
                require(natural(metric.get("discards")) and metric["discards"] == 0, "Handler discarded")
            require(sum(m["calls"] for m in metrics.values()) == observed["calls"], "Invariant call totals disagree")
            measured["invariant_campaign"] = {
                "runs": observed["runs"], "calls": observed["calls"], "reverts": observed["reverts"],
                "predicates": expected_predicates, "handler_metrics": metrics,
            }
    measured["forge_result_entries"] = len(tests)
    measured["test_functions_passed"] = len(FUZZ_TESTS | UNIT_TESTS | INVARIANTS)
    measured["fuzz_cases_reported"] = sum(measured["fuzz_runs"].values())
    # Grouped predicates share one campaign. Never multiply calls by predicates.
    measured["unique_invariant_sequences"] = None
    return measured


def check_mutation(payload, mutation, exit_code):
    require(type(exit_code) is int and exit_code == 1, "Mutation control did not exit with an assertion failure")
    test = results(payload, {UNIT_SUITE: {mutation["test"]}})[mutation["test"]]
    require(test.get("status") == "Failure", "Mutation was not caught by an assertion")
    require(mutation["reason"] in str(test.get("reason") or ""), "Mutation failed for an unrelated reason")
    kind = test.get("kind")
    require(isinstance(kind, dict) and set(kind) == {"Fuzz"} and isinstance(kind["Fuzz"], dict),
            "Mutation did not execute the expected fuzz test")
    require(natural(kind["Fuzz"].get("runs")), "Missing mutation execution metadata")
    counterexample = test.get("counterexample")
    require(isinstance(counterexample, dict) and set(counterexample) == {"Single"}
            and isinstance(counterexample["Single"], dict), "Missing single-case counterexample")
    single = counterexample["Single"]
    calldata = single.get("calldata")
    require(isinstance(calldata, str) and re.fullmatch(r"0x[a-fA-F0-9]+", calldata)
            and calldata.startswith(mutation["selector"])
            and len(calldata) == 10 + 64 * mutation["argument_words"], "Wrong counterexample selector or ABI length")
    require(single.get("fuzz_seed") == "0x39" and natural(single.get("fuzz_run"))
            and 0 < single["fuzz_run"] <= 256, "Missing counterexample replay metadata")
    return {"status": "EXPECTED_ASSERTION_FAILED", "test": mutation["test"],
            "reason": test["reason"], "counterexample": test["counterexample"], "exit_code": exit_code}


def verify_build(artifact, build_info, source, harness):
    require(isinstance(artifact, dict) and isinstance(build_info, dict), "Missing compiler artifacts")
    compiler_input = build_info.get("input")
    require(isinstance(compiler_input, dict), "Missing Standard JSON compiler input")
    sources = compiler_input.get("sources")
    require(isinstance(sources, dict) and set(sources) == {"src/Aero.sol", f"test/{HARNESS}"}, "Unexpected compiler sources")
    for name, expected in (("src/Aero.sol", source), (f"test/{HARNESS}", harness)):
        require(isinstance(sources[name], dict) and sources[name].get("content") == expected,
                f"Compiler input not bound to captured source: {name}")
    settings = compiler_input.get("settings")
    require(isinstance(settings, dict) and same_json(settings.get("optimizer"), {"enabled": True, "runs": 200})
            and settings.get("evmVersion") == "paris" and settings.get("viaIR", False) is False,
            "Unexpected compiler settings")
    require(build_info.get("solcVersion") == "0.8.19", "Wrong build-info compiler")
    metadata = artifact.get("metadata")
    require(object_at(metadata, "compiler").get("version") == "0.8.19+commit.7dd6d404",
            "Wrong artifact compiler")
    require(object_at(metadata, "settings").get("compilationTarget") == {"src/Aero.sol": "Aero"}, "Wrong compiled target")
    output = object_at(build_info, "output", "contracts", "src/Aero.sol", "Aero", "evm")
    digests = {}
    for name in ("bytecode", "deployedBytecode"):
        part = artifact.get(name)
        require(isinstance(part, dict), "Missing compiled bytecode")
        code = part.get("object")
        require(isinstance(code, str) and re.fullmatch(r"0x(?:[a-fA-F0-9]{2})+", code), "Invalid or unlinked bytecode")
        require(not part.get("linkReferences"), "Unresolved library references")
        require(object_at(output, name).get("object") == code[2:], "Artifact differs from compiler output")
        digests[name] = sha(bytes.fromhex(code[2:]))
    return digests


def execute(command, cwd, destination, env, timeout=180):
    """Keep raw outputs and status; kill the entire process group on timeout."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.with_suffix(".json").open("wb") as stdout, destination.with_suffix(".stderr.log").open("wb") as stderr:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=stdout, stderr=stderr, start_new_session=True)
        try:
            status = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            status = 124
    destination.with_suffix(".exit-code.txt").write_text(f"{status}\n")
    require(status != 124, f"Execution timed out: {destination.name}")
    return status


def verify_bundle(root):
    """Recompute from captured raw data; never trust a success label alone."""
    require(root.is_dir() and not root.is_symlink(), "Missing evidence directory")
    root = root.resolve()
    paths = list(root.rglob("*"))
    require(len(paths) <= 100 and all(not p.is_symlink() for p in paths), "Unsafe evidence inventory")
    files = {p.relative_to(root).as_posix(): p for p in paths if p.is_file() and p != root / "summary.json"}
    expected_files = {"Aero.sol", HARNESS, "foundry.toml", "verify-aero-source.py", "foundry-version.txt", "toolchain.json"}
    expected_files.update(f"build-{i}-{suffix}" for i in (1, 2) for suffix in (
        "execution.json", "execution.stderr.log", "execution.exit-code.txt", "Aero.json", "input.json"))
    expected_files.update(f"forge-results{suffix}" for suffix in (".json", ".stderr.log", ".exit-code.txt"))
    expected_files.update(f"negative-controls/{name}/{file}" for name in MUTATIONS for file in (
        "Aero.sol", "forge-results.json", "forge-results.stderr.log", "forge-results.exit-code.txt"))
    require(set(files) == expected_files, "Missing or unexpected evidence files")
    require(all(p.stat().st_size <= 16 * 1024 * 1024 for p in files.values()), "Evidence file too large")
    require(sum(p.stat().st_size for p in files.values()) <= 64 * 1024 * 1024, "Evidence bundle too large")
    require((root / "summary.json").stat().st_size <= 1024 * 1024, "Summary too large")
    summary = strict_json(root / "summary.json")
    require(isinstance(summary, dict) and summary.get("schema") == "solay39-aero-source-verification-v2", "Wrong evidence schema")
    require(set(summary) == {"schema", "status", "claims", "limitations", "reproducible_source_build",
                             "observed", "negative_controls", "github_declared_context", "files"},
            "Unexpected summary fields")
    require(same_json(summary.get("limitations"), LIMITATIONS), "Profile limitations changed")
    require(summary.get("files") == {name: sha(p.read_bytes()) for name, p in files.items()}, "Evidence file hashes disagree")
    require(summary.get("status") == "EXECUTED_SOURCE_PROPERTIES_PASSED" and same_json(summary.get("claims"), CLAIMS),
            "Bundle is incomplete or contains unsupported approval/execution claims")
    source = (root / "Aero.sol").read_bytes()
    harness = (root / HARNESS).read_bytes()
    config = (root / "foundry.toml").read_bytes()
    require(sha(source) == SOURCE_SHA, "Source digest mismatch")
    require(harness == (REPO / "tests/security" / HARNESS).read_bytes(), "Untrusted or outdated harness")
    require(config == (REPO / ".github/audit/aero-verification.toml").read_bytes(), "Untrusted or outdated configuration")
    require((root / "verify-aero-source.py").read_bytes() == Path(__file__).read_bytes(), "Verifier revision mismatch")
    chain = strict_json(root / "toolchain.json")
    require(isinstance(chain, dict) and chain.get("solc_binary_sha256") == SOLC_SHA
            and chain.get("forge_commit") == FORGE_COMMIT and chain.get("source_sha256") == SOURCE_SHA
            and chain.get("harness_sha256") == sha(harness) and chain.get("configuration_sha256") == sha(config)
            and chain.get("forge_binary_sha256") == FORGE_SHA, "Toolchain binding mismatch")
    version = (root / "foundry-version.txt").read_text()
    require(re.search(r"^forge Version: 1\.9\.0$", version, re.M) is not None
            and f"Commit SHA: {FORGE_COMMIT}" in version, "Unsupported recorded Foundry build")
    builds = []
    for index in (1, 2):
        require((root / f"build-{index}-execution.exit-code.txt").read_text().strip() == "0", "Build did not succeed")
        builds.append(verify_build(strict_json(root / f"build-{index}-Aero.json"),
                                   strict_json(root / f"build-{index}-input.json"), source.decode(), harness.decode()))
    require(builds[0] == builds[1], "Clean build outputs differ")
    expected_build = {"clean_builds": 2, "matching_bytecode_sha256": builds[0]}
    require(same_json(summary.get("reproducible_source_build"), expected_build), "Reproducibility summary disagrees")
    require((root / "forge-results.exit-code.txt").read_text().strip() == "0", "Baseline did not succeed")
    measured = check_baseline(strict_json(root / "forge-results.json"))
    require(same_json(summary.get("observed"), measured), "Measured execution summary disagrees")
    controls = {}
    for name, mutation in MUTATIONS.items():
        location = root / "negative-controls" / name
        require(source.decode().count(mutation["before"]) == mutation["occurrences"], "Mutation target changed")
        modified = source.decode().replace(mutation["before"], mutation["after"]).encode()
        require((location / "Aero.sol").read_bytes() == modified, "Negative-control source not bound to original")
        status = int((location / "forge-results.exit-code.txt").read_text().strip())
        controls[name] = check_mutation(strict_json(location / "forge-results.json"), mutation, status)
        controls[name]["intentionally_mutated_source_sha256"] = sha(modified)
    require(same_json(summary.get("negative_controls"), controls), "Negative-control summary disagrees")
    return measured


def run(source_path, forge_path, solc_path, out):
    require(not out.exists(), "Output must be a new directory; never overwrite evidence")
    out.mkdir(parents=True)
    summary = {
        "schema": "solay39-aero-source-verification-v2", "status": "INCOMPLETE_OR_FAILED",
        "claims": CLAIMS.copy(),
        "limitations": LIMITATIONS.copy(),
    }
    try:
        source = source_path.read_bytes()
        require(sha(source) == SOURCE_SHA, "Unsupported source digest; do not reuse results for other contracts")
        require(sha(solc_path.read_bytes()) == SOLC_SHA, "Solidity compiler binary digest mismatch")
        require(sha(forge_path.read_bytes()) == FORGE_SHA, "Foundry binary digest mismatch")
        harness = (REPO / "tests/security" / HARNESS).read_bytes()
        config = (REPO / ".github/audit/aero-verification.toml").read_bytes()
        for name, data in (("Aero.sol", source), (HARNESS, harness), ("foundry.toml", config)):
            (out / name).write_bytes(data)
        (out / "verify-aero-source.py").write_bytes(Path(__file__).read_bytes())
        # Do not inherit credentials, RPC endpoints or Foundry configuration overrides.
        env = {key: os.environ[key] for key in ("HOME", "PATH", "USER", "TMPDIR", "LANG") if key in os.environ}
        version = subprocess.run([str(forge_path), "--version"], env=env, capture_output=True, timeout=10, check=True).stdout.decode()
        require(re.search(r"^forge Version: 1\.9\.0$", version, re.M) is not None
                and f"Commit SHA: {FORGE_COMMIT}" in version, "Unsupported Foundry build")
        (out / "foundry-version.txt").write_text(version)
        write_json(out / "toolchain.json", {
            "forge_binary_sha256": sha(forge_path.read_bytes()), "forge_commit": FORGE_COMMIT,
            "solc_binary_sha256": SOLC_SHA, "source_sha256": SOURCE_SHA,
            "harness_sha256": sha(harness), "configuration_sha256": sha(config),
        })
        with tempfile.TemporaryDirectory(prefix="solay39-aero-v2-") as temporary:
            work = Path(temporary)
            (work / "src").mkdir()
            (work / "test").mkdir()
            (work / "src/Aero.sol").write_bytes(source)
            (work / "test" / HARNESS).write_bytes(harness)
            (work / "foundry.toml").write_bytes(config)
            base = [str(forge_path)]
            common = ["--root", str(work), "--use", str(solc_path), "--offline",
                      "--no-dynamic-test-linking", "--threads", "1"]
            builds = []
            for index in (1, 2):
                for directory in ("cache", "build"):
                    shutil.rmtree(work / directory, ignore_errors=True)
                status = execute(base + ["build", *common, "--build-info", "--json"], work, out / f"build-{index}-execution", env)
                require(status == 0, f"Compiler build {index} failed")
                artifact = strict_json(work / "build/Aero.sol/Aero.json")
                infos = list((work / "build/build-info").glob("*.json"))
                require(len(infos) == 1, "Expected one complete compiler input")
                info = strict_json(infos[0])
                write_json(out / f"build-{index}-Aero.json", artifact)
                write_json(out / f"build-{index}-input.json", info)
                builds.append(verify_build(artifact, info, source.decode(), harness.decode()))
            require(builds[0] == builds[1], "Fresh compiler outputs differ")
            summary["reproducible_source_build"] = {"clean_builds": 2, "matching_bytecode_sha256": builds[0]}
            status = execute(base + ["test", *common, "--match-contract",
                                     "AeroSource(Verification|Invariant)Test", "--json"],
                             work, out / "forge-results", env)
            require(status == 0, "Baseline tests failed")
            summary["observed"] = check_baseline(strict_json(out / "forge-results.json"))
            controls = {}
            for name, mutation in MUTATIONS.items():
                original = source.decode()
                require(original.count(mutation["before"]) == mutation["occurrences"], "Mutation location changed")
                modified = original.replace(mutation["before"], mutation["after"])
                root = out / "negative-controls" / name
                root.mkdir(parents=True)
                (root / "Aero.sol").write_text(modified)
                (work / "src/Aero.sol").write_text(modified)
                # Each independent mutant starts from the original snapshot, never a previous mutant.
                status = execute(base + ["test", *common, "--match-contract", "AeroSourceVerificationTest",
                                         "--match-test", mutation["test"].split("(")[0], "--json"],
                                 work, root / "forge-results", env)
                controls[name] = check_mutation(strict_json(root / "forge-results.json"), mutation, status)
                controls[name]["intentionally_mutated_source_sha256"] = sha(modified.encode())
            summary["negative_controls"] = controls
            summary["status"] = "EXECUTED_SOURCE_PROPERTIES_PASSED"
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as exc:
        summary["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        summary["github_declared_context"] = {
            key: os.environ.get(value) for key, value in {
                "repository": "GITHUB_REPOSITORY", "run_id": "GITHUB_RUN_ID",
                "run_attempt": "GITHUB_RUN_ATTEMPT", "head_sha": "GITHUB_SHA",
            }.items()
        }
        summary["files"] = {
            p.relative_to(out).as_posix(): sha(p.read_bytes())
            for p in sorted(out.rglob("*")) if p.is_file() and p != out / "summary.json"
        }
        write_json(out / "summary.json", summary)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO / "tests/fixtures/aero/Aero.sol")
    parser.add_argument("--forge", type=Path, default=Path(shutil.which("forge") or "forge"))
    parser.add_argument("--solc", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--verify-bundle", type=Path)
    args = parser.parse_args()
    if args.verify_bundle:
        try:
            observed = verify_bundle(args.verify_bundle)
            print(json.dumps({"status": "BUNDLE_CONSISTENT_WITH_TRUSTED_PROFILE", "observed": observed}, indent=2))
        except (OSError, ValueError, TypeError, KeyError) as exc:
            parser.exit(1, f"Bundle rejected: {exc}\n")
        raise SystemExit(0)
    if not args.solc or not args.out:
        parser.error("--solc and --out are required for execution")
    result = run(args.source.resolve(), args.forge.resolve(), args.solc.resolve(), args.out.resolve())
    if result["status"] == "EXECUTED_SOURCE_PROPERTIES_PASSED":
        # A parser or serialization regression must also fail the CI job.
        verify_bundle(args.out)
    print(json.dumps({k: result.get(k) for k in ("status", "observed", "error")}, indent=2))
    raise SystemExit(0 if result["status"] == "EXECUTED_SOURCE_PROPERTIES_PASSED" else 1)
