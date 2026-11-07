"""Synthetic parser fixtures only. Not evidence that Solidity was executed."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "source_verification", Path(__file__).parents[1] / "scripts/verify-aero-source.py")
verification = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verification)
v = verification


def baseline_fixture():
    tests = {name: {"status": "Success", "kind": {"Fuzz": {"runs": 256}}} for name in v.FUZZ_TESTS}
    tests.update({name: {"status": "Success", "kind": {"Unit": {"gas": 1}}} for name in v.UNIT_TESTS})
    invariant = {
        "status": "Success", "invariant_count": 2,
        "invariant_predicate_results": [
            {"name": name.split("(")[0], "status": "Success"} for name in sorted(v.INVARIANTS)],
        "kind": {"Invariant": {
            "runs": 128, "calls": 8192, "reverts": 0,
            "metrics": {name: {"calls": 2048, "reverts": 0, "discards": 0} for name in v.HANDLER_METHODS},
        }},
    }
    return {v.UNIT_SUITE: {"test_results": tests},
            v.INVARIANT_SUITE: {"test_results": {v.INVARIANT_ENTRY: invariant}}}


def mutation_fixture(mutation):
    return {v.UNIT_SUITE: {"test_results": {
        mutation["test"]: {
            "status": "Failure", "reason": mutation["reason"], "kind": {"Fuzz": {"runs": 0}},
            "counterexample": {"Single": {
                "calldata": mutation["selector"] + "0" * (64 * mutation["argument_words"]),
                "fuzz_seed": "0x39", "fuzz_run": 1,
            }},
        },
    }}}


def compiler_fixture(source="synthetic source", harness="synthetic harness"):
    # Structural fixture, deliberately not real compiler output.
    artifact = {
        "bytecode": {"object": "0x6000", "linkReferences": {}},
        "deployedBytecode": {"object": "0x6001", "linkReferences": {}},
        "metadata": {"compiler": {"version": "0.8.19+commit.7dd6d404"},
                     "settings": {"compilationTarget": {"src/Aero.sol": "Aero"}}},
    }
    info = {
        "solcVersion": "0.8.19",
        "input": {"sources": {"src/Aero.sol": {"content": source}, f"test/{v.HARNESS}": {"content": harness}},
                  "settings": {"optimizer": {"enabled": True, "runs": 200}, "evmVersion": "paris", "viaIR": False}},
        "output": {"contracts": {"src/Aero.sol": {"Aero": {"evm": {
            "bytecode": {"object": "6000"}, "deployedBytecode": {"object": "6001"},
        }}}}},
    }
    return artifact, info


class ExecutionReaderTests(unittest.TestCase):
    def setUp(self):
        self.payload = baseline_fixture()
        self.unit = self.payload[v.UNIT_SUITE]["test_results"]
        self.fuzz = self.unit["testFuzz_MintAccounting(uint128)"]
        self.invariant = self.payload[v.INVARIANT_SUITE]["test_results"][v.INVARIANT_ENTRY]
        self.campaign = self.invariant["kind"]["Invariant"]

    def rejected(self):
        with self.assertRaises(ValueError):
            v.check_baseline(self.payload)

    def test_observed_counts_do_not_multiply_grouped_invariants(self):
        result = v.check_baseline(self.payload)
        self.assertEqual(result["test_functions_passed"], 12)
        self.assertEqual(result["forge_result_entries"], 11)
        self.assertEqual(result["fuzz_cases_reported"], 2048)
        self.assertEqual(result["invariant_campaign"]["calls"], 8192)
        self.assertIsNone(result["unique_invariant_sequences"])

    def test_missing_signature(self):
        del self.unit["testFuzz_MintAccounting(uint128)"]
        self.rejected()

    def test_extra_signature(self):
        self.unit["test_fake()"] = copy.deepcopy(self.fuzz)
        self.rejected()

    def test_wrong_suite_not_substring_match(self):
        self.payload[v.UNIT_SUITE + "Spoof"] = self.payload.pop(v.UNIT_SUITE)
        self.rejected()

    def test_extra_suite(self):
        self.payload["untrusted:Suite"] = {"test_results": {}}
        self.rejected()

    def test_unit_cannot_impersonate_fuzz(self):
        self.fuzz["kind"] = {"Unit": {"gas": 1}}
        self.rejected()

    def test_missing_or_wrong_fuzz_counts(self):
        for runs in (None, True, False, 0, -1, 255, 257, 256.0, "256"):
            with self.subTest(runs=runs):
                self.fuzz["kind"] = {"Fuzz": {"runs": runs}}
                self.rejected()

    def test_configured_runs_are_not_observed_runs(self):
        self.fuzz["kind"] = {"Fuzz": {"configured_runs": 256}}
        self.rejected()

    def test_failure_or_skip_is_not_success(self):
        for status in ("Failure", "Skipped", None, True):
            with self.subTest(status=status):
                self.fuzz["status"] = status
                self.rejected()

    def test_grouped_predicate_missing(self):
        self.invariant["invariant_predicate_results"].pop()
        self.rejected()

    def test_grouped_predicate_failed(self):
        self.invariant["invariant_predicate_results"][1]["status"] = "Failure"
        self.rejected()

    def test_grouped_predicate_duplicated(self):
        self.invariant["invariant_predicate_results"][1] = self.invariant["invariant_predicate_results"][0]
        self.rejected()

    def test_grouped_predicate_count_mismatch(self):
        self.invariant["invariant_count"] = 1
        self.rejected()

    def test_invariant_counts_and_reverts(self):
        for key, value in (("runs", 127), ("calls", 0), ("calls", 8191), ("reverts", 1), ("reverts", False)):
            with self.subTest(key=key, value=value):
                original = self.campaign[key]
                self.campaign[key] = value
                self.rejected()
                self.campaign[key] = original

    def test_invariant_target_substitution(self):
        metric = self.campaign["metrics"].pop(next(iter(v.HANDLER_METHODS)))
        self.campaign["metrics"]["Untrusted.handler"] = metric
        self.rejected()

    def test_invariant_unexercised_handler(self):
        self.campaign["metrics"][next(iter(v.HANDLER_METHODS))]["calls"] = 0
        self.rejected()

    def test_invariant_metric_totals_disagree(self):
        self.campaign["metrics"][next(iter(v.HANDLER_METHODS))]["calls"] = 2049
        self.rejected()

    def test_handler_reverts_or_discards(self):
        for key in ("reverts", "discards"):
            with self.subTest(key=key):
                metric = self.campaign["metrics"][next(iter(v.HANDLER_METHODS))]
                metric[key] = 1
                self.rejected()
                metric[key] = 0


class MutationReaderTests(unittest.TestCase):
    def setUp(self):
        self.mutation = v.MUTATIONS["public-mint"]
        self.payload = mutation_fixture(self.mutation)
        self.test = self.payload[v.UNIT_SUITE]["test_results"][self.mutation["test"]]

    def rejected(self, status=1):
        with self.assertRaises(ValueError):
            v.check_mutation(self.payload, self.mutation, status)

    def test_all_four_control_shapes(self):
        for mutation in v.MUTATIONS.values():
            with self.subTest(test=mutation["test"]):
                self.assertEqual(v.check_mutation(mutation_fixture(mutation), mutation, 1)["status"],
                                 "EXPECTED_ASSERTION_FAILED")

    def test_passing_or_timeout_is_not_detected_mutation(self):
        for code in (0, True, 124, 137, -9):
            with self.subTest(code=code):
                self.rejected(code)

    def test_unrelated_revert_not_detected_mutation(self):
        self.test["reason"] = "compiler unavailable"
        self.rejected()

    def test_success_status_not_detected_mutation(self):
        self.test["status"] = "Success"
        self.rejected()

    def test_missing_counterexample(self):
        self.test.pop("counterexample")
        self.rejected()

    def test_wrong_counterexample_selector(self):
        self.test["counterexample"]["Single"]["calldata"] = "0x00000000" + "0" * 128
        self.rejected()

    def test_truncated_counterexample_arguments(self):
        self.test["counterexample"]["Single"]["calldata"] = self.mutation["selector"]
        self.rejected()

    def test_counterexample_seed_or_run_missing(self):
        for key in ("fuzz_seed", "fuzz_run"):
            with self.subTest(key=key):
                single = self.test["counterexample"]["Single"]
                original = single.pop(key)
                self.rejected()
                single[key] = original

    def test_wrong_test_kind(self):
        self.test["kind"] = {"Unit": {}}
        self.rejected()


class CompilerAndSafetyTests(unittest.TestCase):
    def setUp(self):
        self.artifact, self.info = compiler_fixture()

    def check(self):
        return v.verify_build(self.artifact, self.info, "synthetic source", "synthetic harness")

    def test_compiler_fixture_shape(self):
        self.assertEqual(set(self.check()), {"bytecode", "deployedBytecode"})

    def test_source_or_harness_substitution(self):
        for path in ("src/Aero.sol", f"test/{v.HARNESS}"):
            with self.subTest(path=path):
                original = self.info["input"]["sources"][path]["content"]
                self.info["input"]["sources"][path]["content"] = "changed"
                with self.assertRaises(ValueError):
                    self.check()
                self.info["input"]["sources"][path]["content"] = original

    def test_extra_compiler_input(self):
        self.info["input"]["sources"]["Hidden.sol"] = {"content": "extra"}
        with self.assertRaises(ValueError):
            self.check()

    def test_different_compiler_settings(self):
        self.info["input"]["settings"]["optimizer"]["runs"] = 201
        with self.assertRaises(ValueError):
            self.check()

    def test_boolean_optimizer_type(self):
        self.info["input"]["settings"]["optimizer"]["enabled"] = 1
        with self.assertRaises(ValueError):
            self.check()

    def test_wrong_compiler_or_target(self):
        for key, value in (("compiler", {"version": "0.8.20"}),
                           ("settings", {"compilationTarget": {"src/Aero.sol": "Other"}}),
                           ("compiler", [])):
            with self.subTest(key=key, value=value):
                artifact = copy.deepcopy(self.artifact)
                artifact["metadata"][key] = value
                with self.assertRaises(ValueError):
                    v.verify_build(artifact, self.info, "synthetic source", "synthetic harness")

    def test_changed_artifact_bytecode(self):
        self.artifact["bytecode"]["object"] = "0x6002"
        with self.assertRaises(ValueError):
            self.check()

    def test_unlinked_or_empty_bytecode(self):
        for code in ("0x", "0x___library___", "0x123"):
            with self.subTest(code=code):
                self.artifact["bytecode"]["object"] = code
                with self.assertRaises(ValueError):
                    self.check()

    def test_duplicate_json_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.json"
            path.write_text('{"success": false, "success": true}')
            with self.assertRaises(ValueError):
                v.strict_json(path)

    def test_unsupported_source_fails_closed_without_tools(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "wrong.sol"
            source.write_text("not the pinned source")
            result = v.run(source, root / "missing-forge", root / "missing-solc", root / "evidence")
            self.assertEqual(result["status"], "INCOMPLETE_OR_FAILED")
            self.assertIn("Unsupported source digest", result["error"])
            self.assertFalse(result["claims"]["founder_approved"])
            self.assertFalse(result["claims"]["audit_published"])

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "keep.txt"
            marker.write_text("keep")
            with self.assertRaises(ValueError):
                v.run(root / "source.sol", root / "forge", root / "solc", root)
            self.assertEqual(marker.read_text(), "keep")

    def test_boolean_claims_are_not_numeric_claims(self):
        self.assertFalse(v.same_json({"approved": False}, {"approved": 0}))

    def test_symlink_bundle_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "bundle").mkdir()
            link = root / "link"
            link.symlink_to(root / "bundle", target_is_directory=True)
            with self.assertRaises(ValueError):
                v.verify_bundle(link)


if __name__ == "__main__":
    unittest.main()
