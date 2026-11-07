import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "aero_benchmark", Path(__file__).parents[1] / ".github/audit/finalize_aero_benchmark.py")
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class AeroEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "Aero.sol").write_text("synthetic parser fixture; not the Aero snapshot")
        self.original_sha = benchmark.EXPECTED_SHA
        benchmark.EXPECTED_SHA = benchmark.hashlib.sha256((self.root / "Aero.sol").read_bytes()).hexdigest()
        (self.root / "forge-exit-code.txt").write_text("0")

    def tearDown(self):
        benchmark.EXPECTED_SHA = self.original_sha
        self.temp.cleanup()

    def write_results(self, names=None, status="Success"):
        names = benchmark.EXPECTED_TESTS if names is None else names
        (self.root / "forge-results.json").write_text(json.dumps({
            "test/AeroSourceAuthorization.t.sol:AeroSourceAuthorizationTest": {
                "test_results": {name + "()": {"status": status, "kind": "Standard"} for name in names}}}))

    def test_all_expected_successes_are_required(self):
        self.write_results()
        result = benchmark.summarize(self.root)
        self.assertEqual(result["status"], "EXECUTED_ASSERTIONS_PASSED")
        self.assertEqual(result["tests_executed"], 8)
        self.assertFalse(result["claims"]["founder_approved"])
        self.assertFalse(result["claims"]["deployment_bytecode_matched"])

    def test_zero_tests_is_not_success(self):
        self.write_results([])
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")

    def test_partial_tests_is_not_success(self):
        self.write_results(list(benchmark.EXPECTED_TESTS)[:-1])
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")

    def test_failed_assertions_are_not_success(self):
        self.write_results(status="Failure")
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")

    def test_nonzero_exit_is_not_success(self):
        self.write_results()
        (self.root / "forge-exit-code.txt").write_text("1")
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")

    def test_altered_source_is_rejected(self):
        self.write_results()
        (self.root / "Aero.sol").write_text("different snapshot")
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")

    def test_malformed_json_is_not_success(self):
        (self.root / "forge-results.json").write_text("{invalid")
        self.assertEqual(benchmark.summarize(self.root)["status"], "INCOMPLETE_OR_FAILED")


if __name__ == "__main__":
    unittest.main()
